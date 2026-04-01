"""Daily Discipline Tracker — FastAPI backend.

Run with:
    uvicorn backend.main:app --reload

API docs available at http://localhost:8000/docs
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any, Dict, List

import aiosqlite
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.database import DB_PATH, init_db, row_to_entry, row_to_reflection
from backend.models import (
    ReflectionData,
    ReflectionDataCreate,
    RiskScore,
    Settings,
    StreakResponse,
    TaskEntry,
    TaskEntryCreate,
    WeeklyAnalysis,
)
from backend.analytics import (
    compute_risk_score,
    compute_streak,
    compute_weekly_analysis,
)


# ── lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


# ── app ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Daily Discipline Tracker API",
    description="Local backend for the DD Tracker habit system.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── internal helpers ───────────────────────────────────────────────────────────

async def _get_all_entries(db: aiosqlite.Connection) -> List[Dict[str, Any]]:
    cursor = await db.execute("SELECT * FROM entries ORDER BY date DESC")
    rows = await cursor.fetchall()
    return [row_to_entry(r) for r in rows]


async def _get_settings_row(db: aiosqlite.Connection) -> Dict[str, Any]:
    cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    return dict(row) if row else {"id": 1, "streak_threshold": 7}


# ── entries ────────────────────────────────────────────────────────────────────

@app.get("/entries", response_model=List[TaskEntry])
async def list_entries() -> List[TaskEntry]:
    """Return all entries sorted by date descending."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        entries = await _get_all_entries(db)
    return [TaskEntry(**e) for e in entries]


@app.get("/entries/{entry_date}", response_model=TaskEntry)
async def get_entry(entry_date: str) -> TaskEntry:
    """Return a single entry by date (YYYY-MM-DD)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM entries WHERE date = ?", (entry_date,)
        )
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No entry for date {entry_date}")
    return TaskEntry(**row_to_entry(row))


@app.post("/entries/{entry_date}", response_model=TaskEntry)
async def upsert_entry(entry_date: str, payload: TaskEntryCreate) -> TaskEntry:
    """Create or update an entry for the given date.

    Edit lock: entries older than yesterday are rejected with 403.
    """
    today = date.today()
    yesterday = today - timedelta(days=1)
    try:
        entry_d = date.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if entry_d < yesterday:
        raise HTTPException(
            status_code=403,
            detail="Entries older than yesterday are locked and cannot be edited.",
        )

    tasks_json = json.dumps(payload.tasks)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO entries
                (date, tasks, task_score, screen_time, productive_time,
                 ratio, ratio_bonus, screen_penalty, final_score,
                 note, reflection, deep_work_done)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                tasks           = excluded.tasks,
                task_score      = excluded.task_score,
                screen_time     = excluded.screen_time,
                productive_time = excluded.productive_time,
                ratio           = excluded.ratio,
                ratio_bonus     = excluded.ratio_bonus,
                screen_penalty  = excluded.screen_penalty,
                final_score     = excluded.final_score,
                note            = excluded.note,
                reflection      = excluded.reflection,
                deep_work_done  = excluded.deep_work_done
            """,
            (
                entry_date,
                tasks_json,
                payload.task_score,
                payload.screen_time,
                payload.productive_time,
                payload.ratio,
                payload.ratio_bonus,
                payload.screen_penalty,
                payload.final_score,
                payload.note,
                payload.reflection,
                int(payload.deep_work_done),
            ),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT * FROM entries WHERE date = ?", (entry_date,)
        )
        row = await cursor.fetchone()

    return TaskEntry(**row_to_entry(row))


# ── reflections ────────────────────────────────────────────────────────────────

@app.get("/reflections", response_model=List[ReflectionData])
async def list_reflections() -> List[ReflectionData]:
    """Return all reflections sorted by date descending."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM reflections ORDER BY date DESC"
        )
        rows = await cursor.fetchall()
    return [ReflectionData(**row_to_reflection(r)) for r in rows]


@app.get("/reflections/{ref_date}", response_model=ReflectionData)
async def get_reflection(ref_date: str) -> ReflectionData:
    """Return a single reflection by date."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM reflections WHERE date = ?", (ref_date,)
        )
        row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No reflection for date {ref_date}")
    return ReflectionData(**row_to_reflection(row))


@app.post("/reflections/{ref_date}", response_model=ReflectionData)
async def upsert_reflection(
    ref_date: str, payload: ReflectionDataCreate
) -> ReflectionData:
    """Create or update a reflection for the given date."""
    tags_json = json.dumps(payload.distraction_tags)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO reflections (date, energy_level, sleep_hours, distraction_tags)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                energy_level     = excluded.energy_level,
                sleep_hours      = excluded.sleep_hours,
                distraction_tags = excluded.distraction_tags
            """,
            (ref_date, payload.energy_level, payload.sleep_hours, tags_json),
        )
        await db.commit()
        cursor = await db.execute(
            "SELECT * FROM reflections WHERE date = ?", (ref_date,)
        )
        row = await cursor.fetchone()
    return ReflectionData(**row_to_reflection(row))


# ── streak ─────────────────────────────────────────────────────────────────────

@app.get("/streak", response_model=StreakResponse)
async def get_streak() -> StreakResponse:
    """Return current streak, longest streak, and last reset date."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        entries = await _get_all_entries(db)
        settings = await _get_settings_row(db)

    result = compute_streak(entries, streak_threshold=settings["streak_threshold"])
    return StreakResponse(**result)


