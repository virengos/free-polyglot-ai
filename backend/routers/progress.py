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
    sessions = db.query(TrainingSession).filter(TrainingSession.user_id == user_id).all()

    total_correct = sum(w.times_correct for w in words)
    total_wrong = sum(w.times_wrong for w in words)
    total_reviews = total_correct + total_wrong
    accuracy = (total_correct / total_reviews * 100) if total_reviews > 0 else 0.0

    words_due = sum(1 for w in words if w.next_review <= now)

    # Per-language stats
    lang_map: dict[str, dict] = {}
    for w in words:
        key = w.target_language
        if key not in lang_map:
            lang_map[key] = {"total": 0, "known": 0, "learning": 0, "new": 0, "due": 0}
        lang_map[key]["total"] += 1
        if w.memory_strength >= 70:
            lang_map[key]["known"] += 1
        elif w.memory_strength >= 30:
            lang_map[key]["learning"] += 1
        else:
            lang_map[key]["new"] += 1
        if w.next_review <= now:
            lang_map[key]["due"] += 1

    language_stats = [
        LanguageStat(
            language=lang,
            total_words=v["total"],
            known_words=v["known"],
            learning_words=v["learning"],
            new_words=v["new"],
            due_today=v["due"],
        )
        for lang, v in lang_map.items()
    ]

    return ProgressOut(
        user=UserOut.model_validate(user),
        total_words=len(words),
        total_xp=user.xp,
        level=user.level,
        streak_days=user.streak_days,
        sessions_count=len(sessions),
        accuracy_rate=round(accuracy, 1),
        language_stats=language_stats,
        words_due_today=words_due,
    )
