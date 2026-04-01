import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useGetAllEntries, useGetAllReflections } from "../hooks/useQueries";
import {
  computeDailyRiskScore,
  computeMomentumSeries,
  computeWeeklyAnalysis,
} from "../lib/analytics";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="tier-label mb-3">{children}</p>;
}

function Card({
  children,
  className = "",
}: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-sheen rounded-lg p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: entries = [], isLoading: loadingEntries } = useGetAllEntries();
  const { data: reflections = [], isLoading: loadingReflections } =
    useGetAllReflections();

  const isLoading = loadingEntries || loadingReflections;

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        data-ocid="analytics.loading_state"
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length < 3) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-sheen rounded-lg p-10 text-center"
        data-ocid="analytics.empty_state"
      >
        <p className="text-muted-foreground text-sm">
          Not enough data yet — need at least 3 entries to generate analytics.
        </p>
      </motion.div>
    );
  }

  const risk = computeDailyRiskScore(entries, reflections);
  const weekly = computeWeeklyAnalysis(entries, reflections);
  const momentum = computeMomentumSeries(entries);

  // Last 14 days for charts
  const cutoff14 = new Date();
  cutoff14.setDate(cutoff14.getDate() - 13);
  const cutoff14Str = cutoff14.toISOString().slice(0, 10);
  const last14 = [...entries]
    .filter((e) => e.date >= cutoff14Str)
    .sort((a, b) => a.date.localeCompare(b.date));

  const scoreChartData = last14.map((e) => ({
    date: e.date.slice(5), // MM-DD
    score: Number(e.entry.final_score),
  }));

  const timeChartData = last14.map((e) => ({
    date: e.date.slice(5),
    screen: Number(e.entry.screen_time),
    productive: Number(e.entry.productive_time),
  }));

  const distractionData = Object.entries(weekly.distractionFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag: tag.replace(" distraction", ""), count }));

  const riskColorMap = {
    Low: "oklch(0.65 0.15 145)",
    Medium: "oklch(0.75 0.15 75)",
    High: "oklch(0.65 0.22 27)",
  };

  const riskBgMap = {
    Low: "border-green-400/30 bg-green-400/5",
    Medium: "border-yellow-400/30 bg-yellow-400/5",
    High: "border-red-400/30 bg-red-400/5",
  };

  const riskTextMap = {
    Low: "text-green-400",
    Medium: "text-yellow-400",
    High: "text-red-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      data-ocid="analytics.page"
    >
      <div>
        <p className="tier-label">Analytics</p>
        <p className="text-foreground font-semibold">Behavioral Intelligence</p>
      </div>

      {/* Daily Risk Score */}
      <Card className={`border ${riskBgMap[risk.level]}`}>
        <div className="flex items-start justify-between mb-3">
          <SectionTitle>Daily Risk Score</SectionTitle>
          <span
            className={`font-mono text-2xl font-bold ${riskTextMap[risk.level]}`}
          >
            {risk.level}
          </span>
        </div>
        <div className="w-full bg-accent/40 rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${risk.score}%`,
              background: riskColorMap[risk.level],
            }}
          />
        </div>
        {risk.reasons.length > 0 && (
          <div className="space-y-1 mb-3">
            {risk.reasons.map((r) => (
              <p key={r} className="text-xs text-muted-foreground">
                • {r}
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-foreground/70 italic border-t border-border pt-3">
          {risk.suggestion}
        </p>
      </Card>

      {/* Weekly Summary */}
      <Card>
        <SectionTitle>Weekly Summary</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox
            label="Habit Completion"
            value={`${weekly.habitCompletionPct}%`}
            color={
              weekly.habitCompletionPct >= 70
                ? "text-green-400"
                : weekly.habitCompletionPct >= 50
                  ? "text-yellow-400"
                  : "text-red-400"
            }
          />
          <MetricBox
            label="Avg Energy"
            value={
              weekly.avgEnergyLevel > 0
                ? `${weekly.avgEnergyLevel.toFixed(1)}/10`
                : "—"
            }
          />
          <MetricBox
            label="Avg Sleep"
            value={
              weekly.avgSleepHours > 0
                ? `${weekly.avgSleepHours.toFixed(1)}h`
                : "—"
            }
          />
          <MetricBox label="Days Tracked" value={String(weekly.daysAnalyzed)} />
        </div>
        {weekly.topDistraction && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="tier-label">Top Distraction: </span>
            <span className="text-sm text-yellow-400 font-semibold">
              {weekly.topDistraction}
            </span>
          </div>
        )}
      </Card>

      {/* Trigger Chains */}
      <Card>
        <SectionTitle>Behavioral Trigger Chains</SectionTitle>
        {weekly.triggerChains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No patterns detected yet.
          </p>
        ) : (
          <div className="space-y-2">
            {weekly.triggerChains.map((chain) => (
              <div
                key={chain}
                className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/5 border border-yellow-400/20 rounded px-3 py-2"
              >
                <span className="font-mono text-xs">→</span>
                <span>{chain}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Improvement Suggestions */}
      <Card>
        <SectionTitle>Improvement Suggestions</SectionTitle>
        <div className="space-y-2">
          {weekly.suggestions.map((s) => (
            <div key={s} className="flex gap-2 text-sm">
              <span className="text-primary mt-0.5">▸</span>
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Score Trend Chart */}
      {scoreChartData.length > 0 && (
        <Card>
          <SectionTitle>Score Trend — Last 14 Days</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.22 0.01 256)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 16]}
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.17 0.007 256)",
                  border: "1px solid oklch(0.22 0.01 256)",
                  borderRadius: "6px",
                  color: "oklch(0.93 0.005 256)",
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="oklch(0.97 0.002 256)"
                strokeWidth={2}
                dot={{ fill: "oklch(0.97 0.002 256)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Momentum Graph */}
      <Card>
        <SectionTitle>Momentum — Weekly Completion %</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={momentum}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.22 0.01 256)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.17 0.007 256)",
                border: "1px solid oklch(0.22 0.01 256)",
                borderRadius: "6px",
                color: "oklch(0.93 0.005 256)",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value}%`, "Completion"]}
            />
            <Bar dataKey="completionPct" radius={[4, 4, 0, 0]}>
              {momentum.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={
                    entry.completionPct >= 70
                      ? "oklch(0.65 0.15 145)"
                      : entry.completionPct >= 50
                        ? "oklch(0.75 0.15 75)"
                        : "oklch(0.65 0.22 27)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Screen Time vs Productive Time */}
      {timeChartData.length > 0 && (
        <Card>
          <SectionTitle>Screen vs Productive Time (min)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeChartData}>
              <defs>
                <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.65 0.22 27)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.65 0.22 27)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.65 0.15 145)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.65 0.15 145)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.22 0.01 256)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.17 0.007 256)",
                  border: "1px solid oklch(0.22 0.01 256)",
                  borderRadius: "6px",
                  color: "oklch(0.93 0.005 256)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="screen"
                stroke="oklch(0.65 0.22 27)"
                fill="url(#screenGrad)"
                strokeWidth={2}
                name="Screen"
              />
              <Area
                type="monotone"
                dataKey="productive"
                stroke="oklch(0.65 0.15 145)"
                fill="url(#prodGrad)"
                strokeWidth={2}
                name="Productive"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5"
                style={{ background: "oklch(0.65 0.22 27)" }}
              />
              <span className="text-xs text-muted-foreground">Screen Time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5"
                style={{ background: "oklch(0.65 0.15 145)" }}
              />
              <span className="text-xs text-muted-foreground">
                Productive Time
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Distraction Tags */}
      {distractionData.length > 0 && (
        <Card>
          <SectionTitle>Distraction Frequency</SectionTitle>
          <ResponsiveContainer
            width="100%"
            height={distractionData.length * 40 + 20}
          >
            <BarChart
              data={distractionData}
              layout="vertical"
              margin={{ left: 0, right: 20 }}
            >
              <XAxis
                type="number"
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="tag"
                tick={{ fill: "oklch(0.72 0.008 256)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.17 0.007 256)",
                  border: "1px solid oklch(0.22 0.01 256)",
                  borderRadius: "6px",
                  color: "oklch(0.93 0.005 256)",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                fill="oklch(0.75 0.15 75)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </motion.div>
  );
}

function MetricBox({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-accent/30 rounded p-3 text-center">
      <p className="tier-label text-[10px] mb-1">{label}</p>
      <p className={`font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
