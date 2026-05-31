"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { conversationsApi, usersApi } from "@/lib/api";
import type { ConversationTopic, FillInBlankExercise } from "@/lib/api";
import type { User } from "@/types";
import { LANGUAGE_FLAGS, LANGUAGES, CEFR_LEVELS } from "@/types";
import { useAppStore } from "@/store/appStore";
import { MessageSquare, RefreshCcw, CheckCircle, XCircle, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import SpecialCharsBar, { insertAtCursor } from "@/components/SpecialCharsBar";

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isAccepted(input: string, answer: string): boolean {
  const a = input.trim().toLowerCase();
  const b = answer.trim().toLowerCase();
  if (a === b) return true;
  // Numbers require exact match
  if (/^\d+$/.test(b)) return false;
  // Very short words (≤ 3 chars) also require exact match
  if (b.length <= 3) return false;
  // Allow 1 typo up to 6 chars, 2 typos for longer words
  const maxDist = b.length <= 6 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

// ─── Fill-in-the-blank renderer ───────────────────────────────────────────────

function FillBlankExercise({
  exercise,
  language,
  onNext,
}: {
  exercise: FillInBlankExercise;
  language: string;
  onNext: () => void;
}) {
  const parts = exercise.text.split("___");
  const [inputs, setInputs] = useState<string[]>(Array(exercise.blanks.length).fill(""));
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Shuffled word bank — fixed for this exercise instance
  const wordBank = useMemo(() => {
    const shuffled = [...exercise.blanks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise]);

  function handleCheck() {
    const res = exercise.blanks.map((ans, i) => isAccepted(inputs[i], ans));
    setResults(res);
    setChecked(true);
    const allCorrect = res.every(Boolean);
    if (allCorrect) {
      toast.success("Perfekt! 🎉 All blanks correct!");
    } else {
      const wrong = res.filter((r) => !r).length;
      toast.error(`${wrong} answer${wrong > 1 ? "s" : ""} incorrect. Check the highlighted fields.`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      if (i < exercise.blanks.length - 1) {
        inputRefs.current[i + 1]?.focus();
      } else {
        handleCheck();
      }
    }
  }

  function handleInsertChar(char: string) {
    const el = inputRefs.current[focusedIndex];
    const ref = { current: el } as React.RefObject<HTMLInputElement | null>;
    insertAtCursor(ref, char, inputs[focusedIndex] ?? "", (next) => {
      setInputs((prev) => {
        const copy = [...prev];
        copy[focusedIndex] = next;
        return copy;
      });
    });
  }

  /** Click a word-bank chip → fill focused blank (or next empty) */
  function handleWordBankClick(word: string) {
    // Prefer the focused blank if it's empty, otherwise find next empty
    const target =
      inputs[focusedIndex] === ""
        ? focusedIndex
        : inputs.findIndex((v) => v === "");
    if (target === -1) return;
    const next = [...inputs];
    next[target] = word;
    setInputs(next);
    setFocusedIndex(target);
    requestAnimationFrame(() => inputRefs.current[target]?.focus());
  }

  // Which word-bank chips are already "used" (filled into some blank)
  const usedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inputs.forEach((v) => {
      const key = v.trim().toLowerCase();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [inputs]);

  const bankUsedCount: Record<string, number> = {};
  const isChipUsed = (word: string) => {
    const key = word.toLowerCase();
    bankUsedCount[key] = (bankUsedCount[key] ?? 0) + 1;
    return (usedCounts[key] ?? 0) >= bankUsedCount[key];
  };
  // Reset per-render counter before mapping
  Object.keys(bankUsedCount).forEach((k) => delete bankUsedCount[k]);

  const blankHints = exercise.blank_hints ?? [];

  return (
    <div className="space-y-5">
      {/* Hint */}
      {exercise.hint && (
        <p className="text-slate-400 text-sm italic">{exercise.hint}</p>
      )}

      {/* Word bank */}
      {!checked && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
            Word bank — click to fill the active blank
          </p>
          <div
            className="flex flex-wrap gap-2"
            onMouseDown={(e) => e.preventDefault()}
          >
            {wordBank.map((word, idx) => {
              const used = isChipUsed(word);
              return (
                <button
                  key={idx}
                  type="button"
                  tabIndex={-1}
                  disabled={checked || used}
                  onClick={() => handleWordBankClick(word)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-sm font-semibold transition-colors",
                    used
                      ? "border-slate-700 bg-slate-900/40 text-slate-600 line-through cursor-default"
                      : "border-indigo-700 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-700 hover:text-white cursor-pointer"
                  )}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Special character bar */}
      {!checked && (
        <SpecialCharsBar language={language} onInsert={handleInsertChar} />
      )}

      {/* Text with inline inputs */}
      <div className="bg-slate-800/60 rounded-2xl p-5 text-base leading-[2.8] text-white">
        {parts.map((part, i) => (
          <span key={i}>
            <span>{part}</span>
            {i < exercise.blanks.length && (
              <span className="inline-flex flex-col items-center mx-1 align-bottom">
                <input
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  value={inputs[i]}
                  onChange={(e) => {
                    const next = [...inputs];
                    next[i] = e.target.value;
                    setInputs(next);
                  }}
                  onFocus={() => setFocusedIndex(i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  disabled={checked}
                  placeholder="…"
                  className={cn(
                    "px-2 py-0.5 rounded-lg border text-center text-sm font-semibold outline-none transition-colors",
                    "min-w-[4rem] max-w-[10rem]",
                    !checked
                      ? focusedIndex === i
                        ? "bg-slate-700 border-indigo-500 text-white ring-1 ring-indigo-500"
                        : "bg-slate-700 border-slate-600 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      : results[i]
                      ? "bg-emerald-900/50 border-emerald-500 text-emerald-200"
                      : "bg-red-900/50 border-red-500 text-red-200"
                  )}
                  style={{ width: `${Math.max(4, (inputs[i].length || 3) + 2)}ch` }}
                />
                {/* Per-blank hint label */}
                {!checked && blankHints[i] && (
                  <span className="text-[0.6rem] text-indigo-400/80 leading-none mt-0.5 whitespace-nowrap">
                    {blankHints[i]}
                  </span>
                )}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Answer reveal after check */}
      {checked && results.some((r) => !r) && (
        <div className="bg-slate-800/40 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">
            Correct answers
          </p>
          {exercise.blanks.map((ans, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {results[i] ? (
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="text-slate-300">
                {blankHints[i] ? (
                  <span className="text-slate-500 mr-1">({blankHints[i]})</span>
                ) : (
                  <span className="text-slate-500 mr-1">Blank {i + 1}:</span>
                )}
                <span
                  className={
                    results[i] ? "text-emerald-400" : "text-amber-300 font-semibold"
                  }
                >
                  {ans}
                </span>
                {!results[i] && inputs[i] && (
                  <span className="text-slate-500 text-xs ml-2">
                    (you wrote: &ldquo;{inputs[i]}&rdquo;)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Translation */}
      {checked && (
        <div className="bg-indigo-900/30 border border-indigo-800 rounded-xl p-4">
          <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wide mb-1">
            Translation
          </p>
          <p className="text-slate-300 text-sm">{exercise.translation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!checked ? (
          <button
            onClick={handleCheck}
            disabled={inputs.some((v) => !v.trim())}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Check answers
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Next exercise <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { currentUserId } = useAppStore();
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<ConversationTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<ConversationTopic | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("A2");
  const [exercise, setExercise] = useState<FillInBlankExercise | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi.get(currentUserId).then(setUser).catch(console.error);
    conversationsApi.topics().then(setTopics).catch(console.error);
  }, [currentUserId]);

  // Default language selection when user loads
  useEffect(() => {
    if (user && !selectedLang) {
      setSelectedLang(user.target_languages[0] ?? "en");
    }
  }, [user, selectedLang]);

  async function loadExercise(topic: ConversationTopic) {
    if (!selectedLang) return;
    setSelectedTopic(topic);
    setExercise(null);
    setLoading(true);
    try {
      const ex = await conversationsApi.exercise({
        user_id: currentUserId,
        topic: topic.id,
        target_language: selectedLang,
        source_language: user?.native_language ?? "de",
        level: selectedLevel,
      });
      setExercise(ex);
    } catch {
      toast.error("Could not generate exercise. Is the AI service running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (selectedTopic) {
      await loadExercise(selectedTopic);
    }
  }

  const targetLangs = user?.target_languages ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-indigo-400" />
          Conversations
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Practice everyday conversations with fill-in-the-blank exercises.
        </p>
      </div>

      {/* Language + level selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex gap-2 flex-wrap">
          {targetLangs.map((lang) => (
            <button
              key={lang}
              onClick={() => { setSelectedLang(lang); setExercise(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                selectedLang === lang
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:text-white"
              )}
            >
              <span>{LANGUAGE_FLAGS[lang] ?? "🌐"}</span>
              {LANGUAGES[lang] ?? lang}
            </button>
          ))}
        </div>

        <select
          value={selectedLevel}
          onChange={(e) => { setSelectedLevel(e.target.value); setExercise(null); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
        >
          {CEFR_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Two-column layout: topics left, exercise right */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Topic list */}
        <div className="md:col-span-2 space-y-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => loadExercise(topic)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                selectedTopic?.id === topic.id
                  ? "border-indigo-500 bg-indigo-600/20 text-white"
                  : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              )}
            >
              <span className="text-xl">{topic.emoji}</span>
              <span className="text-sm font-medium">{topic.label}</span>
            </button>
          ))}
        </div>

        {/* Exercise panel */}
        <div className="md:col-span-3">
          {!selectedTopic && !loading && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm gap-2">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p>Select a topic to start practicing.</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm">Generating exercise…</p>
            </div>
          )}

          {!loading && selectedTopic && exercise && (
            <div>
              {/* Topic header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedTopic.emoji}</span>
                  {selectedTopic.label}
                </h2>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  New exercise
                </button>
              </div>
              <FillBlankExercise exercise={exercise} language={selectedLang} onNext={handleNext} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
