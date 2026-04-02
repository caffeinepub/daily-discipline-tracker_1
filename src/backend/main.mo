import Map "mo:core/Map";
import Text "mo:core/Text";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Iter "mo:core/Iter";
import Int "mo:core/Int";

import Nat "mo:core/Nat";


actor {
  type Tasks = [(Text, Bool)];

  type Entry = {
    tasks : Tasks;
    task_score : Nat;
    screen_time : Nat;
    productive_time : Nat;
    ratio : Float;
    ratio_bonus : Nat;
    screen_penalty : Nat;
    final_score : Int;
    note : Text;
    reflection : Text;
    deep_work_done : Bool;
  };

  type StreakData = {
    current_streak : Nat;
    longest_streak : Nat;
    last_reset_date : ?Text;
  };

  type Settings = {
    streak_threshold : Nat;
  };

  type EntryWithDate = {
    date : Text;
    entry : Entry;
  };

  type ReflectionData = {
    energy_level : Nat;
    sleep_hours : Float;
    distraction_tags : [Text];
  };

  type ReflectionWithDate = {
    date : Text;
    data : ReflectionData;
  };

  // New structured daily metrics (separate stable var to preserve existing ReflectionData)
  type DailyMetrics = {
    energy_level : Nat;
    sleep_hours : Float;
    focus_quality : Nat;
    mental_clarity : Nat;
    motivation_level : Nat;
    day_rating : Nat;
  };

  module Entry {
    public func compareByDate(e1 : EntryWithDate, e2 : EntryWithDate) : Order.Order {
      Text.compare(e2.date, e1.date);
    };
  };

  module ReflectionData {
    public func compare(a : ReflectionWithDate, b : ReflectionWithDate) : Order.Order {
      Text.compare(b.date, a.date);
    };
  };

  // Stable storage -- survives canister upgrades
  stable var stableEntries : [(Text, Entry)] = [];
  stable var stableReflections : [(Text, ReflectionData)] = [];
  stable var stableMetrics : [(Text, DailyMetrics)] = [];
  stable var streakThreshold : Nat = 7;

  // In-memory maps rebuilt from stable storage on startup
  let entries = Map.empty<Text, Entry>();
  for ((k, v) in stableEntries.vals()) {
    entries.add(k, v);
  };

  let reflections = Map.empty<Text, ReflectionData>();
  for ((k, v) in stableReflections.vals()) {
    reflections.add(k, v);
  };

  let metrics = Map.empty<Text, DailyMetrics>();
  for ((k, v) in stableMetrics.vals()) {
    metrics.add(k, v);
  };

  system func preupgrade() {
    stableEntries := entries.toArray();
    stableReflections := reflections.toArray();
    stableMetrics := metrics.toArray();
  };

  system func postupgrade() {
    stableEntries := [];
    stableReflections := [];
    stableMetrics := [];
  };

  public shared ({ caller }) func saveEntry(date : Text, entry : Entry) : async () {
    entries.add(date, entry);
  };

  public query ({ caller }) func getEntry(date : Text) : async ?Entry {
    entries.get(date);
  };

  public query ({ caller }) func getAllEntries() : async [EntryWithDate] {
    entries.entries().toArray().map(func((date, entry)) { { date; entry } }).sort(Entry.compareByDate);
  };

  public shared ({ caller }) func saveReflection(date : Text, data : ReflectionData) : async () {
    reflections.add(date, data);
  };

  public query ({ caller }) func getReflection(date : Text) : async ?ReflectionData {
    reflections.get(date);
  };

  public query ({ caller }) func getAllReflections() : async [ReflectionWithDate] {
    let array = reflections.entries().toArray().map(func((date, data)) { { date; data } });
    array.sort();
  };

  public shared ({ caller }) func getAllReflectionDates() : async [Text] {
    reflections.keys().toArray();
  };

  // Daily Metrics endpoints
  public shared ({ caller }) func saveDailyMetrics(date : Text, data : DailyMetrics) : async () {
    metrics.add(date, data);
  };

  public query ({ caller }) func getDailyMetrics(date : Text) : async ?DailyMetrics {
    metrics.get(date);
  };

  public query ({ caller }) func getStreakData() : async StreakData {
    let sortedEntries = entries.toArray().sort(
      func(a, b) { Text.compare(b.0, a.0) },
    );

    var currentStreak = 0;
    var longestStreak = 0;
    var tempStreak = 0;
    var lastResetDate : ?Text = null;

    for ((date, entry) in sortedEntries.values()) {
      if (entry.final_score >= streakThreshold and entry.deep_work_done) {
        tempStreak += 1;
        if (tempStreak > longestStreak) {
          longestStreak := tempStreak;
        };
      } else {
        tempStreak := 0;
        lastResetDate := ?date;
      };
    };

    currentStreak := tempStreak;

    {
      current_streak = currentStreak;
      longest_streak = longestStreak;
      last_reset_date = lastResetDate;
    };
  };

  public query ({ caller }) func getSettings() : async Settings {
    { streak_threshold = streakThreshold };
  };

  public shared ({ caller }) func saveSettings(settings : Settings) : async () {
    streakThreshold := settings.streak_threshold;
  };

  public shared ({ caller }) func clearAllReflectionData() : async () {
    reflections.clear();
  };

  public shared ({ caller }) func clearAllEntries() : async () {
    entries.clear();
  };
};
