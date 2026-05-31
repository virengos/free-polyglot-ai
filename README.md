# 🌍 Polyglot AI – AI Vocabulary Trainer

An adaptive, AI-powered vocabulary trainer for polyglots. Train multiple languages in parallel with spaced repetition (SM-2), AI-generated content, semantic category folders, and contextual word images.

## Features

- **Spaced Repetition (SM-2)**: Intelligent review scheduling — well-known words are only repeated after a growing interval (1 day → 6 → 15 → …). Memory strength shown as 0–100%
- **3 Exercise formats**: Flashcards (3D flip), Multiple Choice, Write mode — configurable per user in Settings
- **6 Languages**: German, English, Spanish, French, Swedish, Polish
- **AI image generation**: Every vocabulary word (including verbs and adjectives) gets an automatically generated illustration via Mistral + LoremFlickr. Missing images are filled in the background on page load and after AI suggestions. A **↺ Regenerate** button on every flashcard and vocabulary card lets you request a fresh image when the current one is wrong.
- **Semantic vocabulary folders**: Words are automatically classified into 20 categories (Animals, Food, Verbs, Clothing, …) and displayed in folder-style navigation on the vocabulary page
- **AI vocabulary suggestions**: Proficiency-aware — the AI selects words appropriate for your CEFR level (A1–C2). Full deduplication: the AI receives the complete exclusion list of existing words, and the API enforces uniqueness at the database level (HTTP 409 on conflict).
- **AI content**: Context-aware example sentences and full word info (translation, part of speech, example, synonym) via Mistral AI
- **Favorites**: Star any word on the flashcard or vocabulary list; filter to show only favorites
- **Vocabulary editing**: Edit translation, example sentence, notes and tags without resetting learning progress
- **Dashboard**: XP, level, streak, learning progress (Mastered / In Progress / New), language statistics, and a contextual call-to-action for new users
- **High-quality Text-to-Speech**: Neural female voices via Microsoft Edge TTS (Azure Neural, no API key required) — pronunciation on every word, translation, and example sentence
- **One Language at a Time**: Each training session is locked to a single target language — a language picker appears at the start of every session. The session language resets on page refresh, preventing cross-language interference. AI vocabulary suggestions are also scoped to the active session language.
- **Settings**: Native language, target languages with CEFR proficiency levels (A1–C2), daily word goal, preferred exercise types, and **Audit panel** (see below)
- **Audit panel** *(Settings → Audit)*: Real-time scan of all installed Python dependency licences (approved / review / restricted) with search and filter; feature-originality checklist documenting how each feature is independently developed relative to commercial apps (Duolingo, Quizlet, Anki, Reverso)
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
|----------|-------------|---------|
| `DATABASE_URL` | SQLite or PostgreSQL URL | `sqlite:///./polyglot.db` |
| `MISTRAL_API_KEY` | Mistral AI key for AI features (sentences, word info, image keywords, suggestions) | *(optional)* |
| `FRONTEND_URL` | CORS origin of the frontend | `http://localhost:3000` |
| `LLM_MODEL` | Mistral model for complex tasks | `mistral-large-latest` |

> When `MISTRAL_API_KEY` is set, the AI endpoints (`/api/ai/*`) are activated.  
> The file `backend/.env` is **not** committed to the repository (`.gitignore`).
>
> Simple tasks (image keyword lookup, category classification) use `mistral-small-latest` to preserve rate-limit quota on the large model.  
> **Text-to-Speech** works out of the box without any API key — it uses Microsoft Edge TTS (Azure Neural Voices) via the `edge-tts` library.

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
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

## Image Generation

