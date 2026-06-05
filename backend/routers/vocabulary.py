from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel as _BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from typing import List, Optional
import random

from database import get_db
from models import VocabularyWord, User
from schemas import WordCreate, WordUpdate, WordOut
from services import ai_service
from services.ai_service import WORD_CATEGORIES

router = APIRouter(prefix="/api/words", tags=["vocabulary"])


@router.get("/categories")
def list_categories():
    """Return all supported vocabulary categories."""
    return [{"key": k, "label": v} for k, v in WORD_CATEGORIES.items()]


def _apply_word_filters(q, source_language, target_language, search, favorites_only, category):
    """Apply shared filter logic used by both list and count endpoints."""
    if source_language:
        q = q.filter(VocabularyWord.source_language == source_language)
    if target_language:
        q = q.filter(VocabularyWord.target_language == target_language)
    if search:
        term = f"%{search}%"
        q = q.filter(
            VocabularyWord.word.ilike(term) | VocabularyWord.translation.ilike(term)
        )
    if favorites_only:
        q = q.filter(VocabularyWord.is_favorite == True)
    if category:
        if category == "other":
            q = q.filter(
                or_(VocabularyWord.category == "other", VocabularyWord.category == None)  # noqa: E711
            )
        else:
            q = q.filter(VocabularyWord.category == category)
    return q


@router.get("/count")
def count_words(
    user_id: int = Query(...),
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return the total number of words matching the given filters."""
    q = db.query(func.count(VocabularyWord.id)).filter(VocabularyWord.user_id == user_id)
    q = _apply_word_filters(q, source_language, target_language, search, favorites_only, category)
    return {"total": q.scalar()}


@router.get("/", response_model=List[WordOut])
def list_words(
    user_id: int = Query(...),
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    q = db.query(VocabularyWord).filter(VocabularyWord.user_id == user_id)
    q = _apply_word_filters(q, source_language, target_language, search, favorites_only, category)
    return q.order_by(VocabularyWord.category.asc(), VocabularyWord.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{word_id}", response_model=WordOut)
def get_word(word_id: int, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    return word


@router.post("/", response_model=WordOut, status_code=201)
def create_word(payload: WordCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    # Reject duplicates: same word (case-insensitive) for the same user and source language
    duplicate = (
        db.query(VocabularyWord)
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.source_language == payload.source_language,
            VocabularyWord.word.ilike(payload.word.strip()),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(409, f"'{payload.word}' already exists in your {payload.source_language} vocabulary.")

    word = VocabularyWord(**payload.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)

    # Enrich with AI-generated category and image asynchronously
    word_id = word.id
    word_text = word.word
    word_translation = word.translation
    word_pos = word.part_of_speech
    word_src_lang = word.source_language

    def _enrich_word():
        import asyncio
        from database import SessionLocal

        async def _run():
            enriched = {}
            if not word_pos or word_pos not in ("phrase",):
                cat = await ai_service.classify_word_category(
                    word_text, word_translation, word_pos, word_src_lang
                )
                if cat:
                    enriched["category"] = cat
            img_url = await ai_service.generate_word_image_url(word_text, word_src_lang)
            if img_url:
                enriched["image_url"] = img_url
            if enriched:
                db2 = SessionLocal()
                try:
                    w = db2.get(VocabularyWord, word_id)
                    if w:
                        for k, v in enriched.items():
                            setattr(w, k, v)
                        db2.commit()
                finally:
                    db2.close()

        asyncio.run(_run())

    background_tasks.add_task(_enrich_word)
    return word


@router.put("/{word_id}", response_model=WordOut)
def update_word(word_id: int, payload: WordUpdate, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(word, field, value)
    db.commit()
    db.refresh(word)
    return word


@router.delete("/{word_id}", status_code=204)
def delete_word(word_id: int, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    db.delete(word)
    db.commit()


@router.patch("/{word_id}/favorite", response_model=WordOut)
def toggle_favorite(word_id: int, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    word.is_favorite = not word.is_favorite
    db.commit()
    db.refresh(word)
    return word


@router.get("/{word_id}/distractors", response_model=List[str])
def get_distractors(word_id: int, count: int = 3, db: Session = Depends(get_db)):
    """Return `count` wrong translations for multiple-choice exercises."""
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")

    others = (
        db.query(VocabularyWord.translation)
        .filter(
            VocabularyWord.user_id == word.user_id,
            VocabularyWord.target_language == word.target_language,
            VocabularyWord.id != word_id,
        )
        .all()
    )
    pool = [r[0] for r in others if r[0] != word.translation]
    random.shuffle(pool)
    return pool[:count]


class BulkImportItem(_BaseModel):
    word: str
    translation: str


class BulkImportRequest(_BaseModel):
    user_id: int
    source_language: str
    target_language: str
    items: List[BulkImportItem]


class BulkImportResult(_BaseModel):
    added: int
    skipped: int
    skipped_words: List[str]


@router.post("/bulk-import", response_model=BulkImportResult, status_code=201)
def bulk_import_words(
    payload: BulkImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Import multiple word pairs at once. Duplicate words (same user + source language) are skipped."""
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    if len(payload.items) > 500:
        raise HTTPException(400, "Maximum 500 words per import.")

    # Build existing-word set for fast duplicate check (case-insensitive)
    existing = {
        w.lower()
        for (w,) in db.query(VocabularyWord.word)
        .filter(
            VocabularyWord.user_id == payload.user_id,
            VocabularyWord.source_language == payload.source_language,
        )
        .all()
    }

    added_ids: list[int] = []
    skipped_words: list[str] = []

    for item in payload.items:
        word = item.word.strip()
        translation = item.translation.strip()
        if not word or not translation:
            continue
        if word.lower() in existing:
            skipped_words.append(word)
            continue

        new_word = VocabularyWord(
            user_id=payload.user_id,
            source_language=payload.source_language,
            target_language=payload.target_language,
            word=word,
            translation=translation,
        )
        db.add(new_word)
        db.flush()  # get id before commit
        existing.add(word.lower())
        added_ids.append(new_word.id)

    db.commit()

    # Enrich all newly added words with AI category + image in the background
    if added_ids:
        src_lang = payload.source_language

        def _enrich_bulk():
            import asyncio
            from database import SessionLocal

            async def _run():
                db2 = SessionLocal()
                try:
                    for wid in added_ids:
                        w = db2.get(VocabularyWord, wid)
                        if not w:
                            continue
                        enriched = {}
                        cat = await ai_service.classify_word_category(
                            w.word, w.translation, w.part_of_speech, src_lang
                        )
                        if cat:
                            enriched["category"] = cat
                        img_url = await ai_service.generate_word_image_url(w.word, src_lang)
                        if img_url:
                            enriched["image_url"] = img_url
                        if enriched:
                            for k, v in enriched.items():
                                setattr(w, k, v)
                            db2.commit()
                        import asyncio as _asyncio
                        await _asyncio.sleep(0.5)
                finally:
                    db2.close()

            asyncio.run(_run())

        background_tasks.add_task(_enrich_bulk)

    return BulkImportResult(
        added=len(added_ids),
        skipped=len(skipped_words),
        skipped_words=skipped_words,
    )
