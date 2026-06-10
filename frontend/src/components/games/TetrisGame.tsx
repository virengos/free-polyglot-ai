"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RefreshCcw, Volume2, VolumeX } from "lucide-react";

/* ── Constants ────────────────────────────────────────────────────────────── */

const COLS = 10;
const ROWS = 20;
const CELL = 28; // px per cell

const COLORS = [
  "#06b6d4", // I – cyan
  "#facc15", // O – yellow
  "#a855f7", // T – purple
  "#22c55e", // S – green
  "#ef4444", // Z – red
  "#3b82f6", // J – blue
  "#f97316", // L – orange
];

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
];

// Score for 1/2/3/4 cleared lines (multiplied by level+1)
const POINTS = [0, 100, 300, 500, 800];
// Drop interval per level (ms)
const DROP_MS = [800, 700, 600, 500, 400, 300, 220, 160, 110, 70];

const levelOf = (lines: number) => Math.min(9, Math.floor(lines / 10));
const dropMs  = (lines: number) => DROP_MS[levelOf(lines)] ?? 70;

/* ── Types ────────────────────────────────────────────────────────────────── */

type Phase = "idle" | "playing" | "paused" | "gameover";
type Grid  = (string | 0)[][];

interface Piece {
  type: number;
  x:    number;
  y:    number;
  cells: number[][];
}

/* ── Pure helpers ─────────────────────────────────────────────────────────── */

const emptyGrid = (): Grid =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const rndPiece = (): Piece => {
  const t = Math.floor(Math.random() * 7);
  return {
    type: t,
    x: Math.floor(COLS / 2 - SHAPES[t][0].length / 2),
    y: 0,
    cells: SHAPES[t].map((r) => [...r]),
  };
};

const rot90 = (cells: number[][]): number[][] => {
  const R = cells.length, C = cells[0].length;
  const out = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      out[c][R - 1 - r] = cells[r][c];
  return out;
};

const collides = (
  grid:  Grid,
  p:     Piece,
  dx    = 0,
  dy    = 0,
  cells = p.cells,
): boolean => {
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const nx = p.x + c + dx, ny = p.y + r + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && grid[ny][nx] !== 0) return true;
    }
  return false;
};

const mergePiece = (grid: Grid, p: Piece): Grid => {
  const g = grid.map((row) => [...row]);
  for (let r = 0; r < p.cells.length; r++)
    for (let c = 0; c < p.cells[r].length; c++) {
      if (!p.cells[r][c]) continue;
      if (p.y + r >= 0) g[p.y + r][p.x + c] = COLORS[p.type];
    }
  return g;
};

const clearLines = (grid: Grid): [Grid, number] => {
  const kept = grid.filter((row) => row.some((c) => c === 0));
  const n    = ROWS - kept.length;
  const top  = Array.from({ length: n }, () => Array(COLS).fill(0));
  return [[...top, ...kept], n];
};

/* ── Korobeiniki melody (public domain Russian folk song, ~1861) ──────────── */
// Frequencies for the notes used
const HZ: Record<string, number> = {
  A4: 440, B4: 493.88, C5: 523.25, D5: 587.33,
  E5: 659.25, F5: 698.46, G5: 783.99, A5: 880,
};

