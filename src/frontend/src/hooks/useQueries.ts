import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DailyMetrics,
  Entry,
  ReflectionData,
  Settings,
} from "../backend.d";
import { useActor } from "./useActor";

export function useGetAllEntries() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["entries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEntries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetEntry(date: string) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["entry", date],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getEntry(date);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetSettings() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSettings();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetStreakData() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["streak"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getStreakData();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetReflection(date: string) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["reflection", date],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getReflection(date);
    },
    enabled: !!actor && !isFetching && !!date,
  });
}

export function useGetAllReflections() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["reflections"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllReflections();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveReflection() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      data,
    }: { date: string; data: ReflectionData }) => {
      if (!actor) throw new Error("No actor");
      return actor.saveReflection(date, data);
    },
    onSuccess: (_result, { date }) => {
      qc.invalidateQueries({ queryKey: ["reflections"] });
      qc.invalidateQueries({ queryKey: ["reflection", date] });
    },
  });
}

export function useSaveEntry() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, entry }: { date: string; entry: Entry }) => {
      if (!actor) throw new Error("No actor");
      return actor.saveEntry(date, entry);
    },
    onSuccess: (_data, { date }) => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entry", date] });
      qc.invalidateQueries({ queryKey: ["streak"] });
    },
  });
}

export function useSaveSettings() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Settings) => {
      if (!actor) throw new Error("No actor");
      return actor.saveSettings(settings);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useGetDailyMetrics(date: string) {
  const { actor, isFetching } = useActor();
  return useQuery<DailyMetrics | null>({
    queryKey: ["dailyMetrics", date],
    queryFn: async () => {
      if (!actor) return null;
      // actor type from backend.ts doesn't include new methods yet; cast to any
      return (actor as any).getDailyMetrics(
        date,
      ) as Promise<DailyMetrics | null>;
    },
    enabled: !!actor && !isFetching && !!date,
  });
}

export function useSaveDailyMetrics() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      data,
    }: { date: string; data: DailyMetrics }) => {
      if (!actor) throw new Error("No actor");
      // actor type from backend.ts doesn't include new methods yet; cast to any
      return (actor as any).saveDailyMetrics(date, data) as Promise<void>;
    },
    onSuccess: (_result, { date }) => {
      qc.invalidateQueries({ queryKey: ["dailyMetrics", date] });
    },
  });
}