# ── settings ───────────────────────────────────────────────────────────────────

@app.get("/settings", response_model=Settings)
async def get_settings() -> Settings:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        settings = await _get_settings_row(db)
    return Settings(streak_threshold=settings["streak_threshold"])


@app.post("/settings", response_model=Settings)
async def update_settings(payload: Settings) -> Settings:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            "UPDATE settings SET streak_threshold = ? WHERE id = 1",
            (payload.streak_threshold,),
        )
        await db.commit()
    return payload


# ── analytics: weekly ──────────────────────────────────────────────────────────

@app.get("/analytics/weekly", response_model=WeeklyAnalysis)
async def analytics_weekly() -> WeeklyAnalysis:
    """Return a weekly behavioural analysis of the last 7 days."""
    cutoff = (date.today() - timedelta(days=7)).isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        cursor = await db.execute(
            "SELECT * FROM entries WHERE date >= ? ORDER BY date DESC", (cutoff,)
        )
        entry_rows = await cursor.fetchall()
        entries = [row_to_entry(r) for r in entry_rows]

        dates = [e["date"] for e in entries]
        if dates:
            placeholders = ",".join(["?"] * len(dates))
            cursor = await db.execute(
                f"SELECT * FROM reflections WHERE date IN ({placeholders}) ORDER BY date DESC",
                dates,
            )
            ref_rows = await cursor.fetchall()
            reflections = [row_to_reflection(r) for r in ref_rows]
        else:
            reflections = []

    result = compute_weekly_analysis(entries, reflections)
    return WeeklyAnalysis(**result)


# ── analytics: risk ────────────────────────────────────────────────────────────

@app.get("/analytics/risk", response_model=RiskScore)
async def analytics_risk() -> RiskScore:
    """Return a daily failure-risk score based on recent patterns."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Latest entry
        cursor = await db.execute(
            "SELECT * FROM entries ORDER BY date DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        latest_entry = row_to_entry(row) if row else None

        # Last 3 reflections (most recent first)
        cursor = await db.execute(
            "SELECT * FROM reflections ORDER BY date DESC LIMIT 3"
        )
        ref_rows = await cursor.fetchall()
        recent_reflections = [row_to_reflection(r) for r in ref_rows]

        # Current streak
        all_entries = await _get_all_entries(db)
        settings = await _get_settings_row(db)

    streak_data = compute_streak(all_entries, streak_threshold=settings["streak_threshold"])
    current_streak = streak_data["current_streak"]

    result = compute_risk_score(latest_entry, recent_reflections, current_streak)
    return RiskScore(**result)


# ── data import ────────────────────────────────────────────────────────────────

@app.post("/import", summary="Bulk-import entries from ICP JSON export")
async def import_entries(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Accept the JSON format exported by the ICP app and insert all entries.

    Existing rows are skipped (INSERT OR IGNORE) to prevent data loss.

    Expected format:
    {
      "2026-03-20": {
        "tasks": {"deep_work": true, "reading": false, ...},
        "task_score": 8,
        "screen_time": 420,
        ...
      },
      ...
    }
    """
    inserted = 0
    skipped = 0

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        for entry_date, data in payload.items():
            # Normalise tasks: accept both dict {key: bool} and [[key, bool]] list
            raw_tasks = data.get("tasks", {})
            if isinstance(raw_tasks, dict):
                tasks_list = list(raw_tasks.items())
            else:
                tasks_list = raw_tasks

            tasks_json = json.dumps(tasks_list)
            deep_work_done = int(
                any(
                    k in ("deep_work", "Deep Work") and v
                    for k, v in tasks_list
                    if isinstance(v, bool)
                )
            )

            cursor = await db.execute(
                """
                INSERT OR IGNORE INTO entries
                    (date, tasks, task_score, screen_time, productive_time,
                     ratio, ratio_bonus, screen_penalty, final_score,
                     note, reflection, deep_work_done)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_date,
                    tasks_json,
                    data.get("task_score", 0),
                    data.get("screen_time", 0),
                    data.get("productive_time", 0),
                    data.get("ratio", 0.0),
                    data.get("ratio_bonus", 0),
                    data.get("screen_penalty", 0),
                    data.get("final_score", 0),
                    data.get("note", ""),
                    data.get("note", ""),  # old format: map note to reflection field
                    deep_work_done,
                ),
            )
            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1

        await db.commit()

    return {"imported": inserted, "skipped": skipped}
