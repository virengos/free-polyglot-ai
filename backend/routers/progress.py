from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import datetime

from database import get_db
from models import VocabularyWord, User, TrainingSession
from schemas import ProgressOut, UserOut, LanguageStat, UserCreate, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(400, "Username or email already exists")
    user = User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/progress", response_model=ProgressOut)
def get_progress(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    now = datetime.datetime.utcnow()
    words = db.query(VocabularyWord).filter(VocabularyWord.user_id == user_id).all()
    sessions = db.query(TrainingSession).filter(TrainingSession.user_id == user_id).order_by(
        TrainingSession.started_at.desc()
    ).limit(10).all()

    total_correct = sum(w.times_correct for w in words)
    total_wrong = sum(w.times_wrong for w in words)
    total_reviews = total_correct + total_wrong
    accuracy = round(total_correct / total_reviews * 100, 1) if total_reviews > 0 else 0.0

    words_due = sum(1 for w in words if w.next_review <= now)
    words_mastered = sum(1 for w in words if w.memory_strength >= 80)
    words_learning = sum(1 for w in words if 10 <= w.memory_strength < 80)
    words_new = sum(1 for w in words if w.memory_strength < 10)

    # Per source→target language pair stats
    lang_map: dict[tuple, dict] = {}
    for w in words:
        key = (w.source_language, w.target_language)
        if key not in lang_map:
            lang_map[key] = {"total": 0, "mastered": 0, "strength_sum": 0}
        lang_map[key]["total"] += 1
        if w.memory_strength >= 80:
            lang_map[key]["mastered"] += 1
        lang_map[key]["strength_sum"] += w.memory_strength

    languages = [
        LanguageStat(
            source_language=src,
            target_language=tgt,
            total_words=v["total"],
            mastered=v["mastered"],
            avg_memory_strength=round(v["strength_sum"] / v["total"], 1) if v["total"] > 0 else 0.0,
        )
        for (src, tgt), v in lang_map.items()
    ]

    return ProgressOut(
        user_id=user_id,
        total_words=len(words),
        words_mastered=words_mastered,
        words_learning=words_learning,
        words_new=words_new,
        words_due_now=words_due,
        total_reviews=total_reviews,
        correct_reviews=total_correct,
        accuracy_percent=accuracy,
        total_xp=user.xp,
        level=user.level,
        streak_days=user.streak_days,
        languages=languages,
        recent_sessions=sessions,
    )
