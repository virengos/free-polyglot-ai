"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trainingApi, vocabularyApi, usersApi, aiApi } from "@/lib/api";
import type { VocabularyWord, ExerciseType, User, WordCategory } from "@/types";
import { WORD_CATEGORY_ICONS } from "@/types";
import { useAppStore } from "@/store/appStore";
import Flashcard from "@/components/exercises/Flashcard";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WriteExercise from "@/components/exercises/WriteExercise";
import ProgressBar from "@/components/ProgressBar";
import { CheckCircle, XCircle, Trophy, Sparkles, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

const ALL_EXERCISE_TYPES: ExerciseType[] = ["flashcard", "multiple_choice", "write"];

function pickExerciseType(word: VocabularyWord, allowed: ExerciseType[]): ExerciseType {
  const types = allowed.length > 0 ? allowed : ALL_EXERCISE_TYPES;
  if (word.repetitions === 0) {
    return types.includes("flashcard") ? "flashcard" : types[0];
  }
  return types[Math.floor(Math.random() * types.length)];
}

export default function TrainingPage() {
  const { currentUserId } = useAppStore();
  const [queue, setQueue] = useState<VocabularyWord[]>([]);
  const [categories, setCategories] = useState<WordCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [exerciseType, setExerciseType] = useState<ExerciseType>("flashcard");
  const [loading, setLoading] = useState(true);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestStatus, setSuggestStatus] = useState<string>("");
  const [hasAnyWords, setHasAnyWords] = useState(false);

  /** Minimum vocabulary per language pair before we consider it "bootstrapped". */
  const MIN_WORDS_PER_LANG = 8;

  // Load category definitions once
  useEffect(() => {
    vocabularyApi.categories().then(setCategories).catch(() => {});
  }, []);

  /**
   * Rank target languages by need:
   *  1. Languages with fewer than MIN_WORDS_PER_LANG words (bootstrapping phase)
   *  2. Languages with the lowest average memory strength (struggling phase)
   * Returns sorted list of { targetLang, wordCount, avgStrength }.
   */
  function rankLanguages(
    targetLangs: string[],
    langStats: { target_language: string; total_words: number; avg_memory_strength: number }[]
  ) {
    return [...targetLangs]
      .map((lang) => {
        const stat = langStats.find((s) => s.target_language === lang);
        return {
          targetLang: lang,
          wordCount: stat?.total_words ?? 0,
          avgStrength: stat?.avg_memory_strength ?? 0,
        };
      })
      .sort((a, b) => {
        // Phase 1: prioritise languages below minimum vocabulary threshold
        const aNeeds = a.wordCount < MIN_WORDS_PER_LANG;
        const bNeeds = b.wordCount < MIN_WORDS_PER_LANG;
        if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
        // Within the same phase: fewest words → weakest strength → alphabetical
        if (a.wordCount !== b.wordCount) return a.wordCount - b.wordCount;
        if (a.avgStrength !== b.avgStrength) return a.avgStrength - b.avgStrength;
        return a.targetLang.localeCompare(b.targetLang);
      });
  }

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [words, userData, progressStats] = await Promise.all([
        trainingApi.queue({
          user_id: currentUserId,
          limit: 20,
          category: selectedCategory || undefined,
        }),
        usersApi.get(currentUserId),
        usersApi.progress(currentUserId),
      ]);
      setUser(userData);

      // Auto-bootstrap: silently generate words for languages that have too few.
      // We set loading=false FIRST so the UI is immediately usable, then run
      // the AI generation in the background.
      const targetLangs = userData.target_languages ?? [];
      const ranked = rankLanguages(targetLangs, progressStats.languages ?? []);
      const missingLangs = ranked.filter((l) => l.wordCount < MIN_WORDS_PER_LANG);

      // Show the queue immediately regardless of whether bootstrap is needed
      setQueue(words);
      setIndex(0);
      setCorrect(0);
      setWrong(0);
      setDone(false);
      const allowed = (userData.preferred_exercises ?? []) as ExerciseType[];
      if (words.length > 0) {
        setExerciseType(pickExerciseType(words[0], allowed));
      } else {
        const all = await trainingApi.queue({ user_id: currentUserId, limit: 1, include_all: true });
        setHasAnyWords(all.length > 0);
      }
      setLoading(false);

      if (missingLangs.length > 0 && !suggesting) {
        setSuggesting(true);
        setSuggestStatus(
          `Auto-generating vocabulary for ${missingLangs.map((l) => l.targetLang.toUpperCase()).join(", ")}…`
        );
        try {
          let autoAdded = 0;
          for (const { targetLang } of missingLangs) {
            const proficiencyLevel =
              (userData.language_proficiencies ?? {})[targetLang] ?? "A2";
            try {
              const res = await aiApi.suggestWords({
                user_id: currentUserId,
                source_language: userData.native_language ?? "de",
                target_language: targetLang,
                count: MIN_WORDS_PER_LANG,
                proficiency_level: proficiencyLevel,
              });
              autoAdded += res.added;
            } catch {
              // non-fatal: skip this language
            }
          }
          if (autoAdded > 0) {
            toast.success(`Auto-generated ${autoAdded} starter word${autoAdded !== 1 ? "s" : ""}!`);
            // Reload queue now that new words exist
            const refreshedWords = await trainingApi.queue({
              user_id: currentUserId,
              limit: 20,
              category: selectedCategory || undefined,
            });
            setQueue(refreshedWords);
            setIndex(0);
            setCorrect(0);
            setWrong(0);
            setDone(false);
            if (refreshedWords.length > 0) setExerciseType(pickExerciseType(refreshedWords[0], allowed));
          }
        } finally {
          setSuggesting(false);
          setSuggestStatus("");
        }
        return; // already called setLoading(false) above
      }
    } catch (err) {
      console.error("Failed to load training queue", err);
      toast.error("Could not load training queue");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function practiceAll() {
    setLoading(true);
    try {
      const words = await trainingApi.queue({
        user_id: currentUserId,
        limit: 20,
        include_all: true,
        category: selectedCategory || undefined,
      });
      setQueue(words);
      setIndex(0);
      setCorrect(0);
      setWrong(0);
      setDone(false);
      const allowed = (user?.preferred_exercises ?? []) as ExerciseType[];
      if (words.length > 0) setExerciseType(pickExerciseType(words[0], allowed));
    } catch {
      toast.error("Could not load words");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Smart vocabulary generation:
   * – Covers ALL target languages, not just the first one.
   * – Phase 1 (bootstrapping): generates words for any language with < MIN_WORDS_PER_LANG.
   * – Phase 2 (normal): focuses on the language with the weakest average memory strength.
   * – Uses the CEFR proficiency level stored in Settings for each language.
   */
  async function suggestWords() {
    if (!user) return;
    const sourceLang = user.native_language ?? "de";
    const targetLangs = user.target_languages ?? [];
    if (targetLangs.length === 0) {
      toast.error("No target languages configured. Please visit Settings first.");
      return;
    }

    setSuggesting(true);
    setSuggestStatus("Analysing your vocabulary…");
    try {
      // Fetch up-to-date progress to know word counts and strengths per language
      const progressStats = await usersApi.progress(currentUserId);
      const ranked = rankLanguages(targetLangs, progressStats.languages ?? []);

      // Determine how many languages to address this session.
      // Always do all languages that still need bootstrapping;
      // if all are bootstrapped, focus on the single weakest language.
      const needsBootstrap = ranked.filter((l) => l.wordCount < MIN_WORDS_PER_LANG);
      const langsToProcess = needsBootstrap.length > 0 ? needsBootstrap : ranked.slice(0, 1);

      const wordsPerLang = Math.max(6, Math.ceil(12 / langsToProcess.length));
      let totalAdded = 0;

      for (const { targetLang, wordCount, avgStrength } of langsToProcess) {
        const proficiencyLevel =
          (user.language_proficiencies ?? {})[targetLang] ?? "A2";

        const phase =
          wordCount < MIN_WORDS_PER_LANG
            ? `bootstrapping (${wordCount} words so far)`
            : `strengthening (avg. strength ${Math.round(avgStrength)}%)`;

        setSuggestStatus(
          `Generating ${wordsPerLang} words for ${targetLang.toUpperCase()} — ${phase}…`
        );

        try {
          const result = await aiApi.suggestWords({
            user_id: currentUserId,
            source_language: sourceLang,
            target_language: targetLang,
            count: wordsPerLang,
            proficiency_level: proficiencyLevel,
          });
          totalAdded += result.added;
        } catch (langErr: any) {
          const detail = langErr?.response?.data?.detail ?? "";
          if (detail) throw langErr; // surface API/key errors immediately
          console.warn(`Suggestion failed for ${targetLang}:`, langErr);
        }
      }

      if (totalAdded > 0) {
        toast.success(`${totalAdded} new word${totalAdded !== 1 ? "s" : ""} added!`);
      } else {
        toast.success("All common words already in your vocabulary – great job!");
      }
      loadQueue();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        "AI service unavailable. Check your MISTRAL_API_KEY.";
      toast.error(msg);
    } finally {
      setSuggesting(false);
      setSuggestStatus("");
    }
  }

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const currentWord = queue[index];

  async function handleRating(quality: number) {
    if (!currentWord) return;
    try {
      const result = await trainingApi.review({
        user_id: currentUserId,
        word_id: currentWord.id,
        quality,
        mode: exerciseType,
      });
      if (result.new_level !== null) toast.success("🎉 Level Up!");
      if (quality >= 3) setCorrect((c) => c + 1);
      else setWrong((w) => w + 1);
      advance();
    } catch (err) {
      console.error("Review submission failed", err);
      toast.error("Rating could not be saved");
      advance();
    }
  }

  function handleExerciseResult(isCorrect: boolean) {
    handleRating(isCorrect ? 4 : 1);
  }

  async function handleToggleFavorite(id: number) {
    try {
      const updated = await vocabularyApi.toggleFavorite(id);
      setQueue((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch {
      toast.error("Could not update favorite");
    }
  }

  function advance() {
    const next = index + 1;
    if (next >= queue.length) {
      setDone(true);
    } else {
      setIndex(next);
      const allowed = (user?.preferred_exercises ?? []) as ExerciseType[];
      setExerciseType(pickExerciseType(queue[next], allowed));
    }
  }

  // Category pill strip component
  const CategoryStrip = () => (
    <div className="w-full max-w-lg mx-auto mb-4">
      <p className="text-xs text-slate-500 mb-2">Train by category:</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedCategory === ""
              ? "bg-indigo-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key === selectedCategory ? "" : cat.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedCategory === cat.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            <span>{WORD_CATEGORY_ICONS[cat.key] ?? "📦"}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 animate-pulse">Loading training…</div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">
          {hasAnyWords ? "All caught up!" : "No vocabulary yet"}
        </h2>
        <p className="text-slate-400 text-center max-w-sm">
          {hasAnyWords
            ? "All your words are scheduled for a future review. Practice them anyway or let the AI suggest new ones."
            : "You have no vocabulary words yet. Let the AI suggest words to get started!"}
        </p>
        <CategoryStrip />
        <div className="flex flex-col sm:flex-row gap-3">
          {hasAnyWords && (
            <button
              onClick={practiceAll}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Practice anyway
            </button>
          )}
          <button
            onClick={suggestWords}
            disabled={suggesting}
            className="flex flex-col items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${suggesting ? "animate-spin" : ""}`} />
              {suggesting ? "Generating…" : "AI: Suggest new words (all languages)"}
            </span>
            {suggesting && suggestStatus && (
              <span className="text-xs text-indigo-200 font-normal">{suggestStatus}</span>
            )}
          </button>
          <a
            href="/vocabulary"
            className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Manage Vocabulary
          </a>
        </div>
      </div>
    );
  }

  if (done) {
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">Session complete!</h2>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-3xl font-bold text-emerald-400">{correct}</p>
              <p className="text-xs text-slate-400">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-400">{wrong}</p>
              <p className="text-xs text-slate-400">Wrong</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{accuracy}%</p>
              <p className="text-xs text-slate-400">Accuracy</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadQueue}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Train again
          </button>
          <a
            href="/"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    );
  }

  const progress = ((index) / queue.length) * 100;
  const exerciseLabel: Record<ExerciseType, string> = {
    flashcard: "Flashcard",
    multiple_choice: "Multiple Choice",
    write: "Write mode",
    fill: "Fill in",
  };

  return (
    <div className="flex flex-col min-h-screen p-6">
      {/* Category strip */}
      <CategoryStrip />

      {/* Header */}
      <div className="max-w-lg mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-400">
            {index + 1} / {queue.length}
          </span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            {exerciseLabel[exerciseType]}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> {correct}
            </span>
            <span className="text-red-400 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> {wrong}
            </span>
          </div>
        </div>
        <ProgressBar value={progress} color="bg-indigo-500" />
      </div>

      {/* Exercise */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${index}-${currentWord.id}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-lg"
          >
            {exerciseType === "flashcard" && (
              <Flashcard word={currentWord} onRate={handleRating} onToggleFavorite={handleToggleFavorite} />
            )}
            {exerciseType === "multiple_choice" && (
              <MultipleChoice word={currentWord} onResult={handleExerciseResult} />
            )}
            {exerciseType === "write" && (
              <WriteExercise word={currentWord} onResult={handleExerciseResult} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

