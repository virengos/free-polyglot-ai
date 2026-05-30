from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import random

from database import get_db
from models import VocabularyWord, User
from schemas import WordCreate, WordUpdate, WordOut
from services import ai_service

router = APIRouter(prefix="/api/words", tags=["vocabulary"])


@router.get("/", response_model=List[WordOut])
def list_words(
    user_id: int = Query(...),
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    search: Optional[str] = None,
    favorites_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(VocabularyWord).filter(VocabularyWord.user_id == user_id)
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
    return q.order_by(VocabularyWord.created_at.desc()).all()


@router.get("/{word_id}", response_model=WordOut)
def get_word(word_id: int, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    return word


@router.post("/", response_model=WordOut, status_code=201)
def create_word(payload: WordCreate, db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")
    word = VocabularyWord(**payload.model_dump())
    db.add(word)
    db.commit()
    db.refresh(word)
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
