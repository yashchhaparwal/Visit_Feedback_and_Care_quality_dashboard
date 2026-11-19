import { NPS_SQL } from '../lib/quality.js';
import { previousRange } from '../lib/dates.js';

const round = (n, dp = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** dp) / 10 ** dp);

/** Shared FROM/WHERE for queries over feedback in a date range, optionally for one nurse. */
function scope({ start, end, nurseId }) {
  const where = ['f.submitted_at >= :start', 'f.submitted_at < :end'];
  const params = { start, end };
  if (nurseId) {
    where.push('v.nurse_id = :nurseId');
    params.nurseId = nurseId;
  }
  return {
    from: `FROM feedback f JOIN visits v ON v.id = f.visit_id JOIN nurses n ON n.id = v.nurse_id`,
    where: `WHERE ${where.join(' AND ')}`,
    params,
  };
}

const AGGREGATES = `
  COUNT(*) AS responses,
  AVG(f.overall) AS overall,
  AVG(f.punctuality) AS punctuality,
  AVG(f.quality_of_care) AS quality_of_care,
  AVG(f.hygiene) AS hygiene,
  AVG(f.behaviour) AS behaviour,
  ${NPS_SQL} AS nps,
  SUM(CASE WHEN f.recommend_score >= 9 THEN 1 ELSE 0 END) AS promoters,
  SUM(CASE WHEN f.recommend_score BETWEEN 7 AND 8 THEN 1 ELSE 0 END) AS passives,
  SUM(CASE WHEN f.recommend_score <= 6 THEN 1 ELSE 0 END) AS detractors,
  SUM(f.needs_follow_up) AS low_scores`;

function shapeAggregate(row) {
  return {
    responses: row.responses,
    overall: round(row.overall),
    categories: {
      punctuality: round(row.punctuality),
      quality_of_care: round(row.quality_of_care),
      hygiene: round(row.hygiene),
      behaviour: round(row.behaviour),
    },
    nps: row.nps,
    promoters: row.promoters ?? 0,
    passives: row.passives ?? 0,
    detractors: row.detractors ?? 0,
    lowScores: row.low_scores ?? 0,
  };
}

export function createStatsService(db) {
  function aggregate(range) {
    const s = scope(range);
    return shapeAggregate(db.prepare(`SELECT ${AGGREGATES} ${s.from} ${s.where}`).get(s.params));
  }

  /** Links sent vs answered for links created in the range. */
  function responseRate({ start, end, nurseId }) {
    const params = { start, end };
    let nurseClause = '';
    if (nurseId) {
      nurseClause = 'AND v.nurse_id = :nurseId';
      params.nurseId = nurseId;
    }
    const row = db
      .prepare(
        `SELECT COUNT(*) AS sent, SUM(CASE WHEN l.used_at IS NOT NULL THEN 1 ELSE 0 END) AS answered
         FROM feedback_links l JOIN visits v ON v.id = l.visit_id
         WHERE l.created_at >= :start AND l.created_at < :end ${nurseClause}`,
      )
      .get(params);
    return { sent: row.sent, answered: row.answered ?? 0, rate: row.sent ? round(row.answered / row.sent, 3) : null };
  }

  function overview(range) {
    const current = aggregate(range);
    const previous = aggregate({ ...previousRange(range), nurseId: range.nurseId });
    const openParams = {};
    let openNurse = '';
    if (range.nurseId) {
      openNurse = 'AND v.nurse_id = :nurseId';
      openParams.nurseId = range.nurseId;
    }
    const { open } = db
      .prepare(
        `SELECT COUNT(*) AS open FROM feedback f JOIN visits v ON v.id = f.visit_id
         WHERE f.follow_up_status = 'open' ${openNurse}`,
      )
      .get(openParams);
    const flagged = db
      .prepare(`SELECT COUNT(*) AS c ${scope(range).from} ${scope(range).where} AND f.comment_flagged = 1`)
      .get(scope(range).params).c;
    const sentiment = db
      .prepare(
        `SELECT f.sentiment AS label, COUNT(*) AS count ${scope(range).from} ${scope(range).where}
         AND f.sentiment IS NOT NULL GROUP BY f.sentiment`,
      )
      .all(scope(range).params);

    return {
      range: { start: range.start, end: range.end },
      current,
      previous: { overall: previous.overall, nps: previous.nps, responses: previous.responses },
      responseRate: responseRate(range),
      openFollowUps: open,
      flaggedComments: flagged,
      sentiment: Object.fromEntries(['positive', 'neutral', 'negative'].map((k) => [k, sentiment.find((s) => s.label === k)?.count ?? 0])),
    };
  }

  /** Weekly buckets (weeks start Monday). */
  function trend(range) {
    const s = scope(range);
    const rows = db
      .prepare(
        `SELECT date(f.submitted_at, 'weekday 0', '-6 days') AS week_start, ${AGGREGATES}
         ${s.from} ${s.where}
         GROUP BY week_start ORDER BY week_start`,
      )
      .all(s.params);
    return rows.map((r) => ({ weekStart: r.week_start, ...shapeAggregate(r) }));
  }

  /** One row per nurse with averages, NPS, low-score count and a weekly sparkline. */
  function nurses(range) {
    const s = scope({ start: range.start, end: range.end });
    const rows = db
      .prepare(
        `SELECT n.id, n.name, n.specialization, n.city, ${AGGREGATES}
         ${s.from} ${s.where}
         GROUP BY n.id ORDER BY overall ASC`,
      )
      .all(s.params);

    const weekly = db
      .prepare(
        `SELECT v.nurse_id, date(f.submitted_at, 'weekday 0', '-6 days') AS week_start,
                AVG(f.overall) AS overall, COUNT(*) AS responses
         ${s.from} ${s.where}
         GROUP BY v.nurse_id, week_start ORDER BY week_start`,
      )
      .all(s.params);

    const openByNurse = new Map(
      db
        .prepare(
          `SELECT v.nurse_id, COUNT(*) AS open FROM feedback f JOIN visits v ON v.id = f.visit_id
           WHERE f.follow_up_status = 'open' GROUP BY v.nurse_id`,
        )
        .all()
        .map((r) => [r.nurse_id, r.open]),
    );

    return rows.map((r) => {
      const series = weekly
        .filter((w) => w.nurse_id === r.id)
        .map((w) => ({ weekStart: w.week_start, overall: round(w.overall), responses: w.responses }));
      // Trend: last 4 weeks vs the 4 before, weighted by responses.
      const avg = (list) => {
        const n = list.reduce((a, w) => a + w.responses, 0);
        return n ? list.reduce((a, w) => a + w.overall * w.responses, 0) / n : null;
      };
      const recent = avg(series.slice(-4));
      const before = avg(series.slice(-8, -4));
      return {
        id: r.id,
        name: r.name,
        specialization: r.specialization,
        city: r.city,
        ...shapeAggregate(r),
        openFollowUps: openByNurse.get(r.id) ?? 0,
        change: recent !== null && before !== null ? round(recent - before) : null,
        weekly: series,
      };
    });
  }

  return { overview, trend, nurses, aggregate };
}
