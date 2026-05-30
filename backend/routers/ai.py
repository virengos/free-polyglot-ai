from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import asyncio

from database import get_db
from models import VocabularyWord, User
from schemas import WordOut
from services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


class SentenceRequest(BaseModel):
    word: str
    language: str
    level: str = "A2"


class WordInfoRequest(BaseModel):
    word: str
    source_language: str
    target_language: str


class StoryRequest(BaseModel):
    words: list[str]
    language: str


class SuggestRequest(BaseModel):
    user_id: int
    source_language: str
    target_language: str
    count: int = 5


@router.post("/sentence")
async def generate_sentence(payload: SentenceRequest):
    result = await ai_service.generate_example_sentence(
        payload.word, payload.language, payload.level
    )
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY (or ANTHROPIC_API_KEY) in .env to enable this feature.",
        )
    return {"sentence": result}


@router.post("/word-info")
async def generate_word_info(payload: WordInfoRequest):
    result = await ai_service.generate_word_info(
        payload.word, payload.source_language, payload.target_language
    )
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY (or ANTHROPIC_API_KEY) in .env to enable this feature.",
        )
    return result


@router.post("/image")
async def generate_image(word: str = Query(...), language: str = Query(...)):
    url = await ai_service.generate_word_image_url(word, language)
    if url is None:
        raise HTTPException(
            503,
            "Image generation unavailable. Set OPENAI_API_KEY in backend/.env to enable this feature.",
        )
    return {"url": url}


@router.post("/story")
async def generate_story(payload: StoryRequest):
    if len(payload.words) < 2:
        raise HTTPException(400, "Provide at least 2 words for a story.")
    result = await ai_service.generate_context_story(payload.words, payload.language)
    if result is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set ANTHROPIC_API_KEY in backend/.env to enable this feature.",
        )
    return {"story": result}


@router.get("/status")
def ai_status():
    """Check which AI features are available."""
    import os
    return {
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY", "").strip()),
        "openai": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "mistral": bool(os.getenv("MISTRAL_API_KEY", "").strip()),
    }


@router.post("/suggest")
async def suggest_vocabulary_words(payload: SuggestRequest, db: Session = Depends(get_db)):
    """Ask the AI to suggest and auto-save new vocabulary words for a language pair."""
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    existing = (
        db.query(VocabularyWord)
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.source_language == payload.source_language,
            VocabularyWord.target_language == payload.target_language,
        )
        .order_by(VocabularyWord.created_at.desc())
        .limit(20)
        .all()
    )

    existing_words = [{"word": w.word, "translation": w.translation} for w in existing]
    existing_set = {w.word.lower() for w in existing}

    suggestions = await ai_service.suggest_vocabulary(
        existing_words,
        payload.source_language,
        payload.target_language,
        payload.count,
    )

    if suggestions is None:
        raise HTTPException(
            503,
            "AI service unavailable. Set MISTRAL_API_KEY in backend/.env to enable this feature.",
        )

    added = []
    for s in suggestions:
        if not isinstance(s, dict):
            continue
        word_text = s.get("word", "").strip()
        if not word_text or word_text.lower() in existing_set:
            continue
        word = VocabularyWord(
            user_id=payload.user_id,
            source_language=payload.source_language,
            target_language=payload.target_language,
            word=word_text,
            translation=s.get("translation", "").strip(),
            part_of_speech=s.get("part_of_speech") or None,
            example_sentence=s.get("example_sentence") or None,
            example_translation=s.get("example_translation") or None,
        )
        db.add(word)
        existing_set.add(word_text.lower())
        added.append(word)

    db.commit()
    for w in added:
        db.refresh(w)

    return {"added": len(added), "words": [WordOut.model_validate(w) for w in added]}
