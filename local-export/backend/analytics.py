"""Rule-based behavioural analysis engine.

All logic is deterministic — no external AI dependencies.
The same rules are used by both the weekly analysis and the daily risk scorer.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional


# ── internal helpers ───────────────────────────────────────────────────────────

def _avg(values: List[float]) -> float:
    """Return mean of a non-empty list, else 0.0."""
    return sum(values) / len(values) if values else 0.0


def _top_tag(tags_lists: List[List[str]]) -> Optional[str]:
    """Return the most frequently occurring tag across all lists."""
    counter: Counter = Counter()
    for tags in tags_lists:
        counter.update(tags)
    if not counter:
        return None
    return counter.most_common(1)[0][0]


# ── weekly analysis ────────────────────────────────────────────────────────────

def compute_weekly_analysis(
    entries: List[Dict[str, Any]],
    reflections: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Analyse the last 7 days of entries + reflections.

    Parameters
    ----------
    entries:
        List of entry dicts (filtered to last 7 days, most-recent first).
    reflections:
        Matching reflection dicts for those days.

    Returns
    -------
    dict matching the WeeklyAnalysis schema.
    """
    days = len(entries)

    # ── habit completion ───────────────────────────────────────────────────────
    total_possible = 0
    total_done = 0
    for entry in entries:
        tasks = entry.get("tasks", [])
        for item in tasks:
            # tasks stored as [[key, bool], ...] or [(key, bool), ...]
            if isinstance(item, (list, tuple)) and len(item) == 2:
                total_possible += 1
                if item[1]:
                    total_done += 1
    habit_completion_pct = (total_done / total_possible * 100) if total_possible else 0.0

    # ── average energy & sleep ─────────────────────────────────────────────────
    energy_values = [
        r["energy_level"]
        for r in reflections
        if r.get("energy_level", 0) > 0
    ]
    sleep_values = [
        r["sleep_hours"]
        for r in reflections
        if r.get("sleep_hours", 0.0) > 0.0
    ]
    avg_energy = _avg(energy_values)
    avg_sleep = _avg(sleep_values)

    # ── top distraction tag ────────────────────────────────────────────────────
    all_tag_lists = [r.get("distraction_tags", []) for r in reflections]
    top_distraction = _top_tag(all_tag_lists)

    # ── trigger chain detection ────────────────────────────────────────────────
    trigger_chains = _detect_trigger_chains(entries, reflections)

    # ── actionable suggestions ─────────────────────────────────────────────────
    suggestions = _generate_suggestions(
        habit_completion_pct=habit_completion_pct,
        avg_energy=avg_energy,
        avg_sleep=avg_sleep,
        top_distraction=top_distraction,
        trigger_chains=trigger_chains,
        entries=entries,
    )

    return {
        "habit_completion_pct": round(habit_completion_pct, 1),
        "avg_energy_level": round(avg_energy, 1),
        "avg_sleep_hours": round(avg_sleep, 1),
        "top_distraction": top_distraction,
        "trigger_chains": trigger_chains,
        "suggestions": suggestions,
        "days_analyzed": days,
    }


