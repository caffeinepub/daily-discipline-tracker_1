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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lock,
  MinusCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Entry } from "../backend.d";
import {
  useGetAllEntries,
  useGetAllReflections,
  useGetEntry,
  useGetReflection,
  useSaveEntry,
  useSaveReflection,
} from "../hooks/useQueries";
import { computeDailyRiskScore } from "../lib/analytics";
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

const DISTRACTION_TAGS = [
  "Phone distraction",
  "Social media",
  "Low energy",
  "Poor planning",
  "Procrastination",
  "Other",
];

type ScoreResult = {
  task_score: number;
  ratio: number;
  ratio_bonus: number;
  screen_penalty: number;
  final_score: number;
  deep_work_done: boolean;
};

function RiskBadge({
  entries,
  reflections,
}: { entries: any[]; reflections: any[] }) {
  if (entries.length === 0) return null;
  const risk = computeDailyRiskScore(entries, reflections);
  const colorMap = {
    Low: "text-green-400 border-green-400/30 bg-green-400/10",
    Medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    High: "text-red-400 border-red-400/30 bg-red-400/10",
  };
  const Icon =
    risk.level === "Low"
      ? CheckCircle
      : risk.level === "Medium"
        ? MinusCircle
        : AlertTriangle;
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${colorMap[risk.level]}`}
      data-ocid="today.risk_card"
    >
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest">
            Daily Risk
          </span>
          <span className="font-mono text-sm font-bold">{risk.level}</span>
        </div>
        {risk.reasons.length > 0 && (
          <ul className="space-y-0.5">
            {risk.reasons.map((r) => (
              <li key={r} className="text-xs opacity-80">
                • {r}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs mt-1 opacity-70 italic">{risk.suggestion}</p>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const today = getLocalDateString();
  const { data: existingEntry, isLoading: loadingEntry } = useGetEntry(today);
  const { data: existingReflection } = useGetReflection(today);
  const { data: allEntries = [] } = useGetAllEntries();
  const { data: allReflections = [] } = useGetAllReflections();
  const saveEntry = useSaveEntry();
  const saveReflection = useSaveReflection();

  const [taskMap, setTaskMap] = useState<Record<string, boolean>>({});
  const [energyRating, setEnergyRating] = useState<number>(0);
  const [energyActionDone, setEnergyActionDone] = useState(false);
  const [screenTimeInput, setScreenTimeInput] = useState("");
  const [productiveTimeInput, setProductiveTimeInput] = useState("");
  const [note, setNote] = useState("");
  const [savedResult, setSavedResult] = useState<ScoreResult | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reflection structured fields
  const [reflEnergyLevel, setReflEnergyLevel] = useState<number>(0);
  const [reflSleepHours, setReflSleepHours] = useState<string>("");
  const [reflTags, setReflTags] = useState<string[]>([]);

  const energyExecutionDone = energyRating >= 3 && energyActionDone;

  useEffect(() => {
    if (existingEntry) {
      const map = tasksToMap(existingEntry.tasks);
      setTaskMap(map);
      setScreenTimeInput(minutesToDisplay(Number(existingEntry.screen_time)));
      setProductiveTimeInput(
        minutesToDisplay(Number(existingEntry.productive_time)),
      );
      setNote(existingEntry.note);
      setReflection(existingEntry.reflection);
    }
  }, [existingEntry]);

  useEffect(() => {
    if (existingReflection) {
      setReflEnergyLevel(Number(existingReflection.energy_level));
      setReflSleepHours(
        existingReflection.sleep_hours > 0
          ? String(existingReflection.sleep_hours)
          : "",
      );
      setReflTags(existingReflection.distraction_tags);
    }
  }, [existingReflection]);

  const getEffectiveTaskMap = () => ({
    ...taskMap,
    energy_execution: energyExecutionDone,
  });

  const toggleTask = (key: string) => {
    setTaskMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTag = (tag: string) => {
    setReflTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
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
    const effective = getEffectiveTaskMap();
    const score = calculateScore(effective, screenMins, productiveMins);
    const entry = buildEntry(
      effective,
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

    // Save structured reflection data
    const sleepVal = Number.parseFloat(reflSleepHours);
    saveReflection.mutate({
      date: today,
      data: {
        energy_level: BigInt(reflEnergyLevel),
        sleep_hours: Number.isNaN(sleepVal) ? 0 : sleepVal,
        distraction_tags: reflTags,
      },
    });
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

      {/* Daily Risk Score Badge */}
      <RiskBadge entries={allEntries} reflections={allReflections} />

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
                {tierTasks.map((task) => {
                  if (task.key === "energy_execution") {
                    return (
                      <EnergyExecutionInput
                        key={task.key}
                        points={task.points}
                        rating={energyRating}
                        actionDone={energyActionDone}
                        done={energyExecutionDone}
                        onRatingChange={setEnergyRating}
                        onActionChange={setEnergyActionDone}
                      />
                    );
                  }
                  return (
                    <div
                      key={task.key}
                      className="flex items-center gap-3 py-1"
                    >
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
                  );
                })}
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
          className="card-sheen border-border max-w-md max-h-[85vh] overflow-y-auto"
          data-ocid="today.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Why did you fail today?
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-5">
            {/* Free text reflection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Reflection
              </Label>
              <Textarea
                placeholder="Be honest. No excuses."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
                className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50 resize-none"
                data-ocid="today.textarea"
              />
            </div>

            {/* Energy Level 1-10 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Energy Level
                </Label>
                <span className="font-mono text-sm font-bold text-foreground">
                  {reflEnergyLevel === 0 ? "—" : `${reflEnergyLevel}/10`}
                </span>
              </div>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[reflEnergyLevel]}
                onValueChange={([v]) => setReflEnergyLevel(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground/60">
                <span>Not set</span>
                <span>Low</span>
                <span>High</span>
              </div>
            </div>

            {/* Sleep Hours */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Sleep Hours (optional)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 7.5"
                value={reflSleepHours}
                onChange={(e) => setReflSleepHours(e.target.value)}
                min={0}
                max={24}
                step={0.5}
                className="bg-accent/30 border-border text-foreground placeholder:text-muted-foreground/50"
                data-ocid="today.sleep_input"
              />
            </div>

            {/* Distraction Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Distraction Causes
              </Label>
              <div className="flex flex-wrap gap-2">
                {DISTRACTION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                      reflTags.includes(tag)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                    data-ocid={"today.tag_toggle"}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
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

function EnergyExecutionInput({
  points,
  rating,
  actionDone,
  done,
  onRatingChange,
  onActionChange,
}: {
  points: number;
  rating: number;
  actionDone: boolean;
  done: boolean;
  onRatingChange: (r: number) => void;
  onActionChange: (v: boolean) => void;
}) {
  return (
    <div className="py-2 space-y-3">
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}
        >
          Energy Execution
        </span>
        {done && (
          <span className="text-xs font-mono text-foreground/60">
            +{points}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">Rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRatingChange(rating === n ? 0 : n)}
              className={`w-8 h-8 rounded text-xs font-bold border transition-colors ${
                rating === n
                  ? n >= 3
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-destructive/80 border-destructive text-white"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {rating > 0 && (
          <span
            className={`text-xs ml-1 ${rating >= 3 ? "text-green-400" : "text-destructive"}`}
          >
            {rating >= 3 ? "✓ ≥3" : "✗ <3"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16">Action done</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onActionChange(true)}
            className={`px-3 h-7 rounded text-xs font-semibold border transition-colors ${
              actionDone
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onActionChange(false)}
            className={`px-3 h-7 rounded text-xs font-semibold border transition-colors ${
              !actionDone
                ? "bg-accent border-border text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/40"
            }`}
          >
            No
          </button>
        </div>
      </div>
      {!done && rating > 0 && (
        <p className="text-xs text-muted-foreground/60">
          {rating < 3 ? "Rating must be ≥3" : "Mark action as done"}
        </p>
      )}
    </div>
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
