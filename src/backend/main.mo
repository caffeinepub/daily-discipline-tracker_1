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

  module Entry {
    public func compareByDate(e1 : EntryWithDate, e2 : EntryWithDate) : Order.Order {
      Text.compare(e2.date, e1.date); // Compare in descending order
    };
  };

  type EntryWithDate = {
    date : Text;
    entry : Entry;
  };

  let entries = Map.empty<Text, Entry>();
  var streakThreshold : Nat = 7;

  public shared ({ caller }) func saveEntry(date : Text, entry : Entry) : async () {
    entries.add(date, entry);
  };

  public query ({ caller }) func getEntry(date : Text) : async ?Entry {
    entries.get(date);
  };

  public query ({ caller }) func getAllEntries() : async [EntryWithDate] {
    entries.entries().toArray().map(func((date, entry)) { { date; entry } }).sort(Entry.compareByDate);
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
};
