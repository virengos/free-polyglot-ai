# 🌍 Polyglot AI – AI Vocabulary Trainer

An adaptive, AI-powered vocabulary trainer for polyglots. Train multiple languages in parallel with spaced repetition, AI-generated content, and various exercise formats.

## Features

- **Spaced Repetition (SM-2)**: Intelligent review scheduling with memory strength 0–100
- **3 Exercise formats**: Flashcards (3D flip), Multiple Choice, Write mode
- **6 Languages**: German, English, Spanish, French, Swedish, Polish
- **AI content**: Example sentences & word explanations via **Mistral AI** (primary) or Anthropic Claude (fallback)
- **Dashboard**: XP, streak, learning progress, language statistics
- **Text-to-Speech**: Browser-native pronunciation for every word
- **Demo data**: Automatic seeding on first launch

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend | FastAPI (Python 3.12), SQLAlchemy ORM |
| Database | SQLite (default) / PostgreSQL |
| AI | Mistral AI · Anthropic Claude (optional, via API key) |
| DevOps | Docker Compose, start.sh |

## Quick Start

### Easiest way – start.sh

```bash
./start.sh
```

The script automatically sets up:
- Python Virtual Environment + pip dependencies
- `backend/.env` (if not present)
- `frontend/.env.local`
- Starts backend (port 8000) and frontend (port 3000)

> Adjust ports: `BACKEND_PORT=8080 FRONTEND_PORT=3001 ./start.sh`

---

### Manual start

#### Prerequisites

- Python 3.11+
- Node.js 20+

#### 1. Start backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create .env file (start.sh does this automatically)
cat > .env << 'EOF'
DATABASE_URL=sqlite:///./polyglot.db
FRONTEND_URL=http://localhost:3000
# Optional AI:
# MISTRAL_API_KEY=...
# ANTHROPIC_API_KEY=sk-ant-...
EOF

uvicorn main:app --reload
```

Backend running at http://localhost:8000  
API docs: http://localhost:8000/docs

#### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend running at http://localhost:3000

### With Docker Compose

```bash
docker compose up -d
```

All services start automatically. Demo data is loaded on first launch.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|--------|
| `DATABASE_URL` | SQLite or PostgreSQL URL | `sqlite:///./polyglot.db` |
| `MISTRAL_API_KEY` | Mistral AI API key for AI features | *(optional)* |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | *(optional)* |
| `FRONTEND_URL` | CORS origin of the frontend | `http://localhost:3000` |

> When `MISTRAL_API_KEY` is set, the AI endpoints (`/api/ai/*`) are activated.  
> The file `backend/.env` is **not** committed to the repository (`.gitignore`).

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | URL of the backend | `http://localhost:8000` |

## Project Structure

```
free-polyglot-ai/
├── backend/
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── models.py            # SQLAlchemy ORM (User, Word, Session)
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # DB connection
│   ├── seed_data.py         # Demo vocabulary
│   ├── routers/
│   │   ├── vocabulary.py    # CRUD words
│   │   ├── training.py      # Queue, review, sessions
│   │   ├── progress.py      # Statistics, user management
│   │   └── ai.py            # AI endpoints
│   └── services/
│       ├── spaced_repetition.py  # SM-2 algorithm
│       └── ai_service.py         # Mistral AI (primary) + Anthropic (fallback)
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Dashboard
        │   ├── training/        # Training page
        │   └── vocabulary/      # Vocabulary management
        ├── components/
        │   ├── exercises/
        │   │   ├── Flashcard.tsx       # 3D flashcard
        │   │   ├── MultipleChoice.tsx  # Multiple choice exercise
        │   │   └── WriteExercise.tsx   # Write mode
        │   ├── Navbar.tsx
        │   ├── AddWordModal.tsx
        │   ├── VocabCard.tsx
        │   ├── StatCard.tsx
        │   └── ProgressBar.tsx
        ├── lib/
        │   ├── api.ts       # Axios API client
        │   └── utils.ts     # Helper functions
        ├── store/
        │   └── appStore.ts  # Zustand state management
        └── types/
            └── index.ts     # TypeScript types
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/{id}/progress` | Learning statistics |
| `GET` | `/api/words/` | Vocabulary list |
| `POST` | `/api/words/` | Add word |
| `GET` | `/api/train/queue` | Training queue |
| `POST` | `/api/train/review` | Submit review rating |
| `POST` | `/api/ai/sentence` | Generate AI example sentence |

Full documentation: http://localhost:8000/docs
