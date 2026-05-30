#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh – Startet den Polyglot AI Vokabeltrainer (Backend + Frontend)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
LOG_DIR="$SCRIPT_DIR/.logs"
BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ── Farben ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  🌍  Polyglot AI – Vokabeltrainer"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# ── Cleanup bei CTRL+C ────────────────────────────────────────────────────────
cleanup() {
  echo ""
  info "Stoppe alle Dienste…"
  if [[ -f "$BACKEND_PID_FILE" ]]; then
    kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null && success "Backend gestoppt"
    rm -f "$BACKEND_PID_FILE"
  fi
  if [[ -f "$FRONTEND_PID_FILE" ]]; then
    kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null && success "Frontend gestoppt"
    rm -f "$FRONTEND_PID_FILE"
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

mkdir -p "$LOG_DIR"

# ── Voraussetzungen prüfen ────────────────────────────────────────────────────
info "Prüfe Voraussetzungen…"

if ! command -v python3 &>/dev/null; then
  error "Python 3 nicht gefunden. Bitte installieren."
  exit 1
fi

if ! command -v node &>/dev/null; then
  error "Node.js nicht gefunden. Bitte installieren."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  error "npm nicht gefunden. Bitte installieren."
  exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1)
NODE_VERSION=$(node --version 2>&1)
success "Python: $PYTHON_VERSION | Node: $NODE_VERSION"

# ── Backend: .env erstellen falls fehlend ─────────────────────────────────────
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  info "Erstelle backend/.env mit Standard-Werten…"
  cat > "$BACKEND_DIR/.env" << 'ENV'
# Datenbank (SQLite als Standard, für Produktion PostgreSQL verwenden)
DATABASE_URL=sqlite:///./polyglot.db

# CORS
FRONTEND_URL=http://localhost:3000

# Optional: KI-Features
# ANTHROPIC_API_KEY=sk-ant-...
# MISTRAL_API_KEY=...
ENV
  success "backend/.env erstellt"
fi

# ── Backend: Virtuelle Umgebung ────────────────────────────────────────────────
if [[ ! -d "$VENV_DIR" ]]; then
  info "Erstelle Python Virtual Environment…"
  python3 -m venv "$VENV_DIR"
  success "Virtual Environment erstellt"
fi

# Aktivieren
source "$VENV_DIR/bin/activate"

# Abhängigkeiten installieren / aktualisieren
info "Installiere Backend-Abhängigkeiten…"
pip install -q --upgrade pip
pip install -q -r "$BACKEND_DIR/requirements.txt"
success "Backend-Abhängigkeiten installiert"

# ── Frontend: npm install ─────────────────────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "Installiere Frontend-Abhängigkeiten (npm install)…"
  (cd "$FRONTEND_DIR" && npm install --silent)
  success "Frontend-Abhängigkeiten installiert"
fi

# Frontend .env.local
if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}" > "$FRONTEND_DIR/.env.local"
  success "frontend/.env.local erstellt"
fi

# ── Backend starten ───────────────────────────────────────────────────────────
info "Starte Backend auf Port $BACKEND_PORT…"
(
  cd "$BACKEND_DIR"
  source "$VENV_DIR/bin/activate"
  uvicorn main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    --reload \
    >> "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
)

# Kurz warten und prüfen ob Backend läuft
sleep 2
if kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
  success "Backend gestartet (PID: $(cat "$BACKEND_PID_FILE"))"
else
  error "Backend konnte nicht gestartet werden. Log:"
  cat "$LOG_DIR/backend.log"
  exit 1
fi

# ── Frontend starten ──────────────────────────────────────────────────────────
info "Starte Frontend auf Port $FRONTEND_PORT…"
(
  cd "$FRONTEND_DIR"
  npm run dev -- --port "$FRONTEND_PORT" \
    >> "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
)

# Kurz warten und prüfen ob Frontend läuft
sleep 3
if kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
  success "Frontend gestartet (PID: $(cat "$FRONTEND_PID_FILE"))"
else
  error "Frontend konnte nicht gestartet werden. Log:"
  tail -20 "$LOG_DIR/frontend.log"
  cleanup
  exit 1
fi

# ── Fertig ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✅  Polyglot AI läuft!${NC}"
echo -e "  ┌─────────────────────────────────────────────────┐"
echo -e "  │  Frontend:   ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  │  Backend:    ${CYAN}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  │  API-Docs:   ${CYAN}http://localhost:${BACKEND_PORT}/docs${NC}"
echo -e "  ├─────────────────────────────────────────────────┤"
echo -e "  │  Logs:       ${YELLOW}.logs/backend.log${NC}  |  ${YELLOW}.logs/frontend.log${NC}"
echo -e "  └─────────────────────────────────────────────────┘"
echo ""
echo -e "  ${YELLOW}CTRL+C zum Beenden${NC}"
echo ""

# ── Prozesse am Leben halten ──────────────────────────────────────────────────
wait
