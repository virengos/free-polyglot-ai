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

# ── Backend: .env erstellen / aktualisieren ───────────────────────────────────

# Lese MISTRAL_API_KEY aus Root-.env wenn vorhanden
ROOT_MISTRAL_KEY=""
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  ROOT_MISTRAL_KEY=$(grep -E '^MISTRAL_API_KEY=' "$SCRIPT_DIR/.env" \
    | head -1 | cut -d= -f2- | tr -d "'\"\n " || true)
fi

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  info "Erstelle backend/.env mit Standard-Werten…"
  {
    echo "# Datenbank (SQLite als Standard, für Produktion PostgreSQL verwenden)"
    echo "DATABASE_URL=sqlite:///./polyglot.db"
    echo ""
    echo "# CORS"
    echo "FRONTEND_URL=http://localhost:3000"
    echo ""
    echo "# KI-Features"
    if [[ -n "$ROOT_MISTRAL_KEY" ]]; then
      echo "MISTRAL_API_KEY=${ROOT_MISTRAL_KEY}"
    else
      echo "# MISTRAL_API_KEY=..."
    fi
    echo "# ANTHROPIC_API_KEY=sk-ant-..."
    echo "# LLM_MODEL=mistral-large-latest"
  } > "$BACKEND_DIR/.env"
  success "backend/.env erstellt"
else
  # Vorhandene .env: MISTRAL_API_KEY eintragen/aktualisieren wenn aus Root-Env bekannt
  if [[ -n "$ROOT_MISTRAL_KEY" ]]; then
    if grep -q '^MISTRAL_API_KEY=' "$BACKEND_DIR/.env"; then
      # Aktualisieren
      sed -i "s|^MISTRAL_API_KEY=.*|MISTRAL_API_KEY=${ROOT_MISTRAL_KEY}|" "$BACKEND_DIR/.env"
    else
      # Hinzufügen (# MISTRAL_API_KEY= Zeile ersetzen oder ans Ende)
      if grep -q '# MISTRAL_API_KEY=' "$BACKEND_DIR/.env"; then
        sed -i "s|^# MISTRAL_API_KEY=.*|MISTRAL_API_KEY=${ROOT_MISTRAL_KEY}|" "$BACKEND_DIR/.env"
      else
        echo "MISTRAL_API_KEY=${ROOT_MISTRAL_KEY}" >> "$BACKEND_DIR/.env"
      fi
    fi
    success "MISTRAL_API_KEY in backend/.env gesetzt"
  fi
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

# ── Hilfsfunktionen: Port prüfen / freien Port finden ────────────────────────

# Gibt 0 zurück wenn der Port belegt ist, 1 wenn frei
port_in_use() {
  ss -tlnH "sport = :$1" 2>/dev/null | grep -q .
}

# Versucht Port freizugeben; setzt globale Variable FREE_PORT auf den
# tatsächlich nutzbaren Port (kann abweichen wenn kill fehlschlägt)
free_port() {
  local port="$1"
  FREE_PORT="$port"

  if ! port_in_use "$port"; then
    return 0
  fi

  # PID ermitteln – mit -p sichtbar wenn eigener Prozess, sonst leer
  local pid
  pid=$(ss -tlnpH "sport = :$port" 2>/dev/null \
        | grep -oP 'pid=\K[0-9]+' | head -1 || true)

  if [[ -n "$pid" ]]; then
    warn "Port $port wird von PID $pid belegt – versuche zu beenden…"
    kill "$pid" 2>/dev/null || sudo kill "$pid" 2>/dev/null || true
    sleep 1
    if ! port_in_use "$port"; then
      success "Port $port freigegeben"
      return 0
    fi
    kill -9 "$pid" 2>/dev/null || sudo kill -9 "$pid" 2>/dev/null || true
    sleep 1
    if ! port_in_use "$port"; then
      success "Port $port freigegeben"
      return 0
    fi
  else
    warn "Port $port ist belegt (Prozess gehört einem anderen Nutzer)"
  fi

  # Port konnte nicht freigegeben werden → nächsten freien suchen
  warn "Suche alternativen Port ab $((port + 1))…"
  local try=$(( port + 1 ))
  while port_in_use "$try"; do
    (( try++ ))
    if (( try > port + 50 )); then
      error "Kein freier Port im Bereich ${port}–$((port+50)) gefunden."
      exit 1
    fi
  done
  warn "Weiche auf Port $try aus"
  FREE_PORT="$try"
}

# ── Backend starten ───────────────────────────────────────────────────────────
free_port "$BACKEND_PORT"
BACKEND_PORT="$FREE_PORT"

# .env.local immer mit aktuellem Backend-Port schreiben
echo "NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}" > "$FRONTEND_DIR/.env.local"

info "Starte Backend auf Port $BACKEND_PORT…"
> "$LOG_DIR/backend.log"
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
free_port "$FRONTEND_PORT"
FRONTEND_PORT="$FREE_PORT"
info "Starte Frontend auf Port $FRONTEND_PORT…"
> "$LOG_DIR/frontend.log"
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
