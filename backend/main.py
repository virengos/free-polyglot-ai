from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from database import engine
from models import Base
from routers import vocabulary, training, progress, ai


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    Base.metadata.create_all(bind=engine)

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
app.include_router(ai.router)


@app.get("/")
def root():
    return {
        "status": "ok",
        "app": "Polyglot AI Vocabulary Trainer",
        "docs": "/docs",
    }
