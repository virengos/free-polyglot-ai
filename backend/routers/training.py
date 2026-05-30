from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from database import get_db
from models import VocabularyWord, User, TrainingSession
from schemas import ReviewSubmit, ReviewResult, SessionCreate, SessionOut, SessionEnd, WordOut
from services.spaced_repetition import sm2_review, xp_for_review, compute_level

router = APIRouter(prefix="/api/train", tags=["training"])


@router.get("/queue", response_model=List[WordOut])
def get_training_queue(
    user_id: int = Query(...),
    source_lang: Optional[str] = None,
    target_lang: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    include_new: bool = True,
    db: Session = Depends(get_db),
):
    """
    Return words due for review (next_review <= now) and optionally new words.
    Sorted by: overdue first, then by memory_strength ascending.
    """
    now = datetime.datetime.utcnow()
    q = db.query(VocabularyWord).filter(VocabularyWord.user_id == user_id)
    if source_lang:
        q = q.filter(VocabularyWord.source_language == source_lang)
    if target_lang:
        q = q.filter(VocabularyWord.target_language == target_lang)

    due = q.filter(VocabularyWord.next_review <= now).order_by(
        VocabularyWord.next_review.asc(),
        VocabularyWord.memory_strength.asc(),
    ).limit(limit).all()

    if include_new and len(due) < limit:
        # Fill remainder with new words (never reviewed)
        already_ids = {w.id for w in due}
        new_words = (
            q.filter(
                VocabularyWord.repetitions == 0,
                VocabularyWord.id.notin_(already_ids),
            )
            .order_by(VocabularyWord.created_at.asc())
            .limit(limit - len(due))
            .all()
        )
        due = due + new_words

    return due


@router.post("/review", response_model=ReviewResult)
def submit_review(payload: ReviewSubmit, db: Session = Depends(get_db)):
    word = db.get(VocabularyWord, payload.word_id)
    if not word:
        raise HTTPException(404, "Word not found")
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(404, "User not found")

    quality = max(0, min(5, payload.quality))

    new_ef, new_interval, new_reps, mem_strength, next_review = sm2_review(
        word.ease_factor, word.interval, word.repetitions, quality
    )

    # Update word
    word.ease_factor = new_ef
    word.interval = new_interval
    word.repetitions = new_reps
    word.memory_strength = mem_strength
    word.next_review = next_review
    word.last_reviewed = datetime.datetime.utcnow()
    if quality >= 3:
        word.times_correct += 1
    else:
        word.times_wrong += 1

    # Award XP
    earned_xp = xp_for_review(quality, payload.mode)
    user.xp += earned_xp

    # Check level up
    new_level = compute_level(user.xp)
    leveled_up = new_level > user.level
    user.level = new_level

    # Update streak
    today = datetime.date.today().isoformat()
    if user.streak_last_date != today:
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        if user.streak_last_date == yesterday:
            user.streak_days += 1
        elif user.streak_last_date is None:
            user.streak_days = 1
        else:
            user.streak_days = 1  # reset streak
        user.streak_last_date = today

    db.commit()
    db.refresh(word)

    return ReviewResult(
        word_id=word.id,
        xp_earned=earned_xp,
        memory_strength=mem_strength,
        next_review=next_review,
        correct=quality >= 3,
        new_level=new_level if leveled_up else None,
    )


@router.post("/sessions", response_model=SessionOut, status_code=201)
def start_session(payload: SessionCreate, db: Session = Depends(get_db)):
    session = TrainingSession(
        user_id=payload.user_id,
        language_pairs=payload.language_pairs,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.put("/sessions/{session_id}/end", response_model=SessionOut)
def end_session(session_id: int, payload: SessionEnd, db: Session = Depends(get_db)):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.user_id != payload.user_id:
        raise HTTPException(403, "Forbidden")

    session.ended_at = datetime.datetime.utcnow()

    # Completion bonus XP
    bonus = 20 + session.correct_count * 2
    user = db.get(User, payload.user_id)
    if user:
        user.xp += bonus
        user.level = compute_level(user.xp)
    session.xp_earned += bonus

    db.commit()
    db.refresh(session)
    return session


@router.put("/sessions/{session_id}/word", response_model=SessionOut)
def record_word_in_session(
    session_id: int,
    correct: bool = Query(...),
    db: Session = Depends(get_db),
):
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    session.words_reviewed += 1
    if correct:
        session.correct_count += 1
    db.commit()
    db.refresh(session)
    return session
