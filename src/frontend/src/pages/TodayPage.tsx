import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
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
  useGetDailyMetrics,
  useGetEntry,
  useGetReflection,
  useSaveDailyMetrics,
  useSaveEntry,
  useSaveReflection,
} from "../hooks/useQueries";
import { computeDailyRiskScore } from "../lib/analytics";
import {
  TASK_DEFINITIONS,
  buildEntry,
  calculateScore,
  getAllowedEntryDates,
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

const DISTRACTION_CATEGORIES = [
  {
    label: "Digital",
    tags: [
      "YouTube",
      "Instagram",
      "Reddit",
      "Discord",
      "Random Internet Browsing",
      "Short-form videos",
      "Gaming",
      "Messaging / Chatting",
      "Phone scrolling",
      "News reading",
    ],
  },
  {
    label: "Mental",
    tags: [
      "Procrastination",
      "Task avoidance",
      "Overthinking",
      "Low motivation",
      "Mental fatigue",
      "Perfectionism",
      "Difficulty starting tasks",
      "Stress",
    ],
  },
  {
    label: "Environmental",
    tags: [
      "Noise",
      "Interruptions",
      "Uncomfortable workspace",
      "Poor study environment",
    ],
  },
  {
    label: "Behavioral",
    tags: [
      "Late start to work",
      "Poor planning",
      "Switching tasks too often",
      "No clear goal",
      "Multitasking",
    ],
  },
  {
    label: "Physical",
    tags: ["Low sleep", "Low energy", "Hunger", "Headache", "Eye strain"],
  },
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

function dateLabelSuffix(date: string, _today: string): string {
  const allowed = getAllowedEntryDates();
  const idx = allowed.indexOf(date);
  if (idx === 0) return " (Today)";
  if (idx === 1) return " (Yesterday)";
  if (idx === 2) return " (2 days ago)";
  return "";
}

function MetricSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </Label>
        <span className="font-mono text-sm font-bold text-foreground">
          {value === 0 ? "—" : `${value}/10`}
        </span>
      </div>
      <Slider
        min={0}
        max={10}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

function DistractionTagSelector({
  selectedTags,
  onToggle,
}: {
  selectedTags: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="space-y-4">
      {DISTRACTION_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1.5">
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {cat.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onToggle(tag)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
                data-ocid="today.tag_toggle"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TodayPage() {
  const today = getLocalDateString();
  const allowedDates = getAllowedEntryDates();

  const [selectedDate, setSelectedDate] = useState<string>(today);

  const { data: existingEntry, isLoading: loadingEntry } =
    useGetEntry(selectedDate);
  const { data: existingReflection } = useGetReflection(selectedDate);
  const { data: existingMetrics } = useGetDailyMetrics(selectedDate);
  const { data: allEntries = [] } = useGetAllEntries();
  const { data: allReflections = [] } = useGetAllReflections();
  const saveEntry = useSaveEntry();
  const saveReflection = useSaveReflection();
  const saveDailyMetrics = useSaveDailyMetrics();

  const [taskMap, setTaskMap] = useState<Record<string, boolean>>({});
  const [energyRating, setEnergyRating] = useState<number>(0);
  const [energyActionDone, setEnergyActionDone] = useState(false);
  const [screenTimeInput, setScreenTimeInput] = useState("");
  const [productiveTimeInput, setProductiveTimeInput] = useState("");
  const [note, setNote] = useState("");
  const [savedResult, setSavedResult] = useState<ScoreResult | null>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflection, setReflection] = useState("");
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictEntry, setConflictEntry] = useState<Entry | null>(null);
  const [conflictScore, setConflictScore] = useState<ScoreResult | null>(null);

  // Reflection structured fields (shared with failure dialog)
  const [reflEnergyLevel, setReflEnergyLevel] = useState<number>(0);
  const [reflSleepHours, setReflSleepHours] = useState<string>("");
  const [reflTags, setReflTags] = useState<string[]>([]);

  // Daily Metrics fields
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [focusQuality, setFocusQuality] = useState<number>(0);
  const [mentalClarity, setMentalClarity] = useState<number>(0);
  const [motivationLevel, setMotivationLevel] = useState<number>(0);
  const [dayRating, setDayRating] = useState<number>(0);

  const energyExecutionDone = energyRating >= 3 && energyActionDone;

  const getLiveScore = (): number => {
    const screenMins = parseTimeToMinutes(screenTimeInput) ?? 0;
    const productiveMins = parseTimeToMinutes(productiveTimeInput) ?? 0;
    const effective = { ...taskMap, energy_execution: energyExecutionDone };
    return calculateScore(effective, screenMins, productiveMins).final_score;
  };

  // Auto-expand metrics when live score < 8
  useEffect(() => {
    const screenMins = parseTimeToMinutes(screenTimeInput) ?? 0;
    const productiveMins = parseTimeToMinutes(productiveTimeInput) ?? 0;
    const effective = { ...taskMap, energy_execution: energyExecutionDone };
    const score = calculateScore(
      effective,
      screenMins,
      productiveMins,
    ).final_score;
    if (score < 8) {
      setMetricsOpen(true);
    }
  }, [taskMap, screenTimeInput, productiveTimeInput, energyExecutionDone]);

  const resetForm = () => {
    setTaskMap({});
    setEnergyRating(0);
    setEnergyActionDone(false);
    setScreenTimeInput("");
    setProductiveTimeInput("");
    setNote("");
    setReflection("");
    setSavedResult(null);
    setSavedDate(null);
    setErrors({});
    setReflEnergyLevel(0);
    setReflSleepHours("");
    setReflTags([]);
    setMetricsOpen(false);
    setFocusQuality(0);
    setMentalClarity(0);
    setMotivationLevel(0);
    setDayRating(0);
  };

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

  useEffect(() => {
    if (existingMetrics) {
      setReflEnergyLevel(Number(existingMetrics.energy_level));
      setReflSleepHours(
        existingMetrics.sleep_hours > 0
          ? String(existingMetrics.sleep_hours)
          : "",
      );
      setFocusQuality(Number(existingMetrics.focus_quality));
      setMentalClarity(Number(existingMetrics.mental_clarity));
      setMotivationLevel(Number(existingMetrics.motivation_level));
      setDayRating(Number(existingMetrics.day_rating));
    }
  }, [existingMetrics]);

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

    if (existingEntry && !isFormPrepopulated()) {
      setConflictEntry(entry);
      setConflictScore(score);
      setConflictOpen(true);
      return;
    }

    proceedWithSave(entry, score);
  };

  const isFormPrepopulated = (): boolean => {
    if (!existingEntry) return false;
    const existingScreen = minutesToDisplay(Number(existingEntry.screen_time));
    const existingProductive = minutesToDisplay(
      Number(existingEntry.productive_time),
    );
    return (
      screenTimeInput === existingScreen &&
      productiveTimeInput === existingProductive &&
      note === existingEntry.note
    );
  };

  const proceedWithSave = (entry: Entry, score: ScoreResult) => {
    if (score.final_score < 8) {
      setPendingEntry(entry);
      setReflectionOpen(true);
    } else {
      doSave(entry, score);
    }
  };

  const persistDailyMetrics = (date: string) => {
    const sleepVal = Number.parseFloat(reflSleepHours);
    saveDailyMetrics.mutate({
      date,
      data: {
        energy_level: BigInt(reflEnergyLevel),
        sleep_hours: Number.isNaN(sleepVal) ? 0 : sleepVal,
        focus_quality: BigInt(focusQuality),
        mental_clarity: BigInt(mentalClarity),
        motivation_level: BigInt(motivationLevel),
        day_rating: BigInt(dayRating),
      },
    });
  };

  const doSave = (entry: Entry, score: ScoreResult) => {
    saveEntry.mutate(
      { date: selectedDate, entry },
      {
        onSuccess: () => {
          setSavedResult(score);
          setSavedDate(selectedDate);
          toast.success(
            existingEntry
              ? `Entry updated for ${selectedDate}.`
              : `Entry saved for ${selectedDate}.`,
          );
          persistDailyMetrics(selectedDate);
        },
        onError: (err) => {
          console.error("Save entry error:", err);
          toast.error("Failed to save entry. Please try again.");
        },
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

    const sleepVal = Number.parseFloat(reflSleepHours);
    saveReflection.mutate({
      date: selectedDate,
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
  const liveScore = getLiveScore();
  const metricsAllFilled =
    reflEnergyLevel > 0 &&
    reflSleepHours !== "" &&
    focusQuality > 0 &&
    mentalClarity > 0 &&
    motivationLevel > 0 &&
    dayRating > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Date Picker */}
      <div className="card-sheen rounded-lg p-4 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="tier-label">Entry Date</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Backdating allowed up to 2 days
            </p>
          </div>
          <Select
            value={selectedDate}
            onValueChange={(d) => {
              resetForm();
              setSelectedDate(d);
            }}
          >
            <SelectTrigger
              className="w-52 bg-accent/30 border-border text-foreground"
              data-ocid="today.date_picker"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="card-sheen border-border">
              {allowedDates.map((d) => (
                <SelectItem key={d} value={d} className="font-mono">
                  {d}
                  {dateLabelSuffix(d, today)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isUpdate && (
          <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="text-xs text-yellow-400/80">
              An entry already exists for this date — you are editing it
            </span>
          </div>
        )}
      </div>

      {selectedDate === today && (
        <RiskBadge entries={allEntries} reflections={allReflections} />
      )}

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

      {/* Daily Metrics Collapsible */}
      <div className="card-sheen rounded-lg shadow-card overflow-hidden">
        <Collapsible open={metricsOpen} onOpenChange={setMetricsOpen}>
          <CollapsibleTrigger
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-accent/20 transition-colors"
            data-ocid="today.metrics_panel"
          >
            <div className="flex items-center gap-3">
              <span className="tier-label">Daily Metrics</span>
              {liveScore < 8 && !metricsAllFilled && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 font-medium">
                  Fill to improve analysis
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                metricsOpen ? "rotate-180" : ""
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
              {liveScore < 8 && (
                <div className="flex items-start gap-2 p-3 rounded bg-yellow-400/10 border border-yellow-400/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-400/90">
                    Your score is below 8 — fill in these metrics to track what
                    went wrong and improve analysis accuracy.
                  </p>
                </div>
              )}

              <MetricSlider
                label="Energy Level"
                value={reflEnergyLevel}
                onChange={setReflEnergyLevel}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Sleep Hours
                  </Label>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {reflSleepHours !== "" ? `${reflSleepHours}h` : "—"}
                  </span>
                </div>
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

              <MetricSlider
                label="Focus Quality"
                value={focusQuality}
                onChange={setFocusQuality}
              />

              <MetricSlider
                label="Mental Clarity"
                value={mentalClarity}
                onChange={setMentalClarity}
              />

              <MetricSlider
                label="Motivation Level"
                value={motivationLevel}
                onChange={setMotivationLevel}
              />

              <MetricSlider
                label="Day Rating"
                value={dayRating}
                onChange={setDayRating}
              />

              <div className="space-y-3 pt-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Distraction Sources
                </Label>
                <DistractionTagSelector
                  selectedTags={reflTags}
                  onToggle={toggleTag}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
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

      {savedResult && savedDate && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-sheen rounded-lg p-5 shadow-card"
          data-ocid="today.success_state"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="tier-label text-green-400">
              Entry saved — {savedDate}
            </p>
          </div>
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

      {/* Conflict Dialog */}
      <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <DialogContent
          className="card-sheen border-border max-w-sm"
          data-ocid="today.conflict_dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Entry already exists
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1">
            An entry for{" "}
            <span className="font-mono text-foreground">{selectedDate}</span>{" "}
            already exists. What would you like to do?
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => {
                setConflictOpen(false);
                if (existingEntry) {
                  const map = tasksToMap(existingEntry.tasks);
                  setTaskMap(map);
                  setScreenTimeInput(
                    minutesToDisplay(Number(existingEntry.screen_time)),
                  );
                  setProductiveTimeInput(
                    minutesToDisplay(Number(existingEntry.productive_time)),
                  );
                  setNote(existingEntry.note);
                  setReflection(existingEntry.reflection);
                  toast.info(
                    "Existing entry loaded — make your changes and save.",
                  );
                }
              }}
              className="w-full bg-primary text-primary-foreground font-semibold"
              data-ocid="today.conflict_edit"
            >
              Edit existing entry
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConflictOpen(false);
                if (conflictEntry && conflictScore) {
                  proceedWithSave(conflictEntry, conflictScore);
                }
              }}
              className="w-full border-border text-muted-foreground hover:text-foreground"
              data-ocid="today.conflict_overwrite"
            >
              Overwrite entry
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConflictOpen(false);
                setConflictEntry(null);
                setConflictScore(null);
              }}
              className="w-full text-muted-foreground"
              data-ocid="today.conflict_cancel"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reflection / Failure Dialog */}
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

            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Distraction Sources
              </Label>
              <DistractionTagSelector
                selectedTags={reflTags}
                onToggle={toggleTag}
              />
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
