import cron from 'node-cron';
import { config } from './config.js';
import { openDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { createApp } from './app.js';

const db = openDatabase(config.dbPath);

// First run: fill an empty database with demo data so the dashboard is meaningful.
const { count } = db.prepare('SELECT COUNT(*) AS count FROM nurses').get();
if (count === 0) {
  console.log('[startup] Empty database - seeding demo data...');
  seedDatabase(db, config);
}

const { app, services } = createApp({ db, config });

if (cron.validate(config.summaryCron)) {
  cron.schedule(
    config.summaryCron,
    () => {
      services.summary.send().catch((err) => console.error('[summary] weekly email failed:', err));
    },
    { timezone: 'Asia/Kolkata' },
  );
  console.log(`[summary] Weekly email scheduled: "${config.summaryCron}" (Asia/Kolkata)`);
} else {
  console.warn(`[summary] SUMMARY_CRON "${config.summaryCron}" is not valid - weekly email disabled.`);
}

const server = app.listen(config.port, () => {
  console.log(`[api] Listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
