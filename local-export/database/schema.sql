-- Daily Discipline Tracker — SQLite schema
-- Run this file to create a fresh database from scratch.
-- For migrations on an existing database use migrate.sql instead.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── entries ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entries (
    date            TEXT PRIMARY KEY,           -- YYYY-MM-DD
    tasks           TEXT NOT NULL DEFAULT '[]', -- JSON [[key, bool], ...]
    task_score      INTEGER NOT NULL DEFAULT 0,
    screen_time     INTEGER NOT NULL DEFAULT 0, -- minutes
    productive_time INTEGER NOT NULL DEFAULT 0, -- minutes
    ratio           REAL NOT NULL DEFAULT 0.0,  -- 0.0 – 1.0
    ratio_bonus     INTEGER NOT NULL DEFAULT 0,
    screen_penalty  INTEGER NOT NULL DEFAULT 0,
    final_score     INTEGER NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT '',
    reflection      TEXT NOT NULL DEFAULT '',
    deep_work_done  INTEGER NOT NULL DEFAULT 0  -- 0 or 1 (boolean)
);

-- ── reflections ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reflections (
    date             TEXT PRIMARY KEY,            -- YYYY-MM-DD (FK → entries.date)
    energy_level     INTEGER NOT NULL DEFAULT 0,  -- 1-10, 0 = not logged
    sleep_hours      REAL NOT NULL DEFAULT 0.0,   -- hours, 0 = not logged
    distraction_tags TEXT NOT NULL DEFAULT '[]',  -- JSON ["tag", ...]
    FOREIGN KEY (date) REFERENCES entries (date)
);

-- ── settings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id               INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row
    streak_threshold INTEGER NOT NULL DEFAULT 7
);

-- Default settings row
INSERT OR IGNORE INTO settings (id, streak_threshold) VALUES (1, 7);
