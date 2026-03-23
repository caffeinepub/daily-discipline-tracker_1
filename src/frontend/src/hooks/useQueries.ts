import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Entry, Settings } from "../backend.d";
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
