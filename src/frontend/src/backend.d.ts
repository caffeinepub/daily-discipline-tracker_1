import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface StreakData {
    longest_streak: bigint;
    current_streak: bigint;
    last_reset_date?: string;
}
export interface Settings {
    streak_threshold: bigint;
}
export interface ReflectionWithDate {
    data: ReflectionData;
    date: string;
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
export type Tasks = Array<[string, boolean]>;
export interface ReflectionData {
    sleep_hours: number;
    energy_level: bigint;
    distraction_tags: Array<string>;
}
export interface backendInterface {
    clearAllEntries(): Promise<void>;
    clearAllReflectionData(): Promise<void>;
    getAllEntries(): Promise<Array<EntryWithDate>>;
    getAllReflectionDates(): Promise<Array<string>>;
    getAllReflections(): Promise<Array<ReflectionWithDate>>;
    getEntry(date: string): Promise<Entry | null>;
    getReflection(date: string): Promise<ReflectionData | null>;
    getSettings(): Promise<Settings>;
    getStreakData(): Promise<StreakData>;
    saveEntry(date: string, entry: Entry): Promise<void>;
    saveReflection(date: string, data: ReflectionData): Promise<void>;
    saveSettings(settings: Settings): Promise<void>;
}
