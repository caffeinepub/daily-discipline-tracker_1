import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Entry } from "../backend.d";
import { useGetEntry, useSaveEntry } from "../hooks/useQueries";
import {
  TASK_DEFINITIONS,
  buildEntry,
  calculateScore,
  getFeedback,
  getLocalDateString,
  minutesToDisplay,
  parseTimeToMinutes,
  tasksToMap,
} from "../lib/scoring";

const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 — Output",
  2: "Tier 2 — Growth",
  3: "Tier 3 — Discipline",
  4: "Extra",
};

const TIER_POINTS: Record<number, string> = {
  1: "2 pts each",
  2: "1 pt each",
  3: "1 pt each",
  4: "1 pt",
};

type ScoreResult = {
  task_score: number;
  ratio: number;
  ratio_bonus: number;
  screen_penalty: number;
  final_score: number;
  deep_work_done: boolean;
};

export default function TodayPage() {
  const today = getLocalDateString();
  const { data: existingEntry, isLoading: loadingEntry } = useGetEntry(today);
  const saveEntry = useSaveEntry();

  const [taskMap, setTaskMap] = useState<Record<string, boolean>>({});
  const [screenTimeInput, setScreenTimeInput] = useState("");
  const [productiveTimeInput, setProductiveTimeInput] = useState("");
  const [note, setNote] = useState("");
  const [savedResult, setSavedResult] = useState<ScoreResult | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (existingEntry) {
      setTaskMap(tasksToMap(existingEntry.tasks));
      setScreenTimeInput(minutesToDisplay(Number(existingEntry.screen_time)));
      setProductiveTimeInput(
        minutesToDisplay(Number(existingEntry.productive_time)),
      );
      setNote(existingEntry.note);
      setReflection(existingEntry.reflection);
    }
  }, [existingEntry]);

  const toggleTask = (key: string) => {
    setTaskMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validate = (): {
    screenMins: number;
    productiveMins: number;
  } | null => {
    const errs: Record<string, string> = {};
    const screenMins = parseTimeToMinutes(screenTimeInput);
    const productiveMins = parseTimeToMinutes(productiveTimeInput);
    if (screenMins === null) errs.screen_time = "Required (e.g. 6h 30m)";
    if (productiveMins === null) errs.productive_time = "Required (e.g. 2h)";
    if (
      screenMins !== null &&
      productiveMins !== null &&
      productiveMins > screenMins
    ) {
      errs.productive_time = "Cannot exceed screen time";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;
    return { screenMins: screenMins!, productiveMins: productiveMins! };
  };

  const handleSave = () => {
    const times = validate();
    if (!times) return;
    const { screenMins, productiveMins } = times;
    const score = calculateScore(taskMap, screenMins, productiveMins);
    const entry = buildEntry(
      taskMap,
      screenMins,
      productiveMins,
      note,
      reflection,
    );
    if (score.final_score < 8) {
      setPendingEntry(entry);
      setReflectionOpen(true);
    } else {
      doSave(entry, score);
    }
  };

  const doSave = (entry: Entry, score: ScoreResult) => {
    saveEntry.mutate(
      { date: today, entry },
      {
        onSuccess: () => {
          setSavedResult(score);
          toast.success(existingEntry ? "Entry updated." : "Entry saved.");
        },
        onError: () => toast.error("Failed to save entry."),
      },
    );
  };

  const confirmReflection = () => {
    if (!reflection.trim()) {
      toast.error("You must explain why you failed today.");
      return;
    }
    if (!pendingEntry) return;
    const updatedEntry = { ...pendingEntry, reflection };
    const score = calculateScore(
      tasksToMap(pendingEntry.tasks),
      Number(pendingEntry.screen_time),
      Number(pendingEntry.productive_time),
    );
    setReflectionOpen(false);
    doSave(updatedEntry, score);
  };

  if (loadingEntry) {
    return (
      <div
        className="flex items-center justify-center py-20"
        data-ocid="today.loading_state"
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isUpdate = !!existingEntry;
  const tiers = [1, 2, 3, 4];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="tier-label">Today</p>
          <p className="text-foreground font-semibold">{today}</p>
        </div>
        {isUpdate && (
          <span className="text-xs text-muted-foreground border border-border rounded px-2 py-1">
            Editing existing entry
          </span>
        )}
      </div>

      <div className="card-sheen rounded-lg p-5 shadow-card space-y-5">
        {tiers.map((tier) => {
          const tierTasks = TASK_DEFINITIONS.filter((t) => t.tier === tier);
          return (
            <div key={tier}>
              <div className="flex items-center justify-between mb-3">
                <span className="tier-label">{TIER_LABELS[tier]}</span>
                <span className="text-xs text-muted-foreground">
                  {TIER_POINTS[tier]}
                </span>
              </div>
              <div className="space-y-2">
                {tierTasks.map((task) => (
                  <div key={task.key} className="flex items-center gap-3 py-1">
                    <Checkbox
                      id={`task-${task.key}`}
                      checked={!!taskMap[task.key]}
                      onCheckedChange={() => toggleTask(task.key)}
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      data-ocid={`today.checkbox.${TASK_DEFINITIONS.findIndex((t) => t.key === task.key) + 1}`}
                    />
                    <Label
                      htmlFor={`task-${task.key}`}
                      className={`cursor-pointer text-sm ${
                        taskMap[task.key]
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {task.label}
                    </Label>
                    {taskMap[task.key] && (
                      <span className="ml-auto text-xs font-mono text-foreground/60">
                        +{task.points}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {tier < 4 && <div className="border-b border-border mt-4" />}
            </div>
          );
        })}
      </div>

      <div className="card-sheen rounded-lg p-5 shadow-card">
        <p className="tier-label mb-4">Time Tracking</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Screen Time
            </Label>
            <Input
              placeholder="e.g. 6h 30m"
              value={screenTimeInput}
              onChange={(e) => setScreenTimeInput(e.target.value)}
              className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50"
              data-ocid="today.input"
            />
            {errors.screen_time && (
              <p
                className="text-xs text-destructive"
                data-ocid="today.error_state"
              >
                {errors.screen_time}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Productive Time
            </Label>
            <Input
              placeholder="e.g. 2h 30m"
              value={productiveTimeInput}
              onChange={(e) => setProductiveTimeInput(e.target.value)}
              className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50"
              data-ocid="today.textarea"
            />
            {errors.productive_time && (
              <p
                className="text-xs text-destructive"
                data-ocid="today.error_state"
              >
                {errors.productive_time}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card-sheen rounded-lg p-5 shadow-card">
        <p className="tier-label mb-3">Note / Quote (optional)</p>
        <Textarea
          placeholder="What defined today?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50 resize-none"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saveEntry.isPending}
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-widest h-12 text-sm"
        data-ocid="today.submit_button"
      >
        {saveEntry.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        {saveEntry.isPending
          ? "Saving..."
          : isUpdate
            ? "Update Entry"
            : "Save Entry"}
      </Button>

      {savedResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-sheen rounded-lg p-5 shadow-card"
          data-ocid="today.success_state"
        >
          <p className="tier-label mb-4">Score Breakdown</p>
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground text-sm">Final Score</span>
            <span
              className={`score-display text-4xl font-bold ${
                savedResult.final_score >= 8
                  ? "text-green-400"
                  : savedResult.final_score >= 5
                    ? "text-yellow-400"
                    : "text-red-400"
              }`}
            >
              {savedResult.final_score}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <ScoreRow label="Task Score" value={`+${savedResult.task_score}`} />
            <ScoreRow
              label="Ratio Bonus"
              value={`+${savedResult.ratio_bonus}`}
            />
            <ScoreRow
              label="Screen Penalty"
              value={`-${savedResult.screen_penalty}`}
              negative={savedResult.screen_penalty > 0}
            />
            <ScoreRow
              label="Productivity"
              value={`${Math.round(savedResult.ratio * 100)}%`}
            />
            {!savedResult.deep_work_done && (
              <p className="text-xs text-destructive mt-2">
                ⚠ No deep work — streak reset to 0
              </p>
            )}
          </div>
          <div className="border-t border-border mt-4 pt-3">
            <p className="text-sm font-semibold text-foreground">
              {getFeedback(savedResult.final_score)}
            </p>
          </div>
        </motion.div>
      )}

      <Dialog open={reflectionOpen} onOpenChange={setReflectionOpen}>
        <DialogContent
          className="card-sheen border-border max-w-md"
          data-ocid="today.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Why did you fail today?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Be honest. No excuses."
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={4}
              className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50 resize-none"
              data-ocid="today.textarea"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReflectionOpen(false)}
              className="border-border text-muted-foreground"
              data-ocid="today.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReflection}
              className="bg-primary text-primary-foreground font-bold"
              data-ocid="today.confirm_button"
            >
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function ScoreRow({
  label,
  value,
  negative,
}: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-sm font-semibold ${negative ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export { Lock };
