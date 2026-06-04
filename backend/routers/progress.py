from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import datetime

from database import get_db
from models import VocabularyWord, User, TrainingSession, DailyStats
from schemas import ProgressOut, UserOut, LanguageStat, DailyStatOut, UserCreate, UserUpdate

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
            language_score=round(v["strength_sum"] / v["total"] * 10) if v["total"] > 0 else 0,
        )
        for (src, tgt), v in lang_map.items()
    ]

    # Daily stats – last 30 days
    thirty_days_ago = (datetime.date.today() - datetime.timedelta(days=29)).isoformat()
    daily_stats = db.query(DailyStats).filter(
        DailyStats.user_id == user_id,
        DailyStats.date >= thirty_days_ago,
    ).order_by(DailyStats.date.asc()).all()

    # Activity suggestions
    suggestions: list[str] = []
    today_str = datetime.date.today().isoformat()
    trained_today = any(ds.date == today_str for ds in daily_stats)

    if not trained_today:
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        if user.streak_last_date == yesterday and user.streak_days > 0:
            suggestions.append(
                f"Your {user.streak_days}-day streak is at risk! Train today to keep it alive."
            )
        elif words_due > 0:
            suggestions.append(
                f"You have {words_due} word{'s' if words_due != 1 else ''} due for review. Start a training session!"
            )
        else:
            suggestions.append("Keep learning! Add new vocabulary or review what you know.")
    else:
        if user.streak_days >= 7:
            suggestions.append(f"Incredible! {user.streak_days}-day streak – you're on fire!")
        elif user.streak_days >= 3:
            suggestions.append(f"Great work! {user.streak_days}-day streak – keep going!")

    for lang in sorted(languages, key=lambda l: l.language_score):
        if lang.language_score < 300 and lang.total_words >= 5:
            lang_name = lang.target_language.upper()
            suggestions.append(
                f"Your {lang_name} score is {lang.language_score}/1000 – focus on this language to level up!"
            )
            break  # only one low-score nudge

    if words_due > 0 and trained_today:
        suggestions.append(f"You still have {words_due} word{'s' if words_due != 1 else ''} due – finish your reviews!")

    if not suggestions:
        suggestions.append("You're doing great! All words reviewed and streak intact.")

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
        daily_stats=daily_stats,
        suggestions=suggestions,
    )
