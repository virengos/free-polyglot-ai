from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services import ai_service

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

TOPICS = {
    "age":             {"label": "Mein Alter",       "emoji": "🎂", "title_en": "My Age"},
    "origin":          {"label": "Woher ich komme",  "emoji": "🌍", "title_en": "Where I Come From"},
    "profession":      {"label": "Mein Beruf",        "emoji": "💼", "title_en": "My Profession"},
    "hobbies":         {"label": "Meine Hobbies",     "emoji": "🎨", "title_en": "My Hobbies"},
    "morning_routine": {"label": "Mein Morgen",       "emoji": "☀️", "title_en": "My Morning Routine"},
    "family":          {"label": "Meine Familie",     "emoji": "👨‍👩‍👧", "title_en": "My Family"},
    "food":            {"label": "Essen & Trinken",   "emoji": "🍽️", "title_en": "Food & Drinks"},
    "weekend":         {"label": "Mein Wochenende",   "emoji": "🌴", "title_en": "My Weekend"},
}


class ExerciseRequest(BaseModel):
    user_id: int
    topic: str
    target_language: str
    source_language: str = "de"
    level: Optional[str] = "A2"


@router.get("/topics")
async def get_topics():
    return [{"id": k, **v} for k, v in TOPICS.items()]


@router.post("/exercise")
async def generate_exercise(payload: ExerciseRequest):
    if payload.topic not in TOPICS:
        raise HTTPException(400, f"Unknown topic: {payload.topic}")

    result = await ai_service.generate_fill_in_blank(
        topic=payload.topic,
        target_language=payload.target_language,
        source_language=payload.source_language,
        level=payload.level or "A2",
    )
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY in .env to enable this feature.",
        )
    return result
