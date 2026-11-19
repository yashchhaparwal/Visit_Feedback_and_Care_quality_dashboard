import { Router } from 'express';
import { validate } from '../middleware/errors.js';
import { HttpError } from '../lib/httpError.js';
import { resolveRange, toDateOnly } from '../lib/dates.js';
import { toCsv } from '../lib/csv.js';
import {
  createLinkSchema,
  createVisitSchema,
  feedbackQuerySchema,
  followUpQuerySchema,
  followUpUpdateSchema,
  rangeQuerySchema,
  visitQuerySchema,
} from './schemas.js';

const CSV_COLUMNS = [
  { key: 'id', header: 'Feedback ID' },
  { key: 'submittedAt', header: 'Submitted at (UTC)' },
  { key: 'visitDate', header: 'Visit date' },
  { key: 'nurse', header: 'Nurse' },
  { key: 'family', header: 'Family contact' },
  { key: 'patient', header: 'Patient' },
  { key: 'city', header: 'City' },
  { key: 'service', header: 'Service' },
  { key: 'punctuality', header: 'Punctuality (1-5)' },
  { key: 'quality_of_care', header: 'Quality of care (1-5)' },
  { key: 'hygiene', header: 'Hygiene (1-5)' },
  { key: 'behaviour', header: 'Behaviour (1-5)' },
  { key: 'overall', header: 'Overall (avg)' },
  { key: 'recommendScore', header: 'Likely to recommend (0-10)' },
  { key: 'npsGroup', header: 'NPS group' },
  { key: 'sentiment', header: 'Comment sentiment' },
  { key: 'comment', header: 'Comment (abusive words hidden)' },
  { key: 'commentHidden', header: 'Abusive language hidden' },
  { key: 'followUpStatus', header: 'Follow-up status' },
  { key: 'followUpNote', header: 'Follow-up note' },
];

const npsGroup = (s) => (s >= 9 ? 'Promoter' : s >= 7 ? 'Passive' : 'Detractor');

/** Routes for the operations team's dashboard. */
export function adminRoutes({ config, stats, feedback, links, visits, summary }) {
  const router = Router();

  const rangeFrom = (q) => ({ ...resolveRange(q), nurseId: q.nurseId });

  // --- Dashboard ---------------------------------------------------------
  router.get('/stats/overview', validate(rangeQuerySchema, 'query'), (req, res) => {
    res.json(stats.overview(rangeFrom(req.valid.query)));
  });

  router.get('/stats/trend', validate(rangeQuerySchema, 'query'), (req, res) => {
    res.json(stats.trend(rangeFrom(req.valid.query)));
  });

  router.get('/stats/nurses', validate(rangeQuerySchema, 'query'), (req, res) => {
    res.json(stats.nurses(rangeFrom(req.valid.query)));
  });

  router.get('/follow-ups', validate(followUpQuerySchema, 'query'), (req, res) => {
    res.json(feedback.followUps(req.valid.query));
  });

  router.patch('/feedback/:id/follow-up', validate(followUpUpdateSchema), (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new HttpError(400, 'bad_id', 'Invalid feedback id.');
    res.json(feedback.updateFollowUp(id, req.valid.body));
  });

  // --- Feedback list & export ---------------------------------------------
  const feedbackQuery = (q) => ({ ...q, ...(q.from || q.to ? resolveRange(q) : {}) });

  router.get('/feedback', validate(feedbackQuerySchema, 'query'), (req, res) => {
    res.json(feedback.list(feedbackQuery(req.valid.query)));
  });

  router.get('/feedback/export.csv', validate(feedbackQuerySchema, 'query'), (req, res) => {
    const rows = feedback.all(feedbackQuery(req.valid.query)).map((f) => ({
      id: f.id,
      submittedAt: f.submittedAt,
      visitDate: f.visitDate,
      nurse: f.nurse.name,
      family: f.family.contactName,
      patient: f.family.patientName,
      city: f.family.city,
      service: f.service,
      ...f.ratings,
      overall: f.overall,
      recommendScore: f.recommendScore,
      npsGroup: npsGroup(f.recommendScore),
      sentiment: f.sentiment ?? '',
      comment: f.comment ?? '',
      commentHidden: f.commentHidden ? 'yes' : 'no',
      followUpStatus: f.followUp.status,
      followUpNote: f.followUp.note ?? '',
    }));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="carepal-feedback-${toDateOnly(new Date())}.csv"`);
    res.send(toCsv(CSV_COLUMNS, rows));
  });

  // --- Visits & links -----------------------------------------------------
  router.get('/nurses', (_req, res) => res.json(visits.nurses()));
  router.get('/families', (_req, res) => res.json(visits.families()));

  router.get('/visits', validate(visitQuerySchema, 'query'), (req, res) => {
    res.json(visits.list(req.valid.query));
  });

  router.post('/visits', validate(createVisitSchema), (req, res) => {
    res.status(201).json(visits.create(req.valid.body));
  });

  router.post('/visits/:id/link', validate(createLinkSchema), (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) throw new HttpError(400, 'bad_id', 'Invalid visit id.');
    res.status(201).json(links.createForVisit(id, req.valid.body.expiryDays));
  });

  // --- Weekly summary -----------------------------------------------------
  router.get('/summary/preview', (_req, res) => {
    const { subject, html } = summary.build();
    res.json({ subject, html, to: config.opsEmails, smtpConfigured: Boolean(config.smtp.host), schedule: config.summaryCron });
  });

  router.post('/summary/send', async (_req, res, next) => {
    try {
      res.json(await summary.send());
    } catch (err) {
      next(new HttpError(502, 'email_failed', `Could not send the email: ${err.message}`));
    }
  });

  return router;
}
