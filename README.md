# 🌍 Polyglot AI – AI Vocabulary Trainer

An adaptive, AI-powered vocabulary trainer for polyglots. Train multiple languages in parallel with spaced repetition (SM-2), AI-generated content, favorites, and various exercise formats.

## Features

- **Spaced Repetition (SM-2)**: Intelligent review scheduling — well-known words are only repeated after a growing interval (1 day → 6 → 15 → ...). Memory strength shown as 0–100%
- **3 Exercise formats**: Flashcards (3D flip), Multiple Choice, Write mode — configurable per user in Settings
- **6 Languages**: German, English, Spanish, French, Swedish, Polish
- **AI content**: Example sentences, word explanations & **automatic vocabulary suggestions** via **Mistral AI**
- **Favorites**: Star any word on the flashcard or vocabulary list; filter to show only favorites
- **Vocabulary editing**: Edit translation, example sentence, notes and tags without resetting learning progress
- **Dashboard**: XP, level, streak, learning progress (Mastered / In Progress / New), language statistics
- **High-quality Text-to-Speech**: Neural female voices via Microsoft Edge TTS (Azure Neural, no API key required) — pronunciation on every word, translation, and example sentence
- **Settings**: Native language, target languages with CEFR proficiency levels (A1–C2), daily word goal, and preferred exercise types
- **AI vocabulary suggestions**: The AI automatically suggests and saves new vocabulary words based on existing ones — available on the Training and Vocabulary pages
- **Demo data**: Automatic seeding on first launch

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend | FastAPI (Python 3.12), SQLAlchemy ORM |
| Database | SQLite (default) / PostgreSQL |
| AI | Mistral AI (via `MISTRAL_API_KEY`) |
| TTS | edge-tts (Microsoft Azure Neural Voices — free, no API key) |
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
MISTRAL_API_KEY=your-key-here   # Required for AI features
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
| `MISTRAL_API_KEY` | Mistral AI key for AI features (sentences, word info) | *(optional)* |
| `FRONTEND_URL` | CORS origin of the frontend | `http://localhost:3000` |

> When `MISTRAL_API_KEY` is set, the AI endpoints (`/api/ai/*`) are activated.  
> The file `backend/.env` is **not** committed to the repository (`.gitignore`).
>
> **Text-to-Speech** works out of the box without any API key — it uses Microsoft Edge TTS (Azure Neural Voices) via the `edge-tts` library.

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | URL of the backend | `http://localhost:8000` |

## Text-to-Speech

Pronunciation is powered by **Microsoft Edge TTS** (Azure Cognitive Services Neural Voices), free and with no API key required. A high-quality female voice is used for each supported language:

| Language | Voice |
|----------|-------|
| German | `de-DE-KatjaNeural` |
| English | `en-GB-SoniaNeural` |
| Spanish | `es-ES-ElviraNeural` |
| French | `fr-FR-DeniseNeural` |
| Swedish | `sv-SE-SofieNeural` |
| Polish | `pl-PL-ZofiaNeural` |

Speaker buttons appear on every word card, flashcard (front & back), and exercise. The example sentence on the back of flashcards is also speakable. If the backend is unreachable, the browser's built-in Web Speech API is used as a fallback.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/train/queue` | Words due for review (SM-2); `include_all=true` for forced practice |
| `POST` | `/api/train/review` | Submit rating (0–5) and update SM-2 state |
| `GET` | `/api/words/` | List vocabulary; supports `search`, `target_language`, `favorites_only` |
| `PATCH` | `/api/words/{id}/favorite` | Toggle favorite status |
| `PUT` | `/api/words/{id}` | Edit word (does not reset learning progress) |
| `GET` | `/api/users/{id}/progress` | Full progress stats (mastered, learning, new, accuracy) |
| `POST` | `/api/ai/suggest` | AI suggests & auto-saves new words for a language pair |
| `POST` | `/api/ai/sentence` | Generate example sentence for a word |
| `GET` | `/api/tts/speak` | Edge TTS audio stream |

Full interactive docs: http://localhost:8000/docs

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
│   │   ├── ai.py            # AI endpoints
│   │   └── tts.py           # Neural TTS endpoint (edge-tts)
│   └── services/
│       ├── spaced_repetition.py  # SM-2 algorithm
│       └── ai_service.py         # Mistral AI integration
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
        │   ├── tts.ts       # TTS utility (edge-tts via backend, Web Speech fallback)
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
| `POST` | `/api/tts` | Text-to-speech (neural voice audio) |
| `PUT` | `/api/users/{id}` | Update user settings (language, proficiency, goals) |

Full documentation: http://localhost:8000/docs

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
