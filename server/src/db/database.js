import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nurses (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  specialization  TEXT NOT NULL,
  city            TEXT NOT NULL,
  joined_on       TEXT NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS families (
  id            INTEGER PRIMARY KEY,
  contact_name  TEXT NOT NULL,
  patient_name  TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  city          TEXT NOT NULL,
  care_type     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id          INTEGER PRIMARY KEY,
  nurse_id    INTEGER NOT NULL REFERENCES nurses(id),
  family_id   INTEGER NOT NULL REFERENCES families(id),
  visit_date  TEXT NOT NULL,             -- YYYY-MM-DD
  shift       TEXT NOT NULL,             -- day | night | 24h
  service     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_nurse ON visits(nurse_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);

-- One feedback link per visit. A link can be used once and expires at expires_at.
CREATE TABLE IF NOT EXISTS feedback_links (
  id          INTEGER PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  visit_id    INTEGER NOT NULL UNIQUE REFERENCES visits(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id                     INTEGER PRIMARY KEY,
  link_id                INTEGER NOT NULL UNIQUE REFERENCES feedback_links(id),
  visit_id               INTEGER NOT NULL UNIQUE REFERENCES visits(id),
  punctuality            INTEGER NOT NULL CHECK (punctuality BETWEEN 1 AND 5),
  quality_of_care        INTEGER NOT NULL CHECK (quality_of_care BETWEEN 1 AND 5),
  hygiene                INTEGER NOT NULL CHECK (hygiene BETWEEN 1 AND 5),
  behaviour              INTEGER NOT NULL CHECK (behaviour BETWEEN 1 AND 5),
  overall                REAL NOT NULL,     -- mean of the four ratings
  recommend_score        INTEGER NOT NULL CHECK (recommend_score BETWEEN 0 AND 10),
  comment                TEXT,              -- stored as written; masked on read
  comment_flagged        INTEGER NOT NULL DEFAULT 0,
  sentiment              TEXT,              -- positive | neutral | negative | NULL (no comment)
  sentiment_score        INTEGER,
  needs_follow_up        INTEGER NOT NULL DEFAULT 0,
  follow_up_status       TEXT NOT NULL DEFAULT 'none',  -- none | open | resolved
  follow_up_note         TEXT,
  follow_up_resolved_at  TEXT,
  submitted_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted ON feedback(submitted_at);
CREATE INDEX IF NOT EXISTS idx_feedback_follow_up ON feedback(follow_up_status);
`;

/**
 * Opens (and creates if needed) the SQLite database and applies the schema.
 * Pass ':memory:' for tests.
 */
export function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/**
 * node:sqlite rejects named parameters a statement doesn't use. Queries built from
 * optional filters share one params object, so pass each statement only its own.
 */
export function paramsFor(sql, params) {
  return Object.fromEntries(Object.entries(params).filter(([k]) => new RegExp(`[:@$]${k}\\b`).test(sql)));
}

/** Runs fn inside a transaction, rolling back if it throws. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
