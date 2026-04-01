import type { EntryWithDate, ReflectionWithDate } from "../backend.d";

export type RiskLevel = "Low" | "Medium" | "High";

export interface DailyRiskScore {
  level: RiskLevel;
  score: number;
  reasons: string[];
  suggestion: string;
}

export interface WeeklyAnalysis {
  habitCompletionPct: number;
  avgEnergyLevel: number;
  avgSleepHours: number;
  distractionFrequency: Record<string, number>;
  topDistraction: string | null;
  triggerChains: string[];
  suggestions: string[];
  daysAnalyzed: number;
}

export interface MomentumPoint {
  label: string;
  completionPct: number;
  avgScore: number;
}

function getLast7Days(entries: EntryWithDate[]): EntryWithDate[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= cutoffStr);
}

function getLast3DaysReflections(
  reflections: ReflectionWithDate[],
): ReflectionWithDate[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return reflections.filter((r) => r.date >= cutoffStr);
}

export function computeDailyRiskScore(
  entries: EntryWithDate[],
  reflections: ReflectionWithDate[],
): DailyRiskScore {
  let risk = 0;
  const reasons: string[] = [];

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const last = sorted[0];

  if (last) {
    const score = Number(last.entry.final_score);
    if (score < 5) {
      risk += 25;
      reasons.push(`Last score was ${score} (very low)`);
    } else if (score < 8 && !last.entry.deep_work_done) {
      risk += 20;
      reasons.push("Last entry: below threshold and no deep work");
    }
    if (Number(last.entry.screen_time) > 420) {
      risk += 15;
      reasons.push("High screen time yesterday (>7h)");
    }
  }

  // Check streak
  const streakBroken =
    sorted.length > 0 && Number(sorted[0].entry.final_score) < 8;
  if (streakBroken) {
    risk += 10;
    reasons.push("Recent streak failure");
  }

  // Check sleep from last 3 days reflections
  const recent3 = getLast3DaysReflections(reflections).filter(
    (r) => r.data.sleep_hours > 0,
  );
  if (recent3.length > 0) {
    const avgSleep =
      recent3.reduce((s, r) => s + r.data.sleep_hours, 0) / recent3.length;
    if (avgSleep < 6) {
      risk += 25;
      reasons.push(`Low avg sleep (${avgSleep.toFixed(1)}h over recent days)`);
    }
  }

  // Check energy level
  const recent3Energy = getLast3DaysReflections(reflections).filter(
    (r) => Number(r.data.energy_level) > 0,
  );
  if (recent3Energy.length > 0) {
    const avgEnergy =
      recent3Energy.reduce((s, r) => s + Number(r.data.energy_level), 0) /
      recent3Energy.length;
    if (avgEnergy <= 3) {
      risk += 20;
      reasons.push(`Low avg energy (${avgEnergy.toFixed(1)}/10)`);
    }
  }

  const capped = Math.min(risk, 100);
  const level: RiskLevel =
    capped >= 60 ? "High" : capped >= 30 ? "Medium" : "Low";

  let suggestion = "Maintain your current habits and stay disciplined.";
  if (level === "High") {
    suggestion =
      "Start deep work early before energy drops. Remove distractions now.";
  } else if (level === "Medium") {
    suggestion = "Be intentional today. Front-load your hardest tasks.";
  }

  return { level, score: capped, reasons, suggestion };
}

