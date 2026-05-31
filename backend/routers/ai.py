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
    proficiency_level: Optional[str] = None  # CEFR level, e.g. "A2", "B1"


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
    url = await ai_service.generate_word_image_url(word, language, force_new=True)
    if url is None:
        raise HTTPException(
            503,
            "Image generation temporarily unavailable (rate limit or API error). Please try again in a moment.",
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


@router.post("/fill-missing-images")
async def fill_missing_images(user_id: int = Query(...), db: Session = Depends(get_db)):
    """Generate images for all vocabulary words that currently lack one."""
    rows = (
        db.query(VocabularyWord.id, VocabularyWord.word, VocabularyWord.source_language)
        .filter(
            VocabularyWord.user_id == user_id,
            VocabularyWord.image_url == None,  # noqa: E711
        )
        .all()
    )
    if not rows:
        return {"queued": 0, "message": "All words already have images."}

    missing_data = [(r.id, r.word, r.source_language) for r in rows]

    async def _fill():
        from database import SessionLocal
        for word_id, word_text, src_lang in missing_data:
            img_url = await ai_service.generate_word_image_url(word_text, src_lang)
            if img_url:
                db2 = SessionLocal()
                try:
                    ww = db2.get(VocabularyWord, word_id)
                    if ww and not ww.image_url:
                        ww.image_url = img_url
                        db2.commit()
                finally:
                    db2.close()
            # Throttle to avoid Mistral rate limits during bulk generation
            await asyncio.sleep(1.5)

    asyncio.create_task(_fill())
    return {"queued": len(missing_data), "message": f"Generating images for {len(missing_data)} words in the background."}


@router.post("/reclassify-others")
async def reclassify_others(user_id: int = Query(...), db: Session = Depends(get_db)):
    """Re-classify all words currently in the 'Other' folder using AI and move them to the correct category."""
    from sqlalchemy import or_
    rows = (
        db.query(VocabularyWord.id, VocabularyWord.word, VocabularyWord.translation,
                 VocabularyWord.part_of_speech, VocabularyWord.source_language)
        .filter(
            VocabularyWord.user_id == user_id,
            or_(VocabularyWord.category == "other", VocabularyWord.category == None),  # noqa: E711
        )
        .all()
    )
    if not rows:
        return {"queued": 0, "message": "No words in the Other folder to reclassify."}

    word_data = [(r.id, r.word, r.translation, r.part_of_speech, r.source_language) for r in rows]

    async def _reclassify():
        from database import SessionLocal
        for word_id, word_text, translation, pos, src_lang in word_data:
            new_cat = await ai_service.classify_word_category(word_text, translation, pos, src_lang)
            if new_cat and new_cat != "other":
                db2 = SessionLocal()
                try:
                    ww = db2.get(VocabularyWord, word_id)
                    if ww:
                        ww.category = new_cat
                        db2.commit()
                finally:
                    db2.close()
            await asyncio.sleep(0.8)

    asyncio.create_task(_reclassify())
    return {"queued": len(word_data), "message": f"Reclassifying {len(word_data)} words in the background."}


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

    # Fetch ALL existing words for this user+source_language to build a complete
    # deduplication set — not just the last 20, which would miss older words.
    all_existing = (
        db.query(VocabularyWord.word, VocabularyWord.translation, VocabularyWord.created_at)
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.source_language == payload.source_language,
        )
        .order_by(VocabularyWord.created_at.desc())
        .all()
    )

    existing_set = {w.word.lower() for w in all_existing}
    # Pass the most recent words as context for the AI (sample, not all)
    existing_words = [{"word": w.word, "translation": w.translation} for w in all_existing[:30]]

    # Identify categories that are underrepresented (fewer than 5 words)
    from sqlalchemy import func
    category_counts = (
        db.query(VocabularyWord.category, func.count(VocabularyWord.id))
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.source_language == payload.source_language,
            VocabularyWord.category != None,  # noqa: E711
        )
        .group_by(VocabularyWord.category)
        .all()
    )
    existing_category_counts = {cat: cnt for cat, cnt in category_counts}
    SPARSE_THRESHOLD = 5
    sparse_categories = [
        cat for cat in ai_service.WORD_CATEGORIES
        if existing_category_counts.get(cat, 0) < SPARSE_THRESHOLD
    ]

    # Use explicitly provided level, else fall back to the user's stored proficiency
    proficiency = (
        payload.proficiency_level
        or (user.language_proficiencies or {}).get(payload.target_language)
        or "A2"
    )

    suggestions = await ai_service.suggest_vocabulary(
        existing_words,
        payload.source_language,
        payload.target_language,
        payload.count,
        proficiency_level=proficiency,
        sparse_categories=sparse_categories,
    )

    if suggestions is None:
        raise HTTPException(
            503,
            "AI service temporarily unavailable (rate limit or API error). Please try again in a few seconds.",
        )

    added = []
    for s in suggestions:
        if not isinstance(s, dict):
            continue
        word_text = s.get("word", "").strip()
        if not word_text or word_text.lower() in existing_set:
            continue
        cat = s.get("category", "").strip().lower() or None
        if cat and cat not in ai_service.WORD_CATEGORIES:
            cat = None
        word = VocabularyWord(
            user_id=payload.user_id,
            source_language=payload.source_language,
            target_language=payload.target_language,
            word=word_text,
            translation=s.get("translation", "").strip(),
            part_of_speech=s.get("part_of_speech") or None,
            category=cat,
            example_sentence=s.get("example_sentence") or None,
            example_translation=s.get("example_translation") or None,
        )
        db.add(word)
        existing_set.add(word_text.lower())
        added.append(word)

    db.commit()
    for w in added:
        db.refresh(w)

    # Collect IDs of ALL words missing images (newly added + pre-existing)
    all_missing = (
        db.query(VocabularyWord.id, VocabularyWord.word, VocabularyWord.source_language)
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.image_url == None,  # noqa: E711
        )
        .all()
    )
    missing_data = [(r.id, r.word, r.source_language) for r in all_missing]

    # Generate images for all words without one in the background
    async def _generate_images():
        from database import SessionLocal
        for word_id, word_text, src_lang in missing_data:
            img_url = await ai_service.generate_word_image_url(word_text, src_lang)
            if img_url:
                db2 = SessionLocal()
                try:
                    ww = db2.get(VocabularyWord, word_id)
                    if ww and not ww.image_url:
                        ww.image_url = img_url
                        db2.commit()
                finally:
                    db2.close()
            # Throttle to avoid Mistral rate limits during bulk generation
            await asyncio.sleep(1.5)

    asyncio.create_task(_generate_images())

    return {"added": len(added), "words": [WordOut.model_validate(w) for w in added]}
