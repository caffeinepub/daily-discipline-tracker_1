-- Daily Discipline Tracker — migration script
--
-- Run this on an existing database to add columns/tables introduced
-- after the initial release.
--
-- IMPORTANT: SQLite does not support "ALTER TABLE ... ADD COLUMN IF NOT EXISTS"
-- before version 3.37. If you get a "duplicate column" error, that column
-- already exists — you can safely ignore the error and continue.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS guards are used throughout.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── v1 → v2: add deep_work_done and reflection to entries ─────────────────────
-- Run each ALTER TABLE separately and ignore "duplicate column" errors.

ALTER TABLE entries ADD COLUMN deep_work_done  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN reflection       TEXT NOT NULL DEFAULT '';

-- ── create reflections table if missing ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflections (
    date             TEXT PRIMARY KEY,
    energy_level     INTEGER NOT NULL DEFAULT 0,
    sleep_hours      REAL NOT NULL DEFAULT 0.0,
    distraction_tags TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (date) REFERENCES entries (date)
);

-- ── create settings table if missing ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    streak_threshold INTEGER NOT NULL DEFAULT 7
);

INSERT OR IGNORE INTO settings (id, streak_threshold) VALUES (1, 7);
