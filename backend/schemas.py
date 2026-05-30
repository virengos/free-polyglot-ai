from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import datetime


# ── User ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    native_language: str = "de"
    target_languages: List[str] = ["en"]


class UserUpdate(BaseModel):
    native_language: Optional[str] = None
    target_languages: Optional[List[str]] = None
    language_proficiencies: Optional[dict] = None  # {"en": "B2", "fr": "A1"}
    daily_word_goal: Optional[int] = None
    preferred_exercises: Optional[List[str]] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    xp: int
    level: int
    streak_days: int
    streak_last_date: Optional[str]
    native_language: str
    target_languages: List[str]
    language_proficiencies: dict
    daily_word_goal: int
    preferred_exercises: List[str]
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── Vocabulary ────────────────────────────────────────────────────────────────

class WordCreate(BaseModel):
    user_id: int
    source_language: str
    target_language: str
    word: str
    translation: str
    part_of_speech: Optional[str] = None
    example_sentence: Optional[str] = None
    example_translation: Optional[str] = None
    synonyms: List[str] = []
    tags: List[str] = []
    notes: Optional[str] = None


class WordUpdate(BaseModel):
    translation: Optional[str] = None
    part_of_speech: Optional[str] = None
    example_sentence: Optional[str] = None
    example_translation: Optional[str] = None
    synonyms: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    image_url: Optional[str] = None
    is_favorite: Optional[bool] = None


class WordOut(BaseModel):
    id: int
    user_id: int
    source_language: str
    target_language: str
    word: str
    translation: str
    part_of_speech: Optional[str]
    example_sentence: Optional[str]
    example_translation: Optional[str]
    image_url: Optional[str]
    synonyms: List[str]
    tags: List[str]
    notes: Optional[str]
    ease_factor: float
    interval: int
    repetitions: int
    memory_strength: int
    is_favorite: bool
    times_correct: int
    times_wrong: int
    last_reviewed: Optional[datetime.datetime]
    next_review: datetime.datetime
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


# ── Training ──────────────────────────────────────────────────────────────────

class ReviewSubmit(BaseModel):
    word_id: int
    user_id: int
    quality: int  # 0–5  (SM-2)
    mode: str     # "flashcard" | "multiple_choice" | "write"


class ReviewResult(BaseModel):
    word_id: int
    xp_earned: int
    memory_strength: int
    next_review: datetime.datetime
    correct: bool
    new_level: Optional[int] = None


class SessionCreate(BaseModel):
    user_id: int
    language_pairs: List[dict]


class SessionOut(BaseModel):
    id: int
    user_id: int
    started_at: datetime.datetime
    ended_at: Optional[datetime.datetime]
    words_reviewed: int
    correct_count: int
    xp_earned: int
    language_pairs: List[Any]

    model_config = {"from_attributes": True}


class SessionEnd(BaseModel):
    session_id: int
    user_id: int


# ── Progress ──────────────────────────────────────────────────────────────────

class LanguageStat(BaseModel):
    source_language: str
    target_language: str
    total_words: int
    mastered: int           # memory_strength >= 80
    avg_memory_strength: float


class ProgressOut(BaseModel):
    user_id: int
    total_words: int
    words_mastered: int     # memory_strength >= 80
    words_learning: int     # memory_strength 10–79
    words_new: int          # memory_strength < 10 and never reviewed
    words_due_now: int
    total_reviews: int
    correct_reviews: int
    accuracy_percent: float
    total_xp: int
    level: int
    streak_days: int
    languages: List[LanguageStat]
    recent_sessions: Optional[List[SessionOut]] = None
