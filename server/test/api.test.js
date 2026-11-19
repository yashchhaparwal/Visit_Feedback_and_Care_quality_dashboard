import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

const config = {
  isProduction: false,
  serverRoot: '.',
  clientDist: '__no_client_build__',
  outboxDir: '__unused__',
  publicBaseUrl: 'http://app.test',
  linkExpiryDays: 7,
  opsEmails: ['ops@test.local'],
  summaryCron: '0 9 * * 1',
  smtp: { host: '' },
};
const quietLogger = { info() {}, error() {}, warn() {} };

let server;
let base;
let db;

const api = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
};

const goodFeedback = { punctuality: 5, qualityOfCare: 5, hygiene: 4, behaviour: 5, recommendScore: 10, comment: 'Very caring nurse' };

before(async () => {
  db = openDatabase(':memory:');
  seedDatabase(db, config);
  const { app } = createApp({ db, config, logger: quietLogger });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  db?.close();
});

async function newLink(expiryDays) {
  const visits = await api('/api/admin/visits?status=no_link&pageSize=1');
  const visitId = visits.body.items[0].id;
  const link = await api(`/api/admin/visits/${visitId}/link`, { method: 'POST', body: expiryDays ? { expiryDays } : {} });
  assert.equal(link.status, 201);
  return { visitId, token: link.body.token, url: link.body.url };
}

test('dashboard API opens without a login', async () => {
  assert.equal((await api('/api/admin/stats/overview')).status, 200);
});

test('a feedback link works exactly once', async () => {
  const { token, url } = await newLink();
  assert.equal(url, `http://app.test/f/${token}`);

  const view = await api(`/api/public/feedback/${token}`);
  assert.equal(view.status, 200);
  assert.ok(view.body.nurseName);

  const first = await api(`/api/public/feedback/${token}`, { method: 'POST', body: goodFeedback });
  assert.equal(first.status, 201);

  const second = await api(`/api/public/feedback/${token}`, { method: 'POST', body: goodFeedback });
  assert.equal(second.status, 410);
  assert.equal(second.body.error.code, 'link_used');
  assert.equal((await api(`/api/public/feedback/${token}`)).body.error.code, 'link_used');
});

test('concurrent submissions on one link store only one response', async () => {
  const { token, visitId } = await newLink();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => api(`/api/public/feedback/${token}`, { method: 'POST', body: goodFeedback })),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM feedback WHERE visit_id = ?').get(visitId).c, 1);
});

test('expired links are rejected', async () => {
  const { token } = await newLink(1);
  db.prepare("UPDATE feedback_links SET expires_at = '2000-01-01T00:00:00.000Z' WHERE token = ?").run(token);
  const res = await api(`/api/public/feedback/${token}`, { method: 'POST', body: goodFeedback });
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'link_expired');
});

test('unknown tokens and invalid input are rejected', async () => {
  assert.equal((await api('/api/public/feedback/does-not-exist')).status, 404);
  const { token } = await newLink();
  const res = await api(`/api/public/feedback/${token}`, { method: 'POST', body: { ...goodFeedback, hygiene: 9 } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'validation_failed');
  // A rejected submission must not burn the link.
  assert.equal((await api(`/api/public/feedback/${token}`)).status, 200);
});

test('low scores open a follow-up and abusive comments are hidden from staff', async () => {
  const { token, visitId } = await newLink();
  await api(`/api/public/feedback/${token}`, {
    method: 'POST',
    body: { punctuality: 1, qualityOfCare: 2, hygiene: 3, behaviour: 2, recommendScore: 2, comment: 'Bloody useless, came 2 hours late' },
  });
  const followUps = await api('/api/admin/follow-ups');
  const item = followUps.body.find((f) => db.prepare('SELECT visit_id FROM feedback WHERE id = ?').get(f.id).visit_id === visitId);
  assert.ok(item, 'new low score is in the follow-up list');
  assert.equal(item.commentHidden, true);
  assert.equal(item.sentiment, 'negative');
  assert.doesNotMatch(item.comment, /bloody/i);

  const resolved = await api(`/api/admin/feedback/${item.id}/follow-up`, {
    method: 'PATCH', body: { status: 'resolved', note: 'Called family' },
  });
  assert.equal(resolved.body.followUp.status, 'resolved');
});

test('dashboard stats and CSV export', async () => {
  const overview = await api('/api/admin/stats/overview?from=2000-01-01');
  assert.equal(overview.status, 200);
  assert.ok(overview.body.current.responses > 100);
  assert.ok(overview.body.current.nps >= -100 && overview.body.current.nps <= 100);

  const nurses = await api('/api/admin/stats/nurses');
  assert.equal(nurses.body.length, 12);
  assert.ok(nurses.body[0].weekly.length > 0);

  const trend = await api('/api/admin/stats/trend');
  assert.ok(trend.body.length >= 10);

  const csv = await api('/api/admin/feedback/export.csv');
  assert.equal(csv.status, 200);
  const lines = csv.body.trim().split('\r\n');
  assert.match(lines[0], /^﻿?Feedback ID,/);
  const total = db.prepare('SELECT COUNT(*) AS c FROM feedback').get().c;
  assert.ok(lines.length - 1 >= total, 'every response is exported');
  assert.doesNotMatch(csv.body, /bullshit|bloody/i, 'abusive words are hidden in the export');
});

test('visit and feedback lists work with and without every filter', async () => {
  for (const q of ['', '?status=pending', '?status=used&search=a', '?nurseId=1']) {
    const res = await api(`/api/admin/visits${q}`);
    assert.equal(res.status, 200, `visits${q}`);
  }
  for (const q of ['', '?sentiment=none', '?flagged=true&sort=lowest', '?followUp=open&nurseId=2&from=2020-01-01', '?search=late']) {
    const res = await api(`/api/admin/feedback${q}`);
    assert.equal(res.status, 200, `feedback${q}`);
  }
  for (const s of ['open', 'resolved', 'all']) {
    assert.equal((await api(`/api/admin/follow-ups?status=${s}`)).status, 200);
  }
});

test('weekly summary builds', async () => {
  const res = await api('/api/admin/summary/preview');
  assert.equal(res.status, 200);
  assert.match(res.body.subject, /Weekly care quality summary/);
  assert.match(res.body.html, /Open low-score follow-ups/);
});
