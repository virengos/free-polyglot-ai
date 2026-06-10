"use client";

import { useCallback, useState } from "react";
import { vocabularyApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import type { VocabularyWord } from "@/types";
import { LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import {
  Globe,
  Network,
  RefreshCcw,
  Trophy,
  Loader2,
  Play,
  Link2,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface MindNode {
  id: string;
  wordId: number;
  content: string;
  hint: string | null;
  type: "word" | "translation";
  x: number;
  y: number;
  isMatched: boolean;
}

interface DrawnLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  correct: boolean;
}

/* ─── Layout constants ─────────────────────────────────────────────────────── */

const W = 740;
const H = 660;
const CX = W / 2;
const CY = 345;
const INNER_R = 165;
const OUTER_R = 292;
const NW = 104; // node width
const NH = 40; // node height

/* ─── Difficulty config ────────────────────────────────────────────────────── */

const DIFF_OPTIONS = [
  { value: "easy", label: "Easy", count: 5, desc: "5 pairs" },
  { value: "medium", label: "Medium", count: 7, desc: "7 pairs" },
  { value: "hard", label: "Hard", count: 9, desc: "9 pairs" },
] as const;

type Difficulty = "easy" | "medium" | "hard";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function truncate(s: string, max = 14): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function buildNodes(words: VocabularyWord[]): MindNode[] {
  const n = words.length;
  // Outer slots are shuffled so translations don't align with their words
  const outerSlots = shuffle(Array.from({ length: n }, (_, i) => i));

  const wordNodes: MindNode[] = words.map((w, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      id: `w-${w.id}`,
      wordId: w.id,
      content: w.word,
      hint: w.example_sentence ?? null,
      type: "word",
      x: CX + INNER_R * Math.cos(angle) - NW / 2,
      y: CY + INNER_R * Math.sin(angle) - NH / 2,
      isMatched: false,
    };
  });

  const transNodes: MindNode[] = words.map((w, i) => {
    // Half-step offset so outer nodes sit between inner ones
    const angle =
      (outerSlots[i] / n) * 2 * Math.PI - Math.PI / 2 + Math.PI / n;
    return {
      id: `t-${w.id}`,
      wordId: w.id,
      content: w.translation,
      hint: w.example_translation ?? null,
      type: "translation",
      x: CX + OUTER_R * Math.cos(angle) - NW / 2,
      y: CY + OUTER_R * Math.sin(angle) - NH / 2,
      isMatched: false,
    };
  });

  return [...wordNodes, ...transNodes];
}

/** Returns the centre pixel of a positioned node */
const nc = (x: number, y: number): [number, number] => [
  x + NW / 2,
  y + NH / 2,
];

/* ─── NodeCard sub-component ───────────────────────────────────────────────── */

interface NodeCardProps {
  node: MindNode;
  isSelected: boolean;
  hasError: boolean;
  onClick: () => void;
}

function NodeCard({ node, isSelected, hasError, onClick }: NodeCardProps) {
  const [hovered, setHovered] = useState(false);

  let border = "border-slate-600";
  let bg = "bg-slate-800";
  let text = "text-slate-200";
  let ring = "";

  if (node.isMatched) {
    border = "border-green-500";
    bg = "bg-green-900/50";
    text = "text-green-300";
  } else if (hasError) {
    border = "border-red-500";
    bg = "bg-red-900/50";
    text = "text-red-300";
  } else if (isSelected) {
    border = "border-indigo-400";
    bg = "bg-indigo-900/60";
    text = "text-white";
    ring = "ring-2 ring-indigo-400/40";
  } else if (node.type === "word") {
    border = "border-sky-700/70";
    bg = "bg-sky-900/30";
    text = "text-sky-200";
  } else {
    border = "border-violet-700/70";
    bg = "bg-violet-900/30";
    text = "text-violet-200";
  }

  return (
    <div
      className="absolute z-10"
      style={{ left: node.x, top: node.y, width: NW, height: NH }}
    >
      <button
        onClick={onClick}
        disabled={node.isMatched}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={node.content}
        className={[
          "w-full h-full rounded-xl border-2 text-xs font-medium",
          "flex items-center justify-center text-center px-1.5 leading-tight",
          "transition-all duration-150",
          border,
          bg,
          text,
          ring,
          node.isMatched
            ? "cursor-default"
            : "cursor-pointer hover:brightness-125 hover:scale-105 active:scale-95",
          isSelected ? "scale-105" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {truncate(node.content)}
      </button>

      {/* Example sentence tooltip on hover */}
      {hovered && node.hint && !node.isMatched && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-300 shadow-xl pointer-events-none">
          <p className="font-medium text-slate-400 mb-0.5">
            {node.type === "word" ? "Example" : "Translation"}
          </p>
          <p className="italic leading-snug">{node.hint}</p>
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -translate-y-px block w-2.5 h-2.5 rotate-45 bg-slate-900 border-r border-b border-slate-700" />
        </div>
      )}
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────────── */

export default function MindmapGame() {
  const { currentUserId, sessionLanguage, user } = useAppStore();

  /* Setup state */
  const [phase, setPhase] = useState<"setup" | "playing" | "won">("setup");
  const [language, setLanguage] = useState(sessionLanguage ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  /* Game state */
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [noWords, setNoWords] = useState(false);
  const [matched, setMatched] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);

  const targetLangs =
    (user?.target_languages ?? []).length > 0
      ? user!.target_languages
      : sessionLanguage
        ? [sessionLanguage]
        : Object.keys(LANGUAGES);

  /* ── Start / restart game ──────────────────────────────────────────────── */

  const startGame = useCallback(async () => {
    if (!language) return;
    setLoading(true);
    setNoWords(false);
    try {
      const words = await vocabularyApi.list({
        user_id: currentUserId,
        target_language: language,
        limit: 300,
      });

      if (words.length < 3) {
        setNoWords(true);
        return;
      }

      const count =
        DIFF_OPTIONS.find((d) => d.value === difficulty)?.count ?? 7;

      // Group words by category, then pick a random category with enough words
      const groups: Record<string, VocabularyWord[]> = {};
      for (const w of words) {
        const cat = w.category ?? "General";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(w);
      }

      const minNeeded = Math.min(count, 3);
      const viable = Object.entries(groups).filter(
        ([, ws]) => ws.length >= minNeeded
      );

      let pickedWords: VocabularyWord[];
      let pickedCategory: string;

      if (viable.length > 0) {
        const [cat, catWords] =
          viable[Math.floor(Math.random() * viable.length)];
        pickedCategory = cat;
        pickedWords = shuffle(catWords).slice(0, count);
      } else {
        pickedCategory = "Vocabulary";
        pickedWords = shuffle(words).slice(0, count);
      }

      setCategory(pickedCategory);
      setNodes(buildNodes(pickedWords));
      setLines([]);
      setSelectedId(null);
      setErrorIds(new Set());
      setMatched(0);
      setMistakes(0);
      setTotalPairs(pickedWords.length);
      setPhase("playing");
    } finally {
      setLoading(false);
    }
  }, [language, difficulty, currentUserId]);

  const handleReset = () => {
    setPhase("setup");
    setNodes([]);
    setLines([]);
    setSelectedId(null);
    setErrorIds(new Set());
    setNoWords(false);
  };

  /* ── Node click handler ────────────────────────────────────────────────── */

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.isMatched || errorIds.has(nodeId)) return;

    // Deselect if clicking the same node
    if (selectedId === nodeId) {
      setSelectedId(null);
      return;
    }

    // No selection yet – select this node
    if (selectedId === null) {
      setSelectedId(nodeId);
      return;
    }

    const selected = nodes.find((n) => n.id === selectedId)!;

    // Same type → switch selection to the new node
    if (selected.type === node.type) {
      setSelectedId(nodeId);
      return;
    }

    // Different types – attempt a match
    const isMatch = selected.wordId === node.wordId;
    const [sx, sy] = nc(selected.x, selected.y);
    const [nx, ny] = nc(node.x, node.y);

    setLines((prev) => [
      ...prev,
      { x1: sx, y1: sy, x2: nx, y2: ny, correct: isMatch },
    ]);

    if (isMatch) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === selectedId || n.id === nodeId
            ? { ...n, isMatched: true }
            : n
        )
      );
      setMatched((m) => {
        const next = m + 1;
        if (next === totalPairs) {
          setTimeout(() => setPhase("won"), 350);
        }
        return next;
      });
    } else {
      setMistakes((m) => m + 1);
      setErrorIds(new Set([selectedId, nodeId]));
      setTimeout(() => {
        setErrorIds(new Set());
        setLines((prev) => prev.filter((l) => l.correct));
      }, 750);
    }

    setSelectedId(null);
  };

  /* ── Derived values for SVG ────────────────────────────────────────────── */

  const hubLines = nodes
    .filter((n) => n.type === "word")
    .map((n) => {
      const [nx, ny] = nc(n.x, n.y);
      return { x1: CX, y1: CY, x2: nx, y2: ny, matched: n.isMatched };
    });

  const progressPct = totalPairs > 0 ? (matched / totalPairs) * 100 : 0;

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* Setup screen                                                            */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-6 max-w-lg">
        {/* Intro */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
          <Network className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-300 leading-relaxed">
            A mind map of vocabulary words appears on screen. Click a{" "}
            <span className="text-sky-400 font-medium">word</span> in the target
            language, then click its{" "}
            <span className="text-violet-400 font-medium">translation</span> to
            connect them. Complete all connections to win!
          </p>
        </div>

        {/* No-words warning */}
        {noWords && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Not enough vocabulary for this language yet. Add at least 3 words
            first.
          </div>
        )}

        {/* Language selector */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">Language</label>
          <div className="flex flex-wrap gap-2">
            {targetLangs.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  language === lang
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {LANGUAGE_FLAGS[lang] ?? ""}{" "}
                {LANGUAGES[lang] ?? lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty selector */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300">
            Difficulty
          </label>
          <div className="flex gap-3">
            {DIFF_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  difficulty === d.value
                    ? "border-indigo-500 bg-indigo-900/40 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
                }`}
              >
                <span>{d.label}</span>
                <span className="text-xs text-slate-500 mt-0.5">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={startGame}
          disabled={!language || loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start Mind Map
        </button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* Win screen                                                              */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (phase === "won") {
    const accuracy =
      totalPairs > 0
        ? Math.round((totalPairs / (totalPairs + mistakes)) * 100)
        : 100;

    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-400">
          <Trophy className="h-10 w-10 text-yellow-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Mind Map Complete!</h2>
          <p className="mt-2 text-slate-400">
            {totalPairs} connections &middot; {mistakes} mistake
            {mistakes !== 1 ? "s" : ""} &middot; {accuracy}% accuracy
          </p>
          {accuracy === 100 && (
            <p className="mt-1 text-green-400 text-sm font-medium">
              Perfect score — no mistakes!
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={startGame}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            <RefreshCcw className="h-4 w-4" /> Play Again
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors"
          >
            Change Settings
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* Playing screen                                                          */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
          <Globe className="h-4 w-4 text-indigo-400" />
          <span>
            {LANGUAGE_FLAGS[language] ?? ""}{" "}
            {LANGUAGES[language] ?? language.toUpperCase()}
          </span>
          <span className="text-slate-700">&middot;</span>
          <Link2 className="h-4 w-4 text-slate-500" />
          <span className="text-slate-300 font-medium">
            {matched}/{totalPairs}
          </span>
          {mistakes > 0 && (
            <span className="text-red-400 text-xs">&middot; {mistakes} ✗</span>
          )}
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
        >
          <RefreshCcw className="h-3 w-3" />
          Settings
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Instruction hint */}
      <p className="text-xs text-slate-500 min-h-[1rem]">
        {selectedNode == null ? (
          <>
            Click a{" "}
            <span className="text-sky-400">word</span> node, then its{" "}
            <span className="text-violet-400">translation</span> to connect them. Hover nodes to see example sentences.
          </>
        ) : (
          <span className="text-indigo-400 animate-pulse">
            &ldquo;{truncate(selectedNode.content, 20)}&rdquo; selected — now
            click the matching{" "}
            {selectedNode.type === "word" ? "translation" : "word"}…
          </span>
        )}
      </p>

      {/* Game canvas */}
      <div className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="relative" style={{ width: W, height: H }}>
          {/* ── SVG lines ── */}
          <svg
            width={W}
            height={H}
            className="absolute inset-0 pointer-events-none"
          >
            <defs>
              <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Subtle glow around central node */}
            <circle cx={CX} cy={CY} r={70} fill="url(#center-glow)" />

            {/* Hub lines: centre → word nodes */}
            {hubLines.map((l, i) => (
              <line
                key={`hub-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.matched ? "#6366f1" : "#1e293b"}
                strokeWidth={l.matched ? 2 : 1.5}
                strokeDasharray={l.matched ? undefined : "5 4"}
                strokeLinecap="round"
              />
            ))}

            {/* User-drawn connection lines */}
            {lines.map((l, i) => (
              <line
                key={`ln-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.correct ? "#22c55e" : "#ef4444"}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* ── Central category node ── */}
          <div
            className="absolute z-10 flex items-center justify-center rounded-2xl bg-indigo-700 border-2 border-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-700/30 px-3 text-center"
            style={{
              left: CX - 58,
              top: CY - 20,
              width: 116,
              height: 40,
            }}
          >
            {truncate(category, 13)}
          </div>

          {/* ── Word & Translation nodes ── */}
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={selectedId === node.id}
              hasError={errorIds.has(node.id)}
              onClick={() => handleNodeClick(node.id)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-sky-600 bg-sky-900/30" />
          <span>Target language word</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-violet-600 bg-violet-900/30" />
          <span>Translation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-green-500 bg-green-900/40" />
          <span>Matched</span>
        </div>
      </div>
    </div>
  );
}
