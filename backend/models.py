from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak_days = Column(Integer, default=0)
    streak_last_date = Column(String, nullable=True)  # ISO date string
    native_language = Column(String, default="de")
    target_languages = Column(JSON, default=["en"])
    language_proficiencies = Column(JSON, default={})  # e.g. {"en": "B2", "fr": "A1"}
    daily_word_goal = Column(Integer, default=10)
    preferred_exercises = Column(JSON, default=["flashcard", "multiple_choice", "write"])
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    words = relationship("VocabularyWord", back_populates="owner", cascade="all, delete")
    sessions = relationship("TrainingSession", back_populates="user", cascade="all, delete")


class VocabularyWord(Base):
    __tablename__ = "vocabulary_words"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    source_language = Column(String, nullable=False)  # e.g. "de"
    target_language = Column(String, nullable=False)  # e.g. "en"
    word = Column(String, nullable=False)
    translation = Column(String, nullable=False)
    part_of_speech = Column(String, nullable=True)  # noun, verb, adj, ...
    example_sentence = Column(Text, nullable=True)
    example_translation = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    synonyms = Column(JSON, default=[])
    tags = Column(JSON, default=[])
    notes = Column(Text, nullable=True)

    is_favorite = Column(Boolean, default=False)

    # SM-2 Spaced Repetition
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)        # days until next review
    repetitions = Column(Integer, default=0)     # number of correct repetitions
    next_review = Column(DateTime, default=datetime.datetime.utcnow)
    memory_strength = Column(Integer, default=0) # 0–100

    # Statistics
    times_correct = Column(Integer, default=0)
    times_wrong = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="words")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    words_reviewed = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    xp_earned = Column(Integer, default=0)
    language_pairs = Column(JSON, default=[])  # [{"source": "de", "target": "en"}, ...]

    user = relationship("User", back_populates="sessions")
