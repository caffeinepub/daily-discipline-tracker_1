import Map "mo:core/Map";
import Nat "mo:core/Nat";

module {
  type ReflectionData = {
    energy_level : Nat;
    sleep_hours : Float;
    distraction_tags : [Text];
  };

  type OldActor = {
    entries : Map.Map<Text, { tasks : [(Text, Bool)]; task_score : Nat; screen_time : Nat; productive_time : Nat; ratio : Float; ratio_bonus : Nat; screen_penalty : Nat; final_score : Int; note : Text; reflection : Text; deep_work_done : Bool }>;
    streakThreshold : Nat;
  };

  type NewActor = {
    entries : Map.Map<Text, { tasks : [(Text, Bool)]; task_score : Nat; screen_time : Nat; productive_time : Nat; ratio : Float; ratio_bonus : Nat; screen_penalty : Nat; final_score : Int; note : Text; reflection : Text; deep_work_done : Bool }>;
    reflections : Map.Map<Text, ReflectionData>;
    streakThreshold : Nat;
  };

  public func run(old : OldActor) : NewActor {
    let newReflections = Map.empty<Text, ReflectionData>();
    {
      entries = old.entries;
      reflections = newReflections;
      streakThreshold = old.streakThreshold;
    };
  };
};
