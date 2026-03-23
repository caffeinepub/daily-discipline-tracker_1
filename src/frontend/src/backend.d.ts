import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Tasks = Array<[string, boolean]>;
export interface StreakData {
    longest_streak: bigint;
    current_streak: bigint;
    last_reset_date?: string;
}
export interface Settings {
    streak_threshold: bigint;
}
export interface Entry {
    ratio_bonus: bigint;
    tasks: Tasks;
    screen_time: bigint;
    note: string;
    deep_work_done: boolean;
    screen_penalty: bigint;
    final_score: bigint;
    task_score: bigint;
    productive_time: bigint;
    reflection: string;
    ratio: number;
}
export interface EntryWithDate {
    date: string;
    entry: Entry;
}
export interface backendInterface {
    getAllEntries(): Promise<Array<EntryWithDate>>;
    getEntry(date: string): Promise<Entry | null>;
    getSettings(): Promise<Settings>;
    getStreakData(): Promise<StreakData>;
    saveEntry(date: string, entry: Entry): Promise<void>;
    saveSettings(settings: Settings): Promise<void>;
}
