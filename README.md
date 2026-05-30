# 🌍 Polyglot AI – KI-Vokabeltrainer

Ein adaptiver, KI-gestützter Vokabeltrainer für Polyglotten. Trainiere mehrere Sprachen parallel mit Spaced-Repetition, KI-generierten Inhalten und verschiedenen Übungsformaten.

## Features

- **Spaced Repetition (SM-2)**: Intelligente Wiederholungsplanung mit Gedächtnisstärkung 0–100
- **3 Übungsformate**: Karteikarten (3D-Flip), Multiple Choice, Schreibmodus
- **6 Sprachen**: Deutsch, Englisch, Spanisch, Französisch, Schwedisch, Polnisch
- **KI-Inhalte**: Beispielsätze & Worterklärungen via Mistral AI oder Anthropic Claude
- **Dashboard**: XP, Streak, Lernfortschritt, Sprachstatistiken
- **Text-to-Speech**: Browser-native Aussprache für jede Vokabel
- **Demo-Daten**: Automatisches Seeding beim ersten Start

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend | FastAPI (Python 3.12), SQLAlchemy ORM |
| Datenbank | SQLite (Standard) / PostgreSQL |
| KI | Mistral AI · Anthropic Claude (optional, per API-Key) |
| DevOps | Docker Compose, start.sh |

## Schnellstart

### Einfachster Weg – start.sh

```bash
./start.sh
```

Das Skript richtet automatisch ein:
- Python Virtual Environment + pip-Abhängigkeiten
- `backend/.env` (falls nicht vorhanden)
- `frontend/.env.local`
- Startet Backend (Port 8000) und Frontend (Port 3000)

> Ports anpassen: `BACKEND_PORT=8080 FRONTEND_PORT=3001 ./start.sh`

---

### Manueller Start

#### Voraussetzungen

- Python 3.11+
- Node.js 20+

#### 1. Backend starten

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# .env Datei anlegen (wird von start.sh automatisch erstellt)
cat > .env << 'EOF'
DATABASE_URL=sqlite:///./polyglot.db
FRONTEND_URL=http://localhost:3000
# Optional KI:
# MISTRAL_API_KEY=...
# ANTHROPIC_API_KEY=sk-ant-...
EOF

uvicorn main:app --reload
```

Backend läuft auf http://localhost:8000  
API-Docs: http://localhost:8000/docs

#### 2. Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf http://localhost:3000

### Mit Docker Compose

```bash
docker compose up -d
```

Alle Services starten automatisch. Demo-Daten werden beim ersten Start geladen.

## Umgebungsvariablen

### Backend (`backend/.env`)

| Variable | Beschreibung | Standard |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite oder PostgreSQL-URL | `sqlite:///./polyglot.db` |
| `MISTRAL_API_KEY` | Mistral AI API-Key für KI-Features | *(optional)* |
| `ANTHROPIC_API_KEY` | Anthropic Claude API-Key | *(optional)* |
| `FRONTEND_URL` | CORS-Origin des Frontends | `http://localhost:3000` |

> Wird `MISTRAL_API_KEY` gesetzt, werden KI-Endpunkte (`/api/ai/*`) aktiviert.  
> Die Datei `backend/.env` wird **nicht** ins Repository eingecheckt (`.gitignore`).

### Frontend (`frontend/.env.local`)

| Variable | Beschreibung | Standard |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL des Backends | `http://localhost:8000` |

## Projektstruktur

```
free-polyglot-ai/
├── backend/
│   ├── main.py              # FastAPI App, CORS, Lifespan
│   ├── models.py            # SQLAlchemy ORM (User, Word, Session)
│   ├── schemas.py           # Pydantic Schemas
│   ├── database.py          # DB-Verbindung
│   ├── seed_data.py         # Demo-Vokabeln
│   ├── routers/
│   │   ├── vocabulary.py    # CRUD Vokabeln
│   │   ├── training.py      # Queue, Review, Sessions
│   │   ├── progress.py      # Statistiken, User-Management
│   │   └── ai.py            # KI-Endpunkte
│   └── services/
│       ├── spaced_repetition.py  # SM-2 Algorithmus
│       └── ai_service.py         # Claude-Integration
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx         # Dashboard
        │   ├── training/        # Trainingsseite
        │   └── vocabulary/      # Vokabelverwaltung
        ├── components/
        │   ├── exercises/
        │   │   ├── Flashcard.tsx       # 3D-Karteikarte
        │   │   ├── MultipleChoice.tsx  # Auswahlübung
        │   │   └── WriteExercise.tsx   # Schreibmodus
        │   ├── Navbar.tsx
        │   ├── AddWordModal.tsx
        │   ├── VocabCard.tsx
        │   ├── StatCard.tsx
        │   └── ProgressBar.tsx
        ├── lib/
        │   ├── api.ts       # Axios API-Client
        │   └── utils.ts     # Hilfsfunktionen
        ├── store/
        │   └── appStore.ts  # Zustand State Management
        └── types/
            └── index.ts     # TypeScript-Typen
```

## API-Übersicht

| Methode | Endpunkt | Beschreibung |
|---------|----------|-------------|
| `GET` | `/api/users/{id}/progress` | Lernstatistiken |
| `GET` | `/api/words/` | Vokabelliste |
| `POST` | `/api/words/` | Vokabel hinzufügen |
| `GET` | `/api/train/queue` | Trainingswarteschlange |
| `POST` | `/api/train/review` | Bewertung einreichen |
| `POST` | `/api/ai/sentence` | KI-Beispielsatz generieren |

Vollständige Dokumentation: http://localhost:8000/docs
