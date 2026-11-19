import crypto from 'node:crypto';
import { transaction } from '../db/database.js';
import { HttpError } from '../lib/httpError.js';
import { addDays, nowIso } from '../lib/dates.js';
import { classifySentiment } from '../lib/sentiment.js';
import { containsAbusive } from '../lib/profanity.js';
import { needsFollowUp, overallRating } from '../lib/quality.js';

/** 24 random bytes -> 32 URL-safe characters. Unguessable, so the link itself is the credential. */
export const generateToken = () => crypto.randomBytes(24).toString('base64url');

export function linkStatus(link, now = new Date()) {
  if (link.used_at) return 'used';
  if (new Date(link.expires_at) <= now) return 'expired';
  return 'pending';
}

export function createLinkService(db, config) {
  const buildUrl = (token) => `${config.publicBaseUrl}/f/${token}`;

  /**
   * Creates the feedback link for a visit. If the visit already has an unused link
   * it is replaced with a fresh token and expiry (e.g. the family lost the first one).
   * A visit that already has feedback cannot get a new link.
   */
  function createForVisit(visitId, expiryDays = config.linkExpiryDays) {
    const visit = db.prepare('SELECT id FROM visits WHERE id = ?').get(visitId);
    if (!visit) throw new HttpError(404, 'visit_not_found', 'Visit not found.');

    const existing = db.prepare('SELECT * FROM feedback_links WHERE visit_id = ?').get(visitId);
    if (existing?.used_at) {
      throw new HttpError(409, 'already_answered', 'Feedback for this visit has already been submitted.');
    }

    const token = generateToken();
    const createdAt = nowIso();
    const expiresAt = addDays(createdAt, expiryDays).toISOString();

    if (existing) {
      db.prepare('UPDATE feedback_links SET token = ?, created_at = ?, expires_at = ? WHERE id = ?').run(
        token, createdAt, expiresAt, existing.id,
      );
    } else {
      db.prepare('INSERT INTO feedback_links (token, visit_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
        token, visitId, createdAt, expiresAt,
      );
    }
    return { token, url: buildUrl(token), createdAt, expiresAt, status: 'pending' };
  }

  /** Public view of a link: just enough for the family to recognise the visit. */
  function getPublicLink(token) {
    const row = db
      .prepare(
        `SELECT l.*, v.visit_date, v.service, v.shift, n.name AS nurse_name, fam.patient_name
         FROM feedback_links l
         JOIN visits v ON v.id = l.visit_id
         JOIN nurses n ON n.id = v.nurse_id
         JOIN families fam ON fam.id = v.family_id
         WHERE l.token = ?`,
      )
      .get(token);
    if (!row) throw new HttpError(404, 'link_not_found', 'This feedback link is not valid.');

    const status = linkStatus(row);
    if (status === 'used') throw new HttpError(410, 'link_used', 'Feedback for this visit has already been submitted. Thank you!');
    if (status === 'expired') throw new HttpError(410, 'link_expired', 'This feedback link has expired.');

    return {
      nurseName: row.nurse_name,
      patientName: row.patient_name.split(' ')[0],
      visitDate: row.visit_date,
      service: row.service,
      shift: row.shift,
      expiresAt: row.expires_at,
    };
  }

  /**
   * Stores a family's feedback and burns the link, atomically.
   * The UPDATE ... WHERE used_at IS NULL is the guard against double submission:
   * if two requests race, only one of them changes a row.
   */
  function submit(token, input) {
    return transaction(db, () => {
      const link = db.prepare('SELECT * FROM feedback_links WHERE token = ?').get(token);
      if (!link) throw new HttpError(404, 'link_not_found', 'This feedback link is not valid.');

      const now = nowIso();
      const burned = db
        .prepare('UPDATE feedback_links SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?')
        .run(now, link.id, now);
      if (burned.changes !== 1) {
        const status = linkStatus(link);
        if (status === 'used') throw new HttpError(410, 'link_used', 'Feedback for this visit has already been submitted. Thank you!');
        throw new HttpError(410, 'link_expired', 'This feedback link has expired.');
      }

      const ratings = {
        punctuality: input.punctuality,
        quality_of_care: input.qualityOfCare,
        hygiene: input.hygiene,
        behaviour: input.behaviour,
        recommend_score: input.recommendScore,
      };
      const comment = input.comment?.trim() || null;
      const sentiment = classifySentiment(comment);
      const followUp = needsFollowUp(ratings);

      db.prepare(
        `INSERT INTO feedback (link_id, visit_id, punctuality, quality_of_care, hygiene, behaviour, overall,
           recommend_score, comment, comment_flagged, sentiment, sentiment_score, needs_follow_up,
           follow_up_status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        link.id, link.visit_id, ratings.punctuality, ratings.quality_of_care, ratings.hygiene, ratings.behaviour,
        overallRating(ratings), ratings.recommend_score, comment, containsAbusive(comment) ? 1 : 0,
        sentiment.label, sentiment.score, followUp ? 1 : 0, followUp ? 'open' : 'none', now,
      );
      return { ok: true };
    });
  }

  return { createForVisit, getPublicLink, submit, buildUrl };
}
