from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from database import engine
from models import Base
from routers import vocabulary, training, progress, ai, tts, audit, conversations, basics


def _run_migrations():
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing_cols = {c["name"] for c in inspector.get_columns("users")}
        migrations = [
            ("language_proficiencies", "ALTER TABLE users ADD COLUMN language_proficiencies JSON DEFAULT '{}'"),
            ("daily_word_goal",        "ALTER TABLE users ADD COLUMN daily_word_goal INTEGER DEFAULT 10"),
            ("preferred_exercises",    "ALTER TABLE users ADD COLUMN preferred_exercises JSON DEFAULT '[\"flashcard\",\"multiple_choice\",\"write\"]'"),
        ]
        for col, sql in migrations:
            if col not in existing_cols:
                conn.execute(text(sql))

        word_cols = {c["name"] for c in inspector.get_columns("vocabulary_words")}
        word_migrations = [
            ("is_favorite", "ALTER TABLE vocabulary_words ADD COLUMN is_favorite BOOLEAN DEFAULT 0"),
            ("category",    "ALTER TABLE vocabulary_words ADD COLUMN category TEXT"),
        ]
        for col, sql in word_migrations:
            if col not in word_cols:
                conn.execute(text(sql))

        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Base.metadata.create_all(bind=engine)
    _run_migrations()

    # Auto-seed demo data if DB is empty
    from database import SessionLocal
    from models import User
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            from seed_data import seed
            seed()
    finally:
        db.close()

    yield


app = FastAPI(
    title="Polyglot AI Vocabulary Trainer",
    description="AI-powered vocabulary training for polyglots",
    version="1.0.0",
    lifespan=lifespan,
)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vocabulary.router)
app.include_router(training.router)
app.include_router(progress.router)
app.include_router(basics.router)
app.include_router(ai.router)
app.include_router(tts.router)
app.include_router(audit.router)
app.include_router(conversations.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "app": "Polyglot AI Vocabulary Trainer",
        "docs": "/docs",
    }
