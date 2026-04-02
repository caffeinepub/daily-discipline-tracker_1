import type { Entry, Tasks } from "../backend.d";

export const TASK_DEFINITIONS = [
  { key: "deep_work", label: "Deep Work (≥ 2 hrs)", tier: 1, points: 2 },
  { key: "energy_execution", label: "Energy Execution", tier: 1, points: 2 },
  { key: "fitness", label: "Fitness", tier: 1, points: 2 },
  { key: "reading", label: "Reading (10+ pages)", tier: 2, points: 1 },
  { key: "writing", label: "Writing / Thinking", tier: 2, points: 1 },
  {
    key: "off_screen",
    label: "Off-screen / Dopamine control",
    tier: 2,
    points: 1,
  },
  { key: "no_fap", label: "No Fap", tier: 3, points: 1 },
  { key: "no_junk", label: "No Junk", tier: 3, points: 1 },
  { key: "wake_early", label: "Wake Before 8", tier: 3, points: 1 },
  {
    key: "energy_reset",
    label: "Energy Reset (sunlight/walk)",
    tier: 4,
    points: 1,
  },
] as const;

export type TaskKey = (typeof TASK_DEFINITIONS)[number]["key"];

export function parseTimeToMinutes(input: string): number | null {
  if (!input.trim()) return null;
  const trimmed = input.trim().toLowerCase();

  // Try "Xh Ym" or "Xh" or "Ym"
  const hm = trimmed.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/);
  if (hm && (hm[1] || hm[2])) {
    const h = hm[1] ? Number.parseInt(hm[1]) : 0;
    const m = hm[2] ? Number.parseInt(hm[2]) : 0;
    return h * 60 + m;
  }

  // Try "H:MM"
  const colon = trimmed.match(/^(\d+):(\d{2})$/);
  if (colon) {
    return Number.parseInt(colon[1]) * 60 + Number.parseInt(colon[2]);
  }

  // Plain number (assume minutes)
  const plain = trimmed.match(/^(\d+)$/);
  if (plain) return Number.parseInt(plain[1]);

  return null;
}

export function minutesToDisplay(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function tasksToMap(tasks: Tasks): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const [k, v] of tasks) map[k] = v;
  return map;
}

export function mapToTasks(map: Record<string, boolean>): Tasks {
  return TASK_DEFINITIONS.map(
    (t) => [t.key, map[t.key] ?? false] as [string, boolean],
  );
}

export function calculateScore(
  taskMap: Record<string, boolean>,
  screenMinutes: number,
  productiveMinutes: number,
): {
  task_score: number;
  deep_work_done: boolean;
  ratio: number;
  ratio_bonus: number;
  screen_penalty: number;
  final_score: number;
} {
  let task_score = 0;
  for (const t of TASK_DEFINITIONS) {
    if (taskMap[t.key]) task_score += t.points;
  }

  const deep_work_done = taskMap.deep_work === true;
  const ratio = screenMinutes > 0 ? productiveMinutes / screenMinutes : 0;

  let ratio_bonus = 0;
  if (ratio >= 0.6) ratio_bonus = 2;
  else if (ratio >= 0.4) ratio_bonus = 1;

  let screen_penalty = 0;
  if (screenMinutes >= 600) screen_penalty = 3;
  else if (screenMinutes >= 420) screen_penalty = 2;
  else if (screenMinutes >= 300) screen_penalty = 1;

  const final_score = task_score + ratio_bonus - screen_penalty;

  return {
    task_score,
    deep_work_done,
    ratio,
    ratio_bonus,
    screen_penalty,
    final_score,
  };
}

export function buildEntry(
  taskMap: Record<string, boolean>,
  screenMinutes: number,
  productiveMinutes: number,
  note: string,
  reflection: string,
): Entry {
  const {
    task_score,
    deep_work_done,
    ratio,
    ratio_bonus,
    screen_penalty,
    final_score,
  } = calculateScore(taskMap, screenMinutes, productiveMinutes);

  return {
    tasks: mapToTasks(taskMap),
    task_score: BigInt(task_score),
    deep_work_done,
    screen_time: BigInt(screenMinutes),
    productive_time: BigInt(productiveMinutes),
    ratio,
    ratio_bonus: BigInt(ratio_bonus),
    screen_penalty: BigInt(screen_penalty),
    final_score: BigInt(final_score),
    note,
    reflection,
  };
}

export function getLocalDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Returns the IST date string offset by `daysBack` days (0 = today, 1 = yesterday, etc.)
 */
export function getISTDateOffset(daysBack: number): string {
  return getLocalDateString(new Date(Date.now() - daysBack * 86400000));
}

/**
 * History edit window: today + 3 days back are editable. Older = view-only.
 */
export function isEditable(dateStr: string): boolean {
  for (let i = 0; i <= 3; i++) {
    if (dateStr === getISTDateOffset(i)) return true;
  }
  return false;
}

/**
 * Entry form date picker: today + up to 2 days back are allowed.
 */
export function getAllowedEntryDates(): string[] {
  return [0, 1, 2].map(getISTDateOffset);
}

export function getFeedback(score: number): string {
  if (score >= 12) return "ELITE. Peak performance.";
  if (score >= 10) return "Excellent. Strong discipline.";
  if (score >= 8) return "Solid. Keep the streak.";
  if (score >= 7) return "Threshold met. Minimum acceptable.";
  if (score >= 5) return "Below standard. Improve.";
  if (score >= 3) return "Weak day. No excuses.";
  return "Failure. Start fresh tomorrow.";
}