def _detect_trigger_chains(
    entries: List[Dict[str, Any]],
    reflections: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Detect common behavioural cause-effect chains."""
    chains: List[Dict[str, Any]] = []

    ref_map: Dict[str, Dict[str, Any]] = {r["date"]: r for r in reflections}

    low_sleep_days = 0
    low_energy_days = 0
    missed_deep_work_days = 0
    high_screen_days = 0
    phone_distraction_days = 0

    for entry in entries:
        date = entry["date"]
        ref = ref_map.get(date, {})

        sleep = ref.get("sleep_hours", 0.0)
        energy = ref.get("energy_level", 0)
        screen = entry.get("screen_time", 0)
        deep_work = entry.get("deep_work_done", False)
        tags: List[str] = ref.get("distraction_tags", [])

        if 0 < sleep < 6:
            low_sleep_days += 1
        if 0 < energy <= 3:
            low_energy_days += 1
        if not deep_work:
            missed_deep_work_days += 1
        if screen > 420:
            high_screen_days += 1
        if "Phone distraction" in tags or "Social media" in tags:
            phone_distraction_days += 1

    n = max(len(entries), 1)

    # Pattern A: Low Sleep → Low Energy → Missed Deep Work
    if (
        low_sleep_days >= max(1, n // 3)
        and low_energy_days >= max(1, n // 3)
        and missed_deep_work_days >= max(1, n // 2)
    ):
        chains.append({
            "factors": ["Low Sleep", "Low Energy", "Missed Deep Work"],
            "description": (
                f"Detected {low_sleep_days}/{n} days with low sleep, "
                f"{low_energy_days}/{n} with low energy, and "
                f"{missed_deep_work_days}/{n} with missed deep work. "
                "Poor sleep directly impairs cognitive energy, making deep work unlikely."
            ),
        })

    # Pattern B: Low Energy → High Screen Time → Missed Deep Work
    if (
        low_energy_days >= max(1, n // 3)
        and high_screen_days >= max(1, n // 3)
        and missed_deep_work_days >= max(1, n // 2)
    ):
        chains.append({
            "factors": ["Low Energy", "High Screen Time", "Missed Deep Work"],
            "description": (
                f"Detected {low_energy_days}/{n} low-energy days coinciding with "
                f"{high_screen_days}/{n} high-screen-time days. "
                "Low energy tends to drive passive screen consumption instead of focused work."
            ),
        })

    # Pattern C: Phone / Social Media distraction → Missed Deep Work
    if (
        phone_distraction_days >= max(1, n // 3)
        and missed_deep_work_days >= max(1, n // 2)
    ):
        chains.append({
            "factors": ["Phone / Social Media Distraction", "Missed Deep Work"],
            "description": (
                f"Phone or social media tagged on {phone_distraction_days}/{n} days, "
                f"with deep work missed on {missed_deep_work_days}/{n} days. "
                "Device access during work hours is breaking focus sessions."
            ),
        })

    return chains


def _generate_suggestions(
    habit_completion_pct: float,
    avg_energy: float,
    avg_sleep: float,
    top_distraction: Optional[str],
    trigger_chains: List[Dict[str, Any]],
    entries: List[Dict[str, Any]],
) -> List[str]:
    suggestions: List[str] = []

    if avg_sleep > 0 and avg_sleep < 6:
        suggestions.append(
            f"Average sleep is {avg_sleep:.1f} h — aim for at least 7 h to restore cognitive energy."
        )

    if avg_energy > 0 and avg_energy < 4:
        suggestions.append(
            "Average energy is low. Schedule deep work in your highest-energy window (usually morning)."
        )

    if habit_completion_pct < 50:
        suggestions.append(
            f"Only {habit_completion_pct:.0f}% of habits completed this week. "
            "Reduce optional commitments and protect your core habits."
        )

    if top_distraction in ("Phone distraction", "Social media"):
        suggestions.append(
            "Phone/social media is your top distraction. "
            "Remove your phone from your workspace before starting deep work."
        )
    elif top_distraction == "Poor planning":
        suggestions.append(
            "Poor planning keeps recurring. Write tomorrow's top 3 tasks the night before."
        )
    elif top_distraction == "Procrastination":
        suggestions.append(
            "Procrastination is the top pattern. Use a 2-minute start rule: "
            "open the task and work for exactly 2 minutes before deciding to stop."
        )
    elif top_distraction == "Low energy":
        suggestions.append(
            "Low energy is the primary obstacle. Prioritise sleep, hydration, and "
            "schedule demanding tasks earlier in the day."
        )

    # Chain-based suggestions
    chain_factors = {f for c in trigger_chains for f in c["factors"]}
    if "Low Sleep" in chain_factors and "Missed Deep Work" in chain_factors:
        suggestions.append(
            "Sleep is directly correlated with missed deep work. "
            "Set a hard sleep deadline and treat it like a non-negotiable task."
        )

    # Check average screen time
    screen_values = [e["screen_time"] for e in entries if e.get("screen_time", 0) > 0]
    if screen_values and _avg(screen_values) > 360:
        suggestions.append(
            f"Average screen time is {_avg(screen_values):.0f} min/day. "
            "Install a screen-time limiter and set a 300-minute daily cap."
        )

    if not suggestions:
        suggestions.append(
            "Solid week. Keep your current routine and incrementally raise the bar."
        )

    return suggestions


# ── daily risk score ───────────────────────────────────────────────────────────

def compute_risk_score(
    latest_entry: Optional[Dict[str, Any]],
    recent_reflections: List[Dict[str, Any]],  # most-recent first, up to 3
    current_streak: int,
) -> Dict[str, Any]:
    """Compute a 0-100 risk score for today's likelihood of failure.

    Risk points:
    - last entry final_score < 5        → +25
    - last entry no deep work           → +20
    - avg sleep (last 3) < 6 h          → +25
    - avg energy (last 3) <= 3          → +20
    - last entry screen_time > 420 min  → +15
    - current_streak == 0               → +10
    """
    risk = 0
    reasons: List[str] = []
    suggestions: List[str] = []

    if latest_entry:
        if latest_entry.get("final_score", 10) < 5:
            risk += 25
            reasons.append(
                f"Last entry score was {latest_entry['final_score']} (below 5)."
            )
            suggestions.append(
                "Identify the specific task that failed yesterday and address it first today."
            )

        if not latest_entry.get("deep_work_done", True):
            risk += 20
            reasons.append("Deep work was not completed yesterday.")
            suggestions.append(
                "Block the first 2 hours of today exclusively for deep work before any screen time."
            )

        if latest_entry.get("screen_time", 0) > 420:
            risk += 15
            reasons.append(
                f"Screen time was {latest_entry['screen_time']} min yesterday (above 7 h)."
            )
            suggestions.append(
                "Cap screen time to 300 min today. Set a phone-away rule during work blocks."
            )

    # Sleep & energy from last 3 reflections
    sleep_vals = [
        r["sleep_hours"]
        for r in recent_reflections
        if r.get("sleep_hours", 0.0) > 0.0
    ]
    energy_vals = [
        r["energy_level"]
        for r in recent_reflections
        if r.get("energy_level", 0) > 0
    ]

    if sleep_vals:
        avg_sleep = _avg(sleep_vals)
        if avg_sleep < 6:
            risk += 25
            reasons.append(
                f"Average sleep over the last {len(sleep_vals)} night(s) is {avg_sleep:.1f} h."
            )
            suggestions.append("Go to sleep at least 7.5 hours before your alarm tonight.")

    if energy_vals:
        avg_energy = _avg(energy_vals)
        if avg_energy <= 3:
            risk += 20
            reasons.append(
                f"Average energy level over the last {len(energy_vals)} day(s) is {avg_energy:.1f}/10."
            )
            suggestions.append(
                "Start with a short physical warm-up before attempting deep work."
            )

    if current_streak == 0:
        risk += 10
        reasons.append("Current streak is 0 — no positive momentum.")
        suggestions.append(
            "Use today to start a new streak. One full session of deep work changes the trajectory."
        )

    # Clamp to 0-100
    risk = min(risk, 100)

    if risk >= 60:
        level = "High"
    elif risk >= 30:
        level = "Medium"
    else:
        level = "Low"

    if not reasons:
        reasons.append("No major risk factors detected based on recent data.")
    if not suggestions:
        suggestions.append(
            "Keep the current routine. Start deep work early to lock in the streak."
        )

    return {
        "score": risk,
        "level": level,
        "reasons": reasons,
        "suggestions": suggestions,
    }


# ── streak computation ─────────────────────────────────────────────────────────

def compute_streak(
    entries: List[Dict[str, Any]],  # ALL entries
    streak_threshold: int = 7,
) -> Dict[str, Any]:
    """Count current and longest streaks.

    A streak day requires:
    - final_score >= streak_threshold
    - deep_work_done == True
    """
    if not entries:
        return {"current_streak": 0, "longest_streak": 0, "last_reset_date": None}

    # Sort most-recent first
    sorted_entries = sorted(entries, key=lambda e: e["date"], reverse=True)

    # Current streak: count from the most recent entry backwards
    current = 0
    for entry in sorted_entries:
        qualifies = (
            entry.get("final_score", 0) >= streak_threshold
            and entry.get("deep_work_done", False)
        )
        if qualifies:
            current += 1
        else:
            break

    # Longest streak: scan in chronological order
    longest = 0
    run = 0
    last_reset: Optional[str] = None
    for entry in reversed(sorted_entries):
        qualifies = (
            entry.get("final_score", 0) >= streak_threshold
            and entry.get("deep_work_done", False)
        )
        if qualifies:
            run += 1
            longest = max(longest, run)
        else:
            if run > 0:
                last_reset = entry["date"]
            run = 0

    if current == 0 and sorted_entries:
        last_reset = sorted_entries[0]["date"]

    return {
        "current_streak": current,
        "longest_streak": longest,
        "last_reset_date": last_reset,
    }
