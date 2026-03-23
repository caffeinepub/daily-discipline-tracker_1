import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGetSettings, useSaveSettings } from "../hooks/useQueries";

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const saveSettings = useSaveSettings();
  const [threshold, setThreshold] = useState("7");

  useEffect(() => {
    if (settings) {
      setThreshold(String(Number(settings.streak_threshold)));
    }
  }, [settings]);

  const handleSave = () => {
    const val = Number.parseInt(threshold);
    if (Number.isNaN(val) || val < 1 || val > 20) {
      toast.error("Threshold must be between 1 and 20.");
      return;
    }
    saveSettings.mutate(
      { streak_threshold: BigInt(val) },
      {
        onSuccess: () => toast.success("Settings saved."),
        onError: () => toast.error("Failed to save settings."),
      },
    );
  };

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        data-ocid="settings.loading_state"
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="tier-label mb-4">Settings</p>

      <div className="card-sheen rounded-lg p-5 shadow-card space-y-5">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Streak Threshold (minimum score to maintain streak)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={20}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="bg-accent/30 border-border text-foreground w-24"
              data-ocid="settings.input"
            />
            <span className="text-sm text-muted-foreground">points</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Default: 7. If final score ≥ threshold, streak continues. Deep Work
            is also required.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            className="bg-primary text-primary-foreground font-bold uppercase tracking-widest"
            data-ocid="settings.submit_button"
          >
            {saveSettings.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {saveSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
