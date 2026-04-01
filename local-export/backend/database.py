import json
import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "database" / "dd_tracker.db"


async def get_db() -> aiosqlite.Connection:
    """Open and return an aiosqlite connection with row_factory set."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db() -> None:
    """Create tables if they don't exist and seed default settings."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Enable WAL mode for better concurrency
        await db.execute("PRAGMA journal_mode = WAL")
        await db.execute("PRAGMA foreign_keys = ON")

        # ── entries ────────────────────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                date            TEXT PRIMARY KEY,
                tasks           TEXT NOT NULL DEFAULT '[]',
                task_score      INTEGER NOT NULL DEFAULT 0,
                screen_time     INTEGER NOT NULL DEFAULT 0,
                productive_time INTEGER NOT NULL DEFAULT 0,
                ratio           REAL NOT NULL DEFAULT 0.0,
                ratio_bonus     INTEGER NOT NULL DEFAULT 0,
                screen_penalty  INTEGER NOT NULL DEFAULT 0,
                final_score     INTEGER NOT NULL DEFAULT 0,
                note            TEXT NOT NULL DEFAULT '',
                reflection      TEXT NOT NULL DEFAULT '',
                deep_work_done  INTEGER NOT NULL DEFAULT 0
            )
        """)

        # ── reflections ────────────────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reflections (
                date             TEXT PRIMARY KEY,
                energy_level     INTEGER NOT NULL DEFAULT 0,
                sleep_hours      REAL NOT NULL DEFAULT 0.0,
                distraction_tags TEXT NOT NULL DEFAULT '[]',
                FOREIGN KEY (date) REFERENCES entries (date)
            )
        """)

        # ── settings ───────────────────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id               INTEGER PRIMARY KEY CHECK (id = 1),
                streak_threshold INTEGER NOT NULL DEFAULT 7
            )
        """)

        # ── migration: add columns that may be missing in older DBs ────────────
        existing_cols = {
            row[1]
            async for row in await db.execute("PRAGMA table_info(entries)")
        }
        if "deep_work_done" not in existing_cols:
            await db.execute(
                "ALTER TABLE entries ADD COLUMN deep_work_done INTEGER NOT NULL DEFAULT 0"
            )
        if "reflection" not in existing_cols:
            await db.execute(
                "ALTER TABLE entries ADD COLUMN reflection TEXT NOT NULL DEFAULT ''"
            )

        # ── default settings row ───────────────────────────────────────────────
        await db.execute(
            "INSERT OR IGNORE INTO settings (id, streak_threshold) VALUES (1, 7)"
        )

        await db.commit()


# ── row helpers ────────────────────────────────────────────────────────────────

def row_to_entry(row: aiosqlite.Row) -> dict:
    d = dict(row)
    d["tasks"] = json.loads(d["tasks"])
    d["deep_work_done"] = bool(d["deep_work_done"])
    return d


def row_to_reflection(row: aiosqlite.Row) -> dict:
    d = dict(row)
    d["distraction_tags"] = json.loads(d["distraction_tags"])
    return d