// [note, duration-in-beats] at 160 BPM
const SONG: [string, number][] = [
  ["E5", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["C5", 0.5], ["B4", 0.5],
  ["A4", 1], ["A4", 0.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1.5], ["C5", 0.5], ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1], ["A4", 2],
  ["D5", 1.5], ["F5", 0.5], ["A5", 1], ["G5", 0.5], ["F5", 0.5],
  ["E5", 1.5], ["C5", 0.5], ["E5", 1], ["D5", 0.5], ["C5", 0.5],
  ["B4", 1], ["B4", 0.5], ["C5", 0.5], ["D5", 1], ["E5", 1],
  ["C5", 1], ["A4", 1], ["A4", 2],
];
const BPM = 160;

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Component                                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function TetrisGame() {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef  = useRef<HTMLCanvasElement>(null);

  /* All volatile game state lives in a ref so no stale-closure issues. */
  const S = useRef({
    grid:       emptyGrid() as Grid,
    piece:      null as Piece | null,
    next:       null as Piece | null,
    score:      0,
    lines:      0,
    phase:      "idle" as Phase,
    dropTimer:  null as ReturnType<typeof setTimeout> | null,
    audioCtx:   null as AudioContext | null,
    gainNode:   null as GainNode | null,
    musicOn:    true,
    melodyIdx:  0,
    musicTimer: null as ReturnType<typeof setTimeout> | null,
  });

  /* React display state – updated via sync() */
  const [phase,   setPhase]   = useState<Phase>("idle");
  const [score,   setScore]   = useState(0);
  const [level,   setLevel]   = useState(0);
  const [lines,   setLines]   = useState(0);
  const [musicOn, setMusicOn] = useState(true);

  const sync = () => {
    const s = S.current;
    setPhase(s.phase);
    setScore(s.score);
    setLevel(levelOf(s.lines));
    setLines(s.lines);
  };

  /* ── Canvas drawing ──────────────────────────────────────────────────── */

  const drawCell = (
    ctx:   CanvasRenderingContext2D,
    x:     number,
    y:     number,
    color: string,
    alpha  = 1,
  ) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    // top shine
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, 4);
    ctx.globalAlpha = 1;
  };

  const drawBoard = () => {
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s   = S.current;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(COLS * CELL, r * CELL); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, ROWS * CELL); ctx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (s.grid[r][c]) drawCell(ctx, c, r, s.grid[r][c] as string);

    // Ghost piece + active piece
    if (s.piece) {
      // Calculate ghost drop position
      let gy = s.piece.y;
      while (!collides(s.grid, s.piece, 0, gy - s.piece.y + 1)) gy++;

      // Ghost
      if (gy !== s.piece.y)
        for (let r = 0; r < s.piece.cells.length; r++)
          for (let c = 0; c < s.piece.cells[r].length; c++)
            if (s.piece.cells[r][c] && gy + r >= 0)
              drawCell(ctx, s.piece.x + c, gy + r, COLORS[s.piece.type], 0.17);

      // Active
      for (let r = 0; r < s.piece.cells.length; r++)
        for (let c = 0; c < s.piece.cells[r].length; c++)
          if (s.piece.cells[r][c] && s.piece.y + r >= 0)
            drawCell(ctx, s.piece.x + c, s.piece.y + r, COLORS[s.piece.type]);
    }

    // Paused overlay
    if (s.phase === "paused") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle   = "#fff";
      ctx.font        = "bold 22px monospace";
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    }
  };

  const drawNext = () => {
    const canvas = nextRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = S.current;
    if (!s.next) return;
    const cells = s.next.cells;
    const ox = Math.floor((4 - cells[0].length) / 2);
    const oy = Math.floor((4 - cells.length) / 2);
    for (let r = 0; r < cells.length; r++)
      for (let c = 0; c < cells[r].length; c++)
        if (cells[r][c]) drawCell(ctx, ox + c, oy + r, COLORS[s.next.type]);
  };

  /* ── Music (Korobeiniki – public domain folk song) ────────────────────── */

  const initAudio = () => {
    const s = S.current;
    if (s.audioCtx) return;
    s.audioCtx  = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    s.gainNode  = s.audioCtx.createGain();
    s.gainNode.gain.value = 0.1;
    s.gainNode.connect(s.audioCtx.destination);
  };

  const playChipNote = (freq: number, dur: number) => {
    const s = S.current;
    if (!s.audioCtx || !s.gainNode) return;
    const osc = s.audioCtx.createOscillator();
    const env = s.audioCtx.createGain();
    osc.type            = "square";
    osc.frequency.value = freq;
    osc.connect(env);
    env.connect(s.gainNode);
    const now = s.audioCtx.currentTime;
    env.gain.setValueAtTime(0.7, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.82);
    osc.start(now);
    osc.stop(now + dur * 0.82);
  };

  // Use a ref so the recursive setTimeout always calls the latest closure
  const scheduleNoteRef = useRef<() => void>(() => {});
  scheduleNoteRef.current = () => {
    const s = S.current;
    if (!s.musicOn) return;
    if (s.phase === "gameover") return;
    const [note, beats] = SONG[s.melodyIdx];
    const dur = (60 / BPM) * beats; // seconds
    if (s.phase === "playing") playChipNote(HZ[note] ?? 440, dur);
    s.melodyIdx  = (s.melodyIdx + 1) % SONG.length;
    s.musicTimer = setTimeout(() => scheduleNoteRef.current(), dur * 1000);
  };

  const startMusic = () => {
    const s = S.current;
    if (s.musicTimer) clearTimeout(s.musicTimer);
    initAudio();
    scheduleNoteRef.current();
  };

  const stopMusic = () => {
    const s = S.current;
    if (s.musicTimer) { clearTimeout(s.musicTimer); s.musicTimer = null; }
  };

  /* ── Drop scheduling ─────────────────────────────────────────────────── */

  // Refs so setTimeout callbacks always see the latest implementation
  const dropRef         = useRef<() => void>(() => {});
  const scheduleDropRef = useRef<(delay?: number) => void>(() => {});

  scheduleDropRef.current = (delay?: number) => {
    const s = S.current;
    if (s.dropTimer) clearTimeout(s.dropTimer);
    const ms     = delay ?? dropMs(s.lines);
    s.dropTimer  = setTimeout(() => dropRef.current(), ms);
  };

  /* ── Game logic ──────────────────────────────────────────────────────── */

  const lockAndSpawn = () => {
    const s = S.current;
    if (!s.piece) return;

    const [g2, cleared] = clearLines(mergePiece(s.grid, s.piece));
    s.grid  = g2;
    s.piece = null;

    if (cleared > 0) {
      s.score += (POINTS[cleared] ?? 0) * (levelOf(s.lines) + 1);
      s.lines += cleared;
    }

    // Spawn the next piece
    s.piece = s.next ?? rndPiece();
    s.next  = rndPiece();

    if (collides(s.grid, s.piece)) {
      s.phase = "gameover";
      stopMusic();
      if (s.dropTimer) clearTimeout(s.dropTimer);
      sync();
      drawBoard();
      return;
    }

    sync();
    drawNext();
    drawBoard();
    scheduleDropRef.current();
  };

  dropRef.current = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    if (!collides(s.grid, s.piece, 0, 1)) {
      s.piece = { ...s.piece, y: s.piece.y + 1 };
      drawBoard();
      scheduleDropRef.current();
    } else {
      lockAndSpawn();
    }
  };

  /* ── User input actions ──────────────────────────────────────────────── */

  const moveLeft = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    if (!collides(s.grid, s.piece, -1)) {
      s.piece = { ...s.piece, x: s.piece.x - 1 };
      drawBoard();
    }
  };

  const moveRight = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    if (!collides(s.grid, s.piece, 1)) {
      s.piece = { ...s.piece, x: s.piece.x + 1 };
      drawBoard();
    }
  };

  const softDrop = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    if (s.dropTimer) clearTimeout(s.dropTimer);
    dropRef.current();
  };

  const rotatePiece = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    const rotated = rot90(s.piece.cells);
    // Wall-kick: try offsets 0, -1, +1, -2, +2
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(s.grid, s.piece, kick, 0, rotated)) {
        s.piece = { ...s.piece, cells: rotated, x: s.piece.x + kick };
        drawBoard();
        return;
      }
    }
  };

  const hardDrop = () => {
    const s = S.current;
    if (s.phase !== "playing" || !s.piece) return;
    while (!collides(s.grid, s.piece, 0, 1)) {
      s.piece  = { ...s.piece, y: s.piece.y + 1 };
      s.score += 2;
    }
    if (s.dropTimer) clearTimeout(s.dropTimer);
    lockAndSpawn();
  };

  const startGame = () => {
    const s = S.current;
    if (s.dropTimer) clearTimeout(s.dropTimer);
    stopMusic();
    s.grid      = emptyGrid();
    s.score     = 0;
    s.lines     = 0;
    s.melodyIdx = 0;
    s.next      = rndPiece();
    s.piece     = rndPiece();
    s.phase     = "playing";
    sync();
    drawNext();
    drawBoard();
    scheduleDropRef.current();
    if (s.musicOn) startMusic();
  };

  const togglePause = () => {
    const s = S.current;
    if (s.phase === "playing") {
      s.phase = "paused";
      if (s.dropTimer) clearTimeout(s.dropTimer);
      stopMusic();
    } else if (s.phase === "paused") {
      s.phase = "playing";
      scheduleDropRef.current();
      if (s.musicOn) startMusic();
    }
    sync();
    drawBoard();
  };

  const toggleMusic = () => {
    const s = S.current;
    s.musicOn = !s.musicOn;
    setMusicOn(s.musicOn);
    if (s.musicOn && s.phase === "playing") startMusic();
    else stopMusic();
  };

  /* ── Keyboard handler (stored in ref to avoid stale closures) ────────── */

  const actionsRef = useRef({ moveLeft, moveRight, softDrop, rotatePiece, hardDrop, togglePause, toggleMusic });
  actionsRef.current = { moveLeft, moveRight, softDrop, rotatePiece, hardDrop, togglePause, toggleMusic };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = actionsRef.current;
      switch (e.code) {
        case "ArrowLeft":  e.preventDefault(); a.moveLeft();     break;
        case "ArrowRight": e.preventDefault(); a.moveRight();    break;
        case "ArrowDown":  e.preventDefault(); a.softDrop();     break;
        case "ArrowUp":    e.preventDefault(); a.rotatePiece();  break;
        case "Space":      e.preventDefault(); a.hardDrop();     break;
        case "KeyP":                           a.togglePause();  break;
        case "KeyM":                           a.toggleMusic();  break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Touch / swipe controls ──────────────────────────────────────────── */

  const touch0 = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch0.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const t0 = touch0.current;
    if (!t0) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - t0.x;
    const dy = t.clientY - t0.y;
    const dt = Date.now() - t0.t;
    touch0.current = null;

    // Tap → rotate
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 300) {
      rotatePiece();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -20) moveLeft();
      else if (dx > 20) moveRight();
    } else {
      if (dy > 25) softDrop();
      else if (dy < -50) hardDrop();
    }
  };

  /* ── Initial draw & cleanup ──────────────────────────────────────────── */

  useEffect(() => {
    drawBoard();
    drawNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      const s = S.current;
      if (s.dropTimer)  clearTimeout(s.dropTimer);
      if (s.musicTimer) clearTimeout(s.musicTimer);
      s.audioCtx?.close().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* Render                                                                  */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div
      className="flex flex-col items-center gap-4 select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-start gap-5 flex-wrap justify-center">

        {/* ── Board ─────────────────────────────────────────────────────── */}
        <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl shadow-slate-950/60">
          <canvas ref={boardRef} width={COLS * CELL} height={ROWS * CELL} />

          {/* Idle overlay */}
          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/88 gap-3">
              <p className="text-white font-black text-4xl font-mono tracking-[0.2em] drop-shadow-lg">
                TETRIS
              </p>
              <p className="text-slate-400 text-xs tracking-wide">
                Take a break &amp; relax your mind
              </p>
              <button
                onClick={startGame}
                className="mt-3 flex items-center gap-2 px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors text-sm shadow-lg"
              >
                <Play className="h-4 w-4" /> Start
              </button>
              <p className="text-slate-600 text-[10px] mt-1">
                ♪ Korobeiniki (1861) plays in background
              </p>
            </div>
          )}

          {/* Game-over overlay */}
          {phase === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-2">
              <p className="text-red-400 font-black text-2xl font-mono tracking-widest">
                GAME OVER
              </p>
              <p className="text-slate-300 text-sm">
                Score:{" "}
                <span className="font-bold text-white">
                  {score.toLocaleString()}
                </span>
              </p>
              <button
                onClick={startGame}
                className="mt-3 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors text-sm"
              >
                <RefreshCcw className="h-4 w-4" /> Play Again
              </button>
            </div>
          )}
        </div>

        {/* ── Side panel ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ minWidth: 118 }}>

          {/* Next piece */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest text-center mb-2">
              NEXT
            </p>
            <canvas
              ref={nextRef}
              width={4 * CELL}
              height={4 * CELL}
              className="block rounded-lg"
            />
          </div>

          {/* Stats */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 flex flex-col gap-3">
            {(
              [
                ["SCORE", score.toLocaleString()],
                ["LEVEL", (level + 1).toString()],
                ["LINES", lines.toString()],
              ] as [string, string][]
            ).map(([lbl, val]) => (
              <div key={lbl}>
                <p className="text-[10px] font-bold text-slate-500 tracking-widest">{lbl}</p>
                <p className="text-white font-bold font-mono text-xl leading-none">{val}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1.5">
            {(phase === "playing" || phase === "paused") && (
              <>
                <button
                  onClick={togglePause}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
                >
                  {phase === "paused" ? (
                    <><Play className="h-3 w-3" /> Resume</>
                  ) : (
                    <><Pause className="h-3 w-3" /> Pause</>
                  )}
                </button>
                <button
                  onClick={startGame}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
                >
                  <RefreshCcw className="h-3 w-3" /> Restart
                </button>
              </>
            )}
            <button
              onClick={toggleMusic}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors"
            >
              {musicOn ? (
                <><Volume2 className="h-3 w-3" /> Music On</>
              ) : (
                <><VolumeX className="h-3 w-3" /> Muted</>
              )}
            </button>
          </div>

          {/* Key reference */}
          <div className="text-[10px] text-slate-600 font-mono space-y-0.5 leading-relaxed pt-1">
            <p>← → &nbsp; move</p>
            <p>↑ &nbsp;&nbsp;&nbsp;&nbsp; rotate</p>
            <p>↓ &nbsp;&nbsp;&nbsp;&nbsp; soft drop</p>
            <p>SPC &nbsp; hard drop</p>
            <p>P &nbsp;&nbsp;&nbsp;&nbsp; pause</p>
            <p>M &nbsp;&nbsp;&nbsp;&nbsp; music</p>
          </div>
        </div>
      </div>
    </div>
  );
}