export function computeWeeklyAnalysis(
  entries: EntryWithDate[],
  reflections: ReflectionWithDate[],
): WeeklyAnalysis {
  const week = getLast7Days(entries);
  const daysAnalyzed = week.length;

  // Habit completion %
  let totalPossible = 0;
  let totalDone = 0;
  for (const e of week) {
    for (const [, done] of e.entry.tasks) {
      totalPossible++;
      if (done) totalDone++;
    }
  }
  const habitCompletionPct =
    totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  // Avg energy & sleep from reflections in last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const weekReflections = reflections.filter((r) => r.date >= cutoffStr);

  const energyRefs = weekReflections.filter(
    (r) => Number(r.data.energy_level) > 0,
  );
  const avgEnergyLevel =
    energyRefs.length > 0
      ? energyRefs.reduce((s, r) => s + Number(r.data.energy_level), 0) /
        energyRefs.length
      : 0;

  const sleepRefs = weekReflections.filter((r) => r.data.sleep_hours > 0);
  const avgSleepHours =
    sleepRefs.length > 0
      ? sleepRefs.reduce((s, r) => s + r.data.sleep_hours, 0) / sleepRefs.length
      : 0;

  // Distraction frequency
  const distractionFrequency: Record<string, number> = {};
  for (const ref of weekReflections) {
    for (const tag of ref.data.distraction_tags) {
      distractionFrequency[tag] = (distractionFrequency[tag] ?? 0) + 1;
    }
  }
  const topDistraction =
    Object.keys(distractionFrequency).sort(
      (a, b) => distractionFrequency[b] - distractionFrequency[a],
    )[0] ?? null;

  const triggerChains = detectTriggerChains(entries, reflections);

  const suggestions: string[] = [];
  if (habitCompletionPct < 50) {
    suggestions.push(
      "Habit completion is below 50%. Focus on fewer, higher-impact tasks first.",
    );
  }
  if (avgSleepHours > 0 && avgSleepHours < 6) {
    suggestions.push(
      "Sleep is critically low. Prioritize sleep to stabilize energy and focus.",
    );
  }
  if (avgEnergyLevel > 0 && avgEnergyLevel <= 3) {
    suggestions.push(
      "Energy is consistently low. Check sleep, nutrition, and morning routine.",
    );
  }
  if (topDistraction) {
    suggestions.push(
      `Most common distraction: ${topDistraction}. Create a dedicated removal plan.`,
    );
  }
  if (suggestions.length === 0) {
    suggestions.push("Keep the current momentum. Focus on consistency.");
  }

  return {
    habitCompletionPct,
    avgEnergyLevel,
    avgSleepHours,
    distractionFrequency,
    topDistraction,
    triggerChains,
    suggestions,
    daysAnalyzed,
  };
}

export function detectTriggerChains(
  entries: EntryWithDate[],
  reflections: ReflectionWithDate[],
): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const weekEntries = entries.filter((e) => e.date >= cutoffStr);
  const weekRefs = reflections.filter((r) => r.date >= cutoffStr);

  const refMap: Record<string, ReflectionWithDate> = {};
  for (const r of weekRefs) refMap[r.date] = r;

  let chain1Count = 0; // Low Sleep + Low Energy + Missed Deep Work
  let chain2Count = 0; // High Screen + Low Productivity
  let chain3Count = 0; // Low Energy + Phone/Social

  for (const e of weekEntries) {
    const ref = refMap[e.date];
    const deepWorkDone = e.entry.deep_work_done;
    const screenTime = Number(e.entry.screen_time);
    const ratio = e.entry.ratio;

    if (ref) {
      const sleep = ref.data.sleep_hours;
      const energy = Number(ref.data.energy_level);
      const tags = ref.data.distraction_tags;

      if (
        sleep > 0 &&
        sleep < 6 &&
        energy > 0 &&
        energy <= 3 &&
        !deepWorkDone
      ) {
        chain1Count++;
      }
      if (
        energy > 0 &&
        energy <= 3 &&
        (tags.includes("Phone distraction") || tags.includes("Social media"))
      ) {
        chain3Count++;
      }
    }

    if (screenTime > 420 && ratio < 0.4) {
      chain2Count++;
    }
  }

  const chains: string[] = [];
  if (chain1Count >= 2) {
    chains.push("Low Sleep → Low Energy → Missed Deep Work");
  }
  if (chain2Count >= 2) {
    chains.push("High Screen Time → Low Productivity");
  }
  if (chain3Count >= 2) {
    chains.push("Low Energy → Phone Distraction → Missed Work");
  }

  return chains;
}

export function computeMomentumSeries(
  entries: EntryWithDate[],
): MomentumPoint[] {
  const points: MomentumPoint[] = [];

  for (let week = 3; week >= 0; week--) {
    const end = new Date();
    end.setDate(end.getDate() - week * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const weekEntries = entries.filter(
      (e) => e.date >= startStr && e.date <= endStr,
    );

    let totalPossible = 0;
    let totalDone = 0;
    let totalScore = 0;

    for (const e of weekEntries) {
      for (const [, done] of e.entry.tasks) {
        totalPossible++;
        if (done) totalDone++;
      }
      totalScore += Number(e.entry.final_score);
    }

    const completionPct =
      totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
    const avgScore =
      weekEntries.length > 0
        ? Math.round((totalScore / weekEntries.length) * 10) / 10
        : 0;

    const label = week === 0 ? "This week" : `${week}w ago`;
    points.push({ label, completionPct, avgScore });
  }

  return points;
}
