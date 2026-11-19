import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { createLinkService } from './services/linkService.js';
import { createStatsService } from './services/statsService.js';
import { createFeedbackService } from './services/feedbackService.js';
import { createVisitService } from './services/visitService.js';
import { createSummaryService } from './services/summaryService.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';
import { errorHandler, notFound } from './middleware/errors.js';

/** Wires services and routes together. Kept separate from index.js so tests can build an app on an in-memory DB. */
export function createApp({ db, config, logger = console }) {
  const links = createLinkService(db, config);
  const stats = createStatsService(db);
  const feedback = createFeedbackService(db);
  const visits = createVisitService(db, links);
  const summary = createSummaryService({ stats, feedback, config, logger });

  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // The summary preview renders server-built HTML in a sandboxed iframe via srcdoc.
          'frame-src': ["'self'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/public', publicRoutes({ links }));
  app.use('/api/admin', adminRoutes({ config, stats, feedback, links, visits, summary }));
  app.use('/api', notFound);

  // In production the API also serves the built React app.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(errorHandler(logger));
  return { app, services: { links, stats, feedback, visits, summary } };
}
