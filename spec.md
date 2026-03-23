# Daily Discipline Tracker

## Current State
Backend is fully implemented with:
- `saveEntry(date, entry)` - saves/updates an entry
- `getEntry(date)` - retrieves a single entry
- `getAllEntries()` - returns all entries sorted by date descending
- `getStreakData()` - returns current streak, longest streak, last reset date
- `getSettings()` / `saveSettings()` - streak threshold config

Entry structure includes: tasks, task_score, screen_time, productive_time, ratio, ratio_bonus, screen_penalty, final_score, note, reflection, deep_work_done.

Frontend state: unknown (previous build may have partially existed).

## Requested Changes (Diff)

### Add
- History screen: list of all past entries sorted by date (newest first), showing date + final_score per row, each row clickable
- Entry detail view: read-only view of a past entry showing all task completions, score breakdown, screen time, ratio, penalty, reflection note
- Streak counter widget always visible on the main screen (current streak displayed prominently at top)

### Modify
- Main screen: add persistent streak counter at the top (fetched on load and after each save)
- Navigation: add tab or nav bar to switch between Main (today's entry) and History screens

### Remove
- Nothing

## Implementation Plan
1. Build React app with two screens: Main (entry form) and History (list)
2. Main screen: streak counter at top always visible, full entry form below
3. Entry form: Deep Work (minutes), Reading (minutes + insight), Energy (1-5), Off-screen (minutes), Screen time, Productive time, checkboxes for No Time Waste/Fitness/No Fap/No Junk Food/Wake Before 8
4. Scoring logic (frontend): Tier1 (3pts each with threshold validation), Tier2 (2pts each), Tier3 (1pt each), ratio bonus, screen penalty
5. Streak: score >= 8 AND deep_work_done; fetch via getStreakData() on load and after save
6. Edit lock: today and yesterday editable, older entries read-only
7. Reflection prompt if score < 8
8. History screen: call getAllEntries(), render sorted list with date + score, tap to open detail modal/view
9. Detail view: read-only display of all fields for a past entry