Every vocabulary word is illustrated with a contextual image sourced from [LoremFlickr](https://loremflickr.com). The flow:

1. **On word creation** — Mistral (`mistral-small-latest`) determines the best English search keyword for the word (e.g. `laufen` → `running`). The keyword is used to build a stable LoremFlickr URL.
2. **On vocabulary page load** — Words without an image are detected and queued for background generation (throttled at 1.5 s/word to avoid rate limits).
3. **On AI Suggest** — After new words are saved, all words still missing images (new + pre-existing) are also filled in the background.
4. **Manual regeneration** — Every VocabCard and Flashcard shows a ↺ button. Clicking it asks the AI for a new keyword with a random LoremFlickr lock so a different image is returned each time.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/train/queue` | Words due for review (SM-2); `include_all=true` for forced practice |
| `POST` | `/api/train/review` | Submit rating (0–5) and update SM-2 state |
| `GET` | `/api/words/` | List vocabulary; supports `search`, `target_language`, `favorites_only`, `category` |
| `GET` | `/api/words/categories` | List all semantic vocabulary categories |
| `POST` | `/api/words/` | Add a word (background AI enrichment: category + image) |
| `PUT` | `/api/words/{id}` | Edit word (does not reset learning progress) |
| `PATCH` | `/api/words/{id}/favorite` | Toggle favorite status |
| `GET` | `/api/users/{id}/progress` | Full progress stats (mastered, learning, new, accuracy) |
| `PUT` | `/api/users/{id}` | Update user settings (language, proficiency, goals) |
| `POST` | `/api/ai/suggest` | AI suggests & auto-saves new words (proficiency-aware, full deduplication); also fills missing images for all words |
| `POST` | `/api/ai/image` | Generate (or regenerate) an image URL for a single word |
| `POST` | `/api/ai/fill-missing-images` | Queue background image generation for all words without an image |
| `POST` | `/api/ai/sentence` | Generate example sentence for a word |
| `GET` | `/api/ai/status` | Check which AI providers are configured |
| `GET` | `/api/tts/speak` | Edge TTS audio stream |
| `GET` | `/api/audit/licenses` | Scan all installed Python packages and classify their licences |
| `GET` | `/api/audit/compliance` | Feature-originality checklist (independent development documentation) |

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
│   │   ├── vocabulary.py    # CRUD words + background AI enrichment
│   │   ├── training.py      # Queue, review, sessions
│   │   ├── progress.py      # Statistics, user management
│   │   ├── ai.py            # AI endpoints (suggest, image, sentence, fill)
│   │   ├── tts.py           # Neural TTS endpoint (edge-tts)
│   │   └── audit.py         # Licence compliance scan + feature-originality checklist
│   └── services/
│       ├── spaced_repetition.py  # SM-2 algorithm
│       └── ai_service.py         # Mistral AI integration (small + large models)
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Dashboard
        │   ├── training/        # Training page
        │   ├── vocabulary/      # Vocabulary management + category folders
        │   └── settings/        # User language + proficiency settings + Audit panel
        ├── components/
        │   ├── exercises/
        │   │   ├── Flashcard.tsx       # 3D flashcard with image + regenerate
        │   │   ├── MultipleChoice.tsx  # Multiple choice exercise
        │   │   └── WriteExercise.tsx   # Write mode
        │   ├── Navbar.tsx
        │   ├── AddWordModal.tsx
        │   ├── VocabCard.tsx           # Vocabulary card with image + regenerate
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

## Third-Party Dependencies & License Compliance

This project is released under the **MIT License**. The majority of dependencies also use permissive licences (MIT, Apache-2.0, BSD). One dependency carries a **weak copyleft** licence that requires attribution:

### LGPL v3 Dependency: `edge-tts`

| Field | Value |
|-------|-------|
| Package | `edge-tts` |
| Version | ≥ 6.1.9 (see `requirements.txt`) |
| Licence | GNU Lesser General Public License v3.0 (LGPLv3) |
| Source | https://github.com/rany2/edge-tts |
| Licence text | https://www.gnu.org/licenses/lgpl-3.0.html |

#### How we comply with LGPLv3

1. **Attribution** — `edge-tts` is listed here and in `requirements.txt`. Its LGPLv3 licence is acknowledged.
2. **No modification** — `edge-tts` is used as-is via the public Python API. No source code of the library has been modified or embedded.
3. **Replaceability** — Because `edge-tts` is an ordinary pip dependency, any user can upgrade, downgrade, or replace it by editing `requirements.txt` and reinstalling. No static linking or bundling is performed.
4. **Our code stays MIT** — Only the library code is under LGPLv3. All source code in this repository remains under the MIT licence.

The in-app **Audit → Dependency Licences** panel (`Settings → Audit`) lists every installed package and its detected licence at runtime.

---

## License

MIT License — Copyright (c) 2024 Damian Berghof
