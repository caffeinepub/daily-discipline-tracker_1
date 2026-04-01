# Daily Discipline Tracker — Local Export

A fully self-contained local version of the DD Tracker that runs on your
own machine. Data is stored in a local SQLite file — no cloud, no canister,
no network dependency.

---

## Prerequisites

- Python 3.10 or higher
- pip (comes with Python)

---

## Installation

```bash
# 1. Enter the extracted directory
cd dd-tracker

# 2. (Recommended) create a virtual environment
python -m venv .venv
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows PowerShell

# 3. Install dependencies
pip install -r requirements.txt
```

---

## Running the backend

```bash
uvicorn backend.main:app --reload
```

The API is now running at **http://localhost:8000**.

| URL                              | Description              |
|----------------------------------|--------------------------|
| http://localhost:8000/docs       | Swagger UI (interactive) |
| http://localhost:8000/redoc      | ReDoc documentation      |

The SQLite database file is created automatically at
`database/dd_tracker.db` on first startup.

---

## Project structure

```
dd-tracker/
  backend/
    __init__.py     package marker
    main.py         FastAPI app — all HTTP endpoints
    models.py       Pydantic request/response models
    database.py     SQLite setup, table creation, migration helpers
    analytics.py    Rule-based analysis engine (no API keys required)
  frontend/
    README.md       Instructions for connecting a frontend
  database/
    schema.sql      Full schema (for fresh installs via sqlite3 CLI)
    migrate.sql     Incremental migration (for existing databases)
    dd_tracker.db   Created automatically at runtime (git-ignored)
  requirements.txt
  README.md         This file
```

---

## Importing existing data from the ICP app

If you previously used the ICP-deployed version and exported your data
(History tab → Export JSON), you can import it into the local version:

**Using curl:**
```bash
curl -X POST http://localhost:8000/import \
     -H "Content-Type: application/json" \
     -d @your_export_file.json
```

**Using the Swagger UI:**
1. Open http://localhost:8000/docs
2. Find `POST /import`
3. Paste your JSON export and click Execute

The import is **additive** — existing entries are never overwritten or
deleted. Only new dates are inserted. You will receive a count of how many
entries were imported vs. skipped.

### Expected JSON format (ICP export)

```json
{
  "2026-03-20": {
    "tasks": {"deep_work": true, "reading": false, "energy_execution": true},
    "task_score": 8,
    "screen_time": 420,
    "productive_time": 120,
    "ratio": 0.28,
    "ratio_bonus": 0,
    "screen_penalty": 2,
    "final_score": 6,
    "note": "Felt tired, no deep focus."
  }
}
```

Both `{"key": bool}` dict format and `[["key", bool]]` list format are
accepted automatically.

---

## API endpoints

| Method | Path                  | Description                              |
|--------|-----------------------|------------------------------------------|
| GET    | /entries              | All entries, sorted date descending      |
| GET    | /entries/{date}       | Single entry (404 if not found)          |
| POST   | /entries/{date}       | Create / update entry (edit-lock: 403 for dates older than yesterday) |
| GET    | /reflections          | All reflections                          |
| GET    | /reflections/{date}   | Single reflection                        |
| POST   | /reflections/{date}   | Create / update reflection               |
| GET    | /streak               | Current + longest streak                 |
| GET    | /settings             | Current settings                         |
| POST   | /settings             | Update settings                          |
| GET    | /analytics/weekly     | Weekly behavioural analysis (last 7 days)|
| GET    | /analytics/risk       | Today's failure risk score (0–100)       |
| POST   | /import               | Bulk-import from ICP JSON export         |

Full request/response schemas at http://localhost:8000/docs.

---

## Edit lock

The backend enforces the same policy as the ICP app:

- **Today** and **yesterday** — editable via `POST /entries/{date}`.
- **Older dates** — returns `403 Forbidden`.

---

## Scoring system (reference)

| Tier            | Task                  | Points | Condition                        |
|-----------------|-----------------------|--------|----------------------------------|
| Tier 1          | Deep Work             | 3      | ≥ 120 min                        |
| Tier 1          | Reading               | 3      | ≥ 30 min + 1 insight             |
| Tier 1          | Energy Execution      | 3      | Rating ≥ 3 AND action done       |
| Tier 2          | No Time Waste         | 2      | Yes/No                           |
| Tier 2          | Off-screen Time       | 2      | ≥ 30 min                         |
| Tier 2          | Fitness               | 2      | ≥ 20 min                         |
| Tier 3          | No Fap                | 1      | Yes/No                           |
| Tier 3          | No Junk Food          | 1      | Yes/No                           |
| Tier 3          | Wake Before 8         | 1      | Yes/No                           |
| Ratio Bonus     | Productive / Screen   | +2/+1  | ≥ 60% → +2, ≥ 40% → +1          |
| Screen Penalty  | Screen time           | 0–−4   | ≥ 600 min → −4, 420–600 → −2, 300–420 → −1 |

**Final Score** = Tier1 + Tier2 + Tier3 + Ratio Bonus − Screen Penalty

**Streak** = consecutive days with score ≥ threshold (default 7) AND deep work done.

---

## Analytics

The analytics engine is fully deterministic — no API keys, no internet
required. All analysis runs locally from your own data.

### Weekly analysis (`GET /analytics/weekly`)

Analyses the last 7 days and returns:

- `habit_completion_pct` — percentage of habits completed
- `avg_energy_level` — average energy from reflections (0 = no data)
- `avg_sleep_hours` — average sleep from reflections (0 = no data)
- `top_distraction` — most common distraction tag across reflections
- `trigger_chains` — detected cause-effect patterns, e.g.:
  - Low Sleep → Low Energy → Missed Deep Work
  - Low Energy → High Screen Time → Missed Deep Work
  - Phone / Social Media Distraction → Missed Deep Work
- `suggestions` — actionable improvement suggestions based on the detected patterns

### Daily risk score (`GET /analytics/risk`)

Estimates today's failure risk on a 0–100 scale.

| Signal                              | Risk points |
|-------------------------------------|-------------|
| Last entry score < 5                | +25         |
| Last entry: deep work not done      | +20         |
| Avg sleep (last 3 nights) < 6 h     | +25         |
| Avg energy (last 3 days) ≤ 3        | +20         |
| Last entry screen time > 420 min    | +15         |
| Current streak = 0                  | +10         |

Risk levels: **High** ≥ 60 · **Medium** ≥ 30 · **Low** < 30

---

## Extending with OpenAI / Ollama (future)

`analytics.py` uses plain Python functions with no external dependencies.
To replace or augment with an LLM:

1. Add `openai` or `ollama` to `requirements.txt`.
2. Create `backend/ai_analysis.py` implementing the same function signatures:
   - `compute_weekly_analysis(entries, reflections) -> dict`
   - `compute_risk_score(latest_entry, recent_reflections, current_streak) -> dict`
3. In `main.py`, swap the import:
   ```python
   # from backend.analytics import ...
   from backend.ai_analysis import ...
   ```

No other changes needed.

---

## Data safety

- SQLite WAL mode is enabled for better write concurrency and crash safety.
- The import endpoint uses `INSERT OR IGNORE` — it never overwrites existing data.
- Entry upserts use `ON CONFLICT DO UPDATE` — safe idempotent writes.
- **Back up `database/dd_tracker.db` regularly** to preserve your history.
  A simple daily cron job copying the file is sufficient.
