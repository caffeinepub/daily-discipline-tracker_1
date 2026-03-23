import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronRight, Edit2, Loader2, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { EntryWithDate } from "../backend.d";
import { useGetAllEntries } from "../hooks/useQueries";
import {
  TASK_DEFINITIONS,
  getFeedback,
  isEditable,
  minutesToDisplay,
  tasksToMap,
} from "../lib/scoring";

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-400";
  if (score >= 5) return "text-yellow-400";
  return "text-red-400";
}

export default function HistoryPage() {
  const { data: entries, isLoading } = useGetAllEntries();
  const [selected, setSelected] = useState<EntryWithDate | null>(null);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        data-ocid="history.loading_state"
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sorted = [...(entries ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="tier-label mb-4">Entry History</p>

      {sorted.length === 0 ? (
        <div
          className="card-sheen rounded-lg p-10 text-center text-muted-foreground"
          data-ocid="history.empty_state"
        >
          No entries yet. Start tracking today.
        </div>
      ) : (
        <div
          className="card-sheen rounded-lg overflow-hidden shadow-card"
          data-ocid="history.table"
        >
          {sorted.map((item, i) => {
            const score = Number(item.entry.final_score);
            const editable = isEditable(item.date);
            return (
              <motion.button
                key={item.date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(item)}
                className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors text-left group"
                data-ocid={`history.item.${i + 1}`}
              >
                <span className="text-sm font-mono text-muted-foreground">
                  {item.date}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={`score-display text-lg font-bold ${scoreColor(score)}`}
                  >
                    Score: {score}
                  </span>
                  {editable ? (
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
            <DialogContent
              className="card-sheen border-border max-w-lg max-h-[80vh] overflow-y-auto"
              data-ocid="history.dialog"
            >
              <DialogHeader>
                <DialogTitle className="text-foreground font-mono flex items-center gap-3">
                  {selected.date}
                  <span
                    className={`text-xl font-bold font-mono ${scoreColor(Number(selected.entry.final_score))}`}
                  >
                    {Number(selected.entry.final_score)}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <StatBox
                    label="Final"
                    value={Number(selected.entry.final_score)}
                    color={scoreColor(Number(selected.entry.final_score))}
                  />
                  <StatBox
                    label="Tasks"
                    value={Number(selected.entry.task_score)}
                  />
                  <StatBox
                    label="Bonus"
                    value={Number(selected.entry.ratio_bonus)}
                    plus
                  />
                  <StatBox
                    label="Penalty"
                    value={Number(selected.entry.screen_penalty)}
                    minus
                  />
                </div>

                <div>
                  <p className="tier-label mb-3">Tasks</p>
                  <div className="space-y-1">
                    {TASK_DEFINITIONS.map((t) => {
                      const map = tasksToMap(selected.entry.tasks);
                      const done = map[t.key];
                      return (
                        <div
                          key={t.key}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className={`w-3 h-3 rounded-sm border ${
                              done
                                ? "bg-foreground border-foreground"
                                : "border-border"
                            }`}
                          />
                          <span
                            className={
                              done
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                            }
                          >
                            {t.label}
                          </span>
                          {done && (
                            <span className="ml-auto text-xs font-mono text-muted-foreground">
                              +{t.points}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-accent/30 rounded p-3">
                    <p className="tier-label mb-1">Screen Time</p>
                    <p className="font-mono text-foreground font-semibold">
                      {minutesToDisplay(Number(selected.entry.screen_time))}
                    </p>
                  </div>
                  <div className="bg-accent/30 rounded p-3">
                    <p className="tier-label mb-1">Productive Time</p>
                    <p className="font-mono text-foreground font-semibold">
                      {minutesToDisplay(Number(selected.entry.productive_time))}
                    </p>
                  </div>
                </div>

                <div className="bg-accent/30 rounded p-3">
                  <p className="tier-label mb-1">Productivity Ratio</p>
                  <p className="font-mono text-foreground font-semibold">
                    {Math.round(selected.entry.ratio * 100)}%
                  </p>
                </div>

                {selected.entry.note && (
                  <div className="bg-accent/30 rounded p-3">
                    <p className="tier-label mb-1">Note</p>
                    <p className="text-sm text-foreground">
                      {selected.entry.note}
                    </p>
                  </div>
                )}

                {selected.entry.reflection && (
                  <div className="bg-accent/30 rounded p-3 border border-destructive/30">
                    <p className="tier-label mb-1 text-destructive/80">
                      Reflection
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selected.entry.reflection}
                    </p>
                  </div>
                )}

                <p className="text-sm font-semibold text-foreground border-t border-border pt-3">
                  {getFeedback(Number(selected.entry.final_score))}
                </p>

                {!isEditable(selected.date) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <Lock className="w-3 h-3" />
                    Entry locked. Only today and yesterday are editable.
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setSelected(null)}
                className="w-full border-border text-muted-foreground mt-2"
                data-ocid="history.close_button"
              >
                Close
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatBox({
  label,
  value,
  plus,
  minus,
  color,
}: {
  label: string;
  value: number;
  plus?: boolean;
  minus?: boolean;
  color?: string;
}) {
  return (
    <div className="bg-accent/30 rounded p-2">
      <p className="tier-label text-[10px] mb-1">{label}</p>
      <p
        className={`score-display text-xl font-bold ${
          color ?? (minus && value > 0 ? "text-destructive" : "text-foreground")
        }`}
      >
        {minus && value > 0 ? "-" : plus ? "+" : ""}
        {value}
      </p>
    </div>
  );
}
