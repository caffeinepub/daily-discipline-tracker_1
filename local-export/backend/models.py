from pydantic import BaseModel, Field
from typing import Optional, List, Tuple


class TaskEntry(BaseModel):
    date: str  # YYYY-MM-DD
    tasks: List[Tuple[str, bool]] = Field(default_factory=list)
    task_score: int = 0
    screen_time: int = 0  # minutes
    productive_time: int = 0  # minutes
    ratio: float = 0.0
    ratio_bonus: int = 0
    screen_penalty: int = 0
    final_score: int = 0
    note: str = ""
    reflection: str = ""
    deep_work_done: bool = False


class TaskEntryCreate(BaseModel):
    tasks: List[Tuple[str, bool]] = Field(default_factory=list)
    task_score: int = 0
    screen_time: int = 0
    productive_time: int = 0
    ratio: float = 0.0
    ratio_bonus: int = 0
    screen_penalty: int = 0
    final_score: int = 0
    note: str = ""
    reflection: str = ""
    deep_work_done: bool = False


class ReflectionData(BaseModel):
    date: str  # YYYY-MM-DD
    energy_level: int = 0  # 1-10, 0 = not set
    sleep_hours: float = 0.0  # 0 = not set
    distraction_tags: List[str] = Field(default_factory=list)


class ReflectionDataCreate(BaseModel):
    energy_level: int = 0
    sleep_hours: float = 0.0
    distraction_tags: List[str] = Field(default_factory=list)


class Settings(BaseModel):
    streak_threshold: int = 7


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_reset_date: Optional[str] = None


class TriggerChain(BaseModel):
    factors: List[str]
    description: str


class WeeklyAnalysis(BaseModel):
    habit_completion_pct: float
    avg_energy_level: float
    avg_sleep_hours: float
    top_distraction: Optional[str] = None
    trigger_chains: List[TriggerChain]
    suggestions: List[str]
    days_analyzed: int


class RiskScore(BaseModel):
    score: int  # 0-100
    level: str  # Low / Medium / High
    reasons: List[str]
    suggestions: List[str]
