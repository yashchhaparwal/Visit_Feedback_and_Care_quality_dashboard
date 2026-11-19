import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  serverRoot,
  port: int(process.env.PORT, 4000),
  dbPath: path.resolve(serverRoot, process.env.DB_PATH || 'data/carepal.db'),
  outboxDir: path.resolve(serverRoot, 'outbox'),
  clientDist: path.resolve(serverRoot, '../client/dist'),

  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  linkExpiryDays: int(process.env.LINK_EXPIRY_DAYS, 7),

  opsEmails: (process.env.OPS_EMAILS || 'ops@example.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  summaryCron: process.env.SUMMARY_CRON || '0 9 * * 1',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'TheCarePal Quality <quality@example.com>',
  },
};
