import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/errors.js';
import { submitFeedbackSchema } from './schemas.js';

/** Routes a family hits from their feedback link. No login: the token is the credential. */
export function publicRoutes({ links }) {
  const router = Router();

  // Slows down anyone trying to guess tokens. Generous enough for real families.
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));

  router.get('/feedback/:token', (req, res) => {
    res.json(links.getPublicLink(req.params.token));
  });

  router.post('/feedback/:token', validate(submitFeedbackSchema), (req, res) => {
    links.submit(req.params.token, req.valid.body);
    res.status(201).json({ ok: true });
  });

  return router;
}
