from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import asyncio

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
    }
