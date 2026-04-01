import { Toaster } from "@/components/ui/sonner";
import { Flame, Trophy } from "lucide-react";
import { useState } from "react";
import { useGetStreakData } from "./hooks/useQueries";
import AnalyticsPage from "./pages/AnalyticsPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import TodayPage from "./pages/TodayPage";

type Tab = "today" | "history" | "analytics" | "settings";

function StreakBadge() {
  const { data: streakData } = useGetStreakData();
  const current = streakData ? Number(streakData.current_streak) : 0;
  const longest = streakData ? Number(streakData.longest_streak) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Flame
          className={`w-4 h-4 ${
            current > 0 ? "text-orange-400" : "text-muted-foreground/40"
          }`}
        />
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            current > 0 ? "text-orange-400" : "text-muted-foreground/40"
          }`}
        >
          {current}d
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5 text-muted-foreground/40" />
        <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
          {longest}d
        </span>
      </div>
    </div>
  );
}

const NAV_TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("today");

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.09 0.004 256) 0%, oklch(0.11 0.005 256) 100%)",
      }}
    >
      <header
        className="border-b border-border sticky top-0 z-50"
        style={{
          background: "oklch(0.11 0.005 256 / 0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-0 flex items-center justify-between h-14">
          <span className="font-mono text-sm font-bold tracking-widest text-foreground uppercase">
            DD Tracker
          </span>

          <StreakBadge />

          <nav className="flex items-center gap-1">
            {NAV_TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-4 text-xs font-bold uppercase tracking-widest relative transition-colors ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/70"
                }`}
                data-ocid={`nav.${tab.id}.link`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === "today" && <TodayPage />}
        {activeTab === "history" && <HistoryPage />}
        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>

      <footer className="border-t border-border mt-16 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs text-muted-foreground/50">
            © {new Date().getFullYear()}. Built with ❤ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>

      <Toaster theme="dark" />
    </div>
  );
}
