# Daily Discipline Tracker — Behavior Intelligence Upgrade

## Current State

- Motoko backend with `stable var` storage for entries (Entry type with tasks, scores, screen time, reflection text)
- Frontend: TodayPage (habit input, energy execution, time tracking, save/update), HistoryPage (sorted list + detail dialog, JSON export), SettingsPage (streak threshold), App.tsx (sticky header with streak badge, 3-tab nav)
- Scoring: 10 tasks across 4 tiers with point values; ratio bonus (+1/+2); screen penalty (-1/-2/-3)
- Reflection: plain text stored in `Entry.reflection`, triggered when final_score < 8
- Streak: computed server-side from sorted entries using threshold + deep_work_done
- Date handling: `getLocalDateString()` uses browser `new Date()` — vulnerable to midnight bug
- No structured reflection data, no analytics, no charts, no risk scoring

## Requested Changes (Diff)

### Add
- **Structured reflection data**: New `ReflectionData` type stored in a separate stable map by date (energy_level 1–10, sleep_hours float, distraction_tags string array). Stored alongside existing free-text reflection. Backward compatible — old entries have no associated reflection data (returns null).
- **New backend methods**: `saveReflection(date, ReflectionData)`, `getReflection(date)`, `getAllReflections()` returning array of (date, ReflectionData) pairs.
- **Analytics tab**: 4th navigation tab "Analytics" in App.tsx showing: daily risk score, weekly behavioral analysis, trigger chain detection, momentum graph (7-day rolling habit completion %), distraction frequency chart.
- **Weekly analysis engine (frontend)**: Pure deterministic rule-based system in `src/frontend/src/lib/analytics.ts` that processes entries + reflection data to compute: habit completion %, average energy, sleep patterns, distraction tag frequency, trigger chains (Low Sleep → Low Energy → High Distraction → Missed Deep Work), daily risk score.
- **Dashboard charts**: Using recharts (already in shadcn chart.tsx) — screen time vs productivity trend, habit completion trend over last 14 days, momentum graph.
- **Daily risk score widget** on TodayPage: shows computed risk level (Low/Medium/High) based on last 7 days of data.
- **Local Python export package**: Static source files under `local-export/` directory with FastAPI backend, SQLite database, React frontend (minimal), rule-based analysis engine, requirements.txt, README.md.

### Modify
- **Reflection dialog** in TodayPage: add energy_level slider (1–10), sleep_hours numeric input, distraction_tags multi-select checkboxes before/alongside free-text textarea. Save structured data via `saveReflection(date, data)` in addition to existing entry reflection text.
- **`getLocalDateString()`** in `scoring.ts`: use `Intl.DateTimeFormat` with `Asia/Kolkata` timezone to fix midnight date bug.
- **HistoryPage**: add CSV export button alongside existing JSON export. In entry detail dialog, show structured reflection data (energy, sleep, tags) if available.
- **App.tsx**: add "Analytics" tab to navigation.

### Remove
- Nothing removed. All existing features preserved exactly.

## Implementation Plan

1. **Backend (Motoko)**:
   - Add `ReflectionData` type: `{ energy_level: Nat; sleep_hours: Float; distraction_tags: [Text] }`
   - Add `stable var stableReflections: [(Text, ReflectionData)] = []` separate from entries
   - Add `saveReflection`, `getReflection`, `getAllReflections` query/update methods
   - Update `preupgrade`/`postupgrade` to include reflections map
   - Keep existing Entry type and all existing methods unchanged

2. **Frontend analytics lib** (`src/frontend/src/lib/analytics.ts`):
   - `computeWeeklyAnalysis(entries, reflections)` → habit completion %, avg energy, avg sleep, distraction tag counts, trigger chains, improvement suggestions
   - `computeDailyRiskScore(recentEntries, recentReflections)` → { level: 'Low'|'Medium'|'High', reasons: string[], suggestion: string }
   - `detectTriggerChains(entries, reflections)` → detected chain strings
   - `computeMomentumSeries(entries)` → weekly % array for chart

3. **Frontend pages**:
   - `src/frontend/src/pages/AnalyticsPage.tsx`: risk score widget, weekly summary, trigger chains, momentum graph, distraction bar chart
   - Update `TodayPage.tsx`: reflection dialog gets energy/sleep/tags fields; save reflection data on submit; show risk score badge
   - Update `HistoryPage.tsx`: CSV export + show reflection data in detail dialog
   - Update `App.tsx`: add Analytics tab
   - Update `scoring.ts`: fix timezone in `getLocalDateString`
   - Update `useQueries.ts`: add hooks for reflection data

4. **Local export package** (`local-export/`):
   - `backend/main.py`: FastAPI with same endpoints as Motoko backend
   - `backend/models.py`: Pydantic models matching Entry/ReflectionData
   - `backend/database.py`: SQLite setup with migration
   - `backend/analytics.py`: same rule-based engine as frontend
   - `frontend/`: minimal React app or instructions to use existing
   - `requirements.txt`, `README.md`
