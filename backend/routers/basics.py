from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services import ai_service

router = APIRouter(prefix="/api/basics", tags=["basics"])

TOPICS = {
    "weekdays":    {"label": "Wochentage",   "emoji": "📅", "title_en": "Weekdays"},
    "months":      {"label": "Monate",       "emoji": "🗓️",  "title_en": "Months"},
    "time":        {"label": "Uhrzeit",      "emoji": "🕐", "title_en": "Telling Time"},
    "numbers":     {"label": "Zahlen",       "emoji": "🔢", "title_en": "Numbers 1–20"},
    "colors":      {"label": "Farben",       "emoji": "🎨", "title_en": "Colors"},
    "seasons":     {"label": "Jahreszeiten", "emoji": "🌸", "title_en": "Seasons"},
    "greetings":   {"label": "Begrüßungen",  "emoji": "👋", "title_en": "Greetings"},
    "directions":  {"label": "Richtungen",   "emoji": "🧭", "title_en": "Directions"},
    "weather":     {"label": "Wetter",       "emoji": "☀️", "title_en": "Weather"},
    "family":      {"label": "Familie",      "emoji": "👨‍👩‍👧", "title_en": "Family"},
    "body":        {"label": "Körperteile",  "emoji": "🫀", "title_en": "Body Parts"},
    "food_basics": {"label": "Essen Basis",  "emoji": "🍎", "title_en": "Basic Foods"},
}


class BasicSetRequest(BaseModel):
    user_id: int
    topic: str
    target_language: str
    source_language: str = "de"
    level: Optional[str] = "A1"


class ExerciseRequest(BaseModel):
    user_id: int
    topic: str
    target_language: str
    source_language: str = "de"
    level: Optional[str] = "A1"


@router.get("/topics")
async def get_topics():
    return [{"id": k, **v} for k, v in TOPICS.items()]


@router.post("/set")
async def generate_basic_set(payload: BasicSetRequest):
    if payload.topic not in TOPICS:
        raise HTTPException(400, f"Unknown topic: {payload.topic}")
    result = await ai_service.generate_basics_set(
        topic=payload.topic,
        target_language=payload.target_language,
        source_language=payload.source_language,
        level=payload.level or "A1",
    )
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY in .env to enable this feature.",
        )
    return result


@router.post("/exercise")
async def generate_exercise(payload: ExerciseRequest):
    if payload.topic not in TOPICS:
        raise HTTPException(400, f"Unknown topic: {payload.topic}")
    result = await ai_service.generate_basics_exercise(
        topic=payload.topic,
        target_language=payload.target_language,
        source_language=payload.source_language,
        level=payload.level or "A1",
    )
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY in .env to enable this feature.",
        )
    return result
