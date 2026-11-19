import { HttpError } from '../lib/httpError.js';
import { maskAbusive } from '../lib/profanity.js';
import { nowIso } from '../lib/dates.js';

const SELECT_FEEDBACK = `
  SELECT f.*, v.visit_date, v.service, v.shift, v.nurse_id,
         n.name AS nurse_name, fam.contact_name, fam.patient_name, fam.phone AS family_phone, fam.city
  FROM feedback f
  JOIN visits v ON v.id = f.visit_id
  JOIN nurses n ON n.id = v.nurse_id
  JOIN families fam ON fam.id = v.family_id`;

/** Converts a DB row to the API shape. The comment is always masked here: this is the only path to staff. */
function toApi(row) {
  const { text, flagged } = maskAbusive(row.comment);
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    visitDate: row.visit_date,
    service: row.service,
    shift: row.shift,
    nurse: { id: row.nurse_id, name: row.nurse_name },
    family: { contactName: row.contact_name, patientName: row.patient_name, phone: row.family_phone, city: row.city },
    ratings: {
      punctuality: row.punctuality,
      quality_of_care: row.quality_of_care,
      hygiene: row.hygiene,
      behaviour: row.behaviour,
    },
    overall: row.overall,
    recommendScore: row.recommend_score,
    comment: text,
    commentHidden: flagged || row.comment_flagged === 1,
    sentiment: row.sentiment,
    needsFollowUp: row.needs_follow_up === 1,
    followUp: {
      status: row.follow_up_status,
      note: row.follow_up_note,
      resolvedAt: row.follow_up_resolved_at,
    },
  };
}

function buildFilters(q) {
  const where = [];
  const params = {};
  if (q.start) { where.push('f.submitted_at >= :start'); params.start = q.start; }
  if (q.end) { where.push('f.submitted_at < :end'); params.end = q.end; }
  if (q.nurseId) { where.push('v.nurse_id = :nurseId'); params.nurseId = q.nurseId; }
  if (q.sentiment === 'none') where.push('f.sentiment IS NULL');
  else if (q.sentiment) { where.push('f.sentiment = :sentiment'); params.sentiment = q.sentiment; }
  if (q.followUp) { where.push('f.follow_up_status = :followUp'); params.followUp = q.followUp; }
  if (q.flagged) where.push('f.comment_flagged = 1');
  if (q.maxOverall) { where.push('f.overall <= :maxOverall'); params.maxOverall = q.maxOverall; }
  if (q.search) {
    where.push('(f.comment LIKE :search OR n.name LIKE :search OR fam.contact_name LIKE :search OR fam.patient_name LIKE :search)');
    params.search = `%${q.search}%`;
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const SORTS = {
  newest: 'f.submitted_at DESC',
  oldest: 'f.submitted_at ASC',
  lowest: 'f.overall ASC, f.submitted_at DESC',
  highest: 'f.overall DESC, f.submitted_at DESC',
};

export function createFeedbackService(db) {
  function list(q) {
    const { sql, params } = buildFilters(q);
    const total = db.prepare(`SELECT COUNT(*) AS c FROM (${SELECT_FEEDBACK} ${sql})`).get(params).c;
    const order = SORTS[q.sort] ?? SORTS.newest;
    const rows = db
      .prepare(`${SELECT_FEEDBACK} ${sql} ORDER BY ${order} LIMIT :limit OFFSET :offset`)
      .all({ ...params, limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    return { items: rows.map(toApi), total, page: q.page, pageSize: q.pageSize };
  }

  /** All matching rows, unpaginated, for CSV export. */
  function all(q) {
    const { sql, params } = buildFilters(q);
    return db.prepare(`${SELECT_FEEDBACK} ${sql} ORDER BY f.submitted_at DESC`).all(params).map(toApi);
  }

  /** Low scores needing a call from ops. Open ones first, worst first. */
  function followUps({ status = 'open', limit = 50 }) {
    const where = status === 'all' ? "WHERE f.follow_up_status != 'none'" : 'WHERE f.follow_up_status = :status';
    const rows = db
      .prepare(
        `${SELECT_FEEDBACK} ${where}
         ORDER BY CASE f.follow_up_status WHEN 'open' THEN 0 ELSE 1 END, f.overall ASC, f.submitted_at DESC
         LIMIT :limit`,
      )
      .all(status === 'all' ? { limit } : { status, limit });
    return rows.map(toApi);
  }

  function updateFollowUp(id, { status, note }) {
    const row = db.prepare('SELECT id, needs_follow_up FROM feedback WHERE id = ?').get(id);
    if (!row) throw new HttpError(404, 'feedback_not_found', 'Feedback not found.');
    db.prepare(
      `UPDATE feedback SET follow_up_status = ?, follow_up_note = ?, follow_up_resolved_at = ? WHERE id = ?`,
    ).run(status, note ?? null, status === 'resolved' ? nowIso() : null, id);
    return toApi(db.prepare(`${SELECT_FEEDBACK} WHERE f.id = ?`).get(id));
  }

  return { list, all, followUps, updateFollowUp };
}
