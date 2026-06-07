"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { basicsApi, usersApi } from "@/lib/api";
import type { BasicsTopic, BasicsItem, BasicsSet, FillInBlankExercise } from "@/lib/api";
import type { User } from "@/types";
import { LANGUAGE_FLAGS, LANGUAGES, CEFR_LEVELS } from "@/types";
import { useAppStore } from "@/store/appStore";
import {
  GraduationCap,
  RefreshCcw,
  ChevronRight,
  Loader2,
  BookOpen,
  PenLine,
  RotateCcw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import SpecialCharsBar, { insertAtCursor } from "@/components/SpecialCharsBar";

// ─── Levenshtein fuzzy match (same as conversations) ────────────────────────

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
  if (/^\d+$/.test(b)) return false;
  if (b.length <= 3) return false;
  const maxDist = b.length <= 6 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

// ─── Flashcard grid ──────────────────────────────────────────────────────────

function FlashcardGrid({ items }: { items: BasicsItem[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [showExamples, setShowExamples] = useState(false);

  function toggleCard(i: number) {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function flipAll() {
    if (flipped.size === items.length) {
      setFlipped(new Set());
    } else {
      setFlipped(new Set(items.map((_, i) => i)));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={flipAll}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          {flipped.size === items.length ? "Hide all translations" : "Show all translations"}
        </button>
        <button
          onClick={() => setShowExamples((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          {showExamples ? "Hide examples" : "Show examples"}
        </button>
        <span className="text-slate-500 text-xs">Click a card to reveal translation</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((item, i) => {
          const isFlipped = flipped.has(i);
          return (
            <button
              key={i}
              onClick={() => toggleCard(i)}
              className={cn(
                "relative rounded-2xl border p-4 text-center transition-all duration-200 cursor-pointer select-none",
                "min-h-[80px] flex flex-col items-center justify-center gap-1",
                isFlipped
                  ? "border-indigo-500 bg-indigo-900/40"
                  : "border-slate-700 bg-slate-800/60 hover:border-indigo-500/60 hover:bg-slate-800"
              )}
            >
              <span className="text-white font-semibold text-sm leading-snug">{item.word}</span>
              {isFlipped && (
                <span className="text-indigo-300 text-xs font-medium">{item.translation}</span>
              )}
              {isFlipped && showExamples && item.example && (
                <div className="mt-1 border-t border-slate-700 pt-1 w-full text-left">
                  <p className="text-slate-300 text-[0.65rem] italic leading-tight">{item.example}</p>
                  {item.example_translation && (
                    <p className="text-slate-500 text-[0.6rem] leading-tight mt-0.5">
                      {item.example_translation}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fill-in-the-blank exercise (same pattern as conversations) ──────────────

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

  function handleWordBankClick(word: string) {
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
  Object.keys(bankUsedCount).forEach((k) => delete bankUsedCount[k]);

  const blankHints = exercise.blank_hints ?? [];

  return (
    <div className="space-y-5">
      {exercise.hint && (
        <p className="text-slate-400 text-sm italic">{exercise.hint}</p>
      )}

      {/* Word bank */}
      {wordBank.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {wordBank.map((word, i) => {
            const used = isChipUsed(word);
            return (
              <button
                key={i}
                onClick={() => !checked && !used && handleWordBankClick(word)}
                disabled={checked || used}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors",
                  used
                    ? "bg-slate-800/30 border-slate-700 text-slate-600 cursor-not-allowed"
                    : "bg-slate-700 border-slate-600 text-white hover:bg-indigo-700 hover:border-indigo-500 cursor-pointer"
                )}
              >
                {word}
              </button>
            );
          })}
        </div>
      )}

      <SpecialCharsBar language={language} onInsert={handleInsertChar} />

      {/* Sentence with blanks */}
      <div className="bg-slate-800/50 rounded-2xl p-5 text-base leading-loose font-medium text-slate-100 flex flex-wrap items-end gap-x-1">
        {parts.map((part, i) => (
          <span key={i} className="contents">
            {part.split(" ").filter(Boolean).map((token, ti) => (
              <span key={ti}>{token} </span>
            ))}
            {i < exercise.blanks.length && (
              <span className="inline-flex flex-col items-center mx-1">
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

      {/* Answer reveal */}
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
                <span className={results[i] ? "text-emerald-400" : "text-amber-300 font-semibold"}>
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

type Mode = "learn" | "practice";

export default function BasicsPage() {
  const { currentUserId } = useAppStore();
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<BasicsTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<BasicsTopic | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("A1");
  const [mode, setMode] = useState<Mode>("learn");

  const [basicsSet, setBasicsSet] = useState<BasicsSet | null>(null);
  const [exercise, setExercise] = useState<FillInBlankExercise | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi.get(currentUserId).then(setUser).catch(console.error);
    basicsApi.topics().then(setTopics).catch(console.error);
  }, [currentUserId]);

  useEffect(() => {
    if (user && !selectedLang) {
      setSelectedLang(user.target_languages[0] ?? "en");
    }
  }, [user, selectedLang]);

  async function loadContent(topic: BasicsTopic, currentMode: Mode) {
    if (!selectedLang) return;
    setSelectedTopic(topic);
    setBasicsSet(null);
    setExercise(null);
    setLoading(true);
    try {
      const payload = {
        user_id: currentUserId,
        topic: topic.id,
        target_language: selectedLang,
        source_language: user?.native_language ?? "de",
        level: selectedLevel,
      };
      if (currentMode === "learn") {
        const set = await basicsApi.set(payload);
        setBasicsSet(set);
      } else {
        const ex = await basicsApi.exercise(payload);
        setExercise(ex);
      }
    } catch {
      toast.error("Could not generate content. Is the AI service running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleTopicSelect(topic: BasicsTopic) {
    setMode("learn");
    await loadContent(topic, "learn");
  }

  async function handleModeChange(newMode: Mode) {
    setMode(newMode);
    if (selectedTopic) await loadContent(selectedTopic, newMode);
  }

  async function handleNext() {
    if (selectedTopic) await loadContent(selectedTopic, mode);
  }

  const targetLangs = user?.target_languages ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
          Language Basics
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Learn fundamental vocabulary: weekdays, months, numbers, colors, and more.
        </p>
      </div>

      {/* Language + Level selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex gap-2 flex-wrap">
          {targetLangs.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setSelectedLang(lang);
                setBasicsSet(null);
                setExercise(null);
              }}
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
          onChange={(e) => {
            setSelectedLevel(e.target.value);
            setBasicsSet(null);
            setExercise(null);
          }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
        >
          {CEFR_LEVELS.slice(0, 3).map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => handleTopicSelect(topic)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-2xl border text-sm font-medium transition-all",
              selectedTopic?.id === topic.id
                ? "border-indigo-500 bg-indigo-600/30 text-white"
                : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-indigo-500/60 hover:text-white"
            )}
          >
            <span className="text-2xl">{topic.emoji}</span>
            <span className="text-center leading-tight">{topic.label}</span>
            <span className="text-xs text-slate-500">{topic.title_en}</span>
          </button>
        ))}
      </div>

      {/* Content panel */}
      {selectedTopic && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          {/* Topic header + mode toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedTopic.emoji}</span>
              <div>
                <h2 className="text-white font-semibold">{selectedTopic.label}</h2>
                <p className="text-slate-400 text-xs">{selectedTopic.title_en}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleModeChange("learn")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  mode === "learn"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white"
                )}
              >
                <BookOpen className="h-4 w-4" /> Learn
              </button>
              <button
                onClick={() => handleModeChange("practice")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                  mode === "practice"
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white"
                )}
              >
                <PenLine className="h-4 w-4" /> Practice
              </button>
              <button
                onClick={() => loadContent(selectedTopic, mode)}
                disabled={loading}
                title="Reload"
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 transition-colors disabled:opacity-40"
              >
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Generating {mode === "learn" ? "vocabulary set" : "exercise"}…</span>
            </div>
          )}

          {/* Learn mode – flashcard grid */}
          {!loading && mode === "learn" && basicsSet && (
            <FlashcardGrid items={basicsSet.items} />
          )}

          {/* Practice mode – fill-in-the-blank */}
          {!loading && mode === "practice" && exercise && (
            <FillBlankExercise exercise={exercise} language={selectedLang} onNext={handleNext} />
          )}

          {/* Empty state */}
          {!loading && mode === "learn" && !basicsSet && (
            <p className="text-slate-500 text-sm text-center py-8">
              Select a topic above to load the vocabulary set.
            </p>
          )}
          {!loading && mode === "practice" && !exercise && (
            <p className="text-slate-500 text-sm text-center py-8">
              Select a topic above to generate a practice exercise.
            </p>
          )}
        </div>
      )}

      {/* No topic selected yet */}
      {!selectedTopic && (
        <div className="text-center py-12 text-slate-500">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Choose a topic above to start learning.</p>
        </div>
      )}
    </div>
  );
}
