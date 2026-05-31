"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trainingApi, vocabularyApi, usersApi, aiApi } from "@/lib/api";
import type { VocabularyWord, ExerciseType, User, WordCategory } from "@/types";
import { WORD_CATEGORY_ICONS, LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import { useAppStore } from "@/store/appStore";
import Flashcard from "@/components/exercises/Flashcard";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WriteExercise from "@/components/exercises/WriteExercise";
import ProgressBar from "@/components/ProgressBar";
import { CheckCircle, XCircle, Trophy, Sparkles, RefreshCcw, Lock, Globe } from "lucide-react";
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
  const { currentUserId, sessionLanguage, setSessionLanguage } = useAppStore();
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
      // Always load user so language picker has target_languages available
      const userData = await usersApi.get(currentUserId);
      setUser(userData);

      // If no session language is chosen, show the picker instead of the queue
      if (!sessionLanguage) {
        setLoading(false);
        return;
      }

      const [words, progressStats] = await Promise.all([
        trainingApi.queue({
          user_id: currentUserId,
          target_lang: sessionLanguage,
          limit: 20,
          category: selectedCategory || undefined,
        }),
        usersApi.progress(currentUserId),
      ]);

      // Auto-bootstrap: only for the current session language
      const langStats = progressStats.languages ?? [];
      const sessionStat = langStats.find((s) => s.target_language === sessionLanguage);
      const sessionWordCount = sessionStat?.total_words ?? 0;
      const needsBootstrap = sessionWordCount < MIN_WORDS_PER_LANG;

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
        const all = await trainingApi.queue({
          user_id: currentUserId,
          target_lang: sessionLanguage,
          limit: 1,
          include_all: true,
        });
        setHasAnyWords(all.length > 0);
      }
      setLoading(false);

      if (needsBootstrap && !suggesting) {
        setSuggesting(true);
        setSuggestStatus(
          `Auto-generating vocabulary for ${sessionLanguage.toUpperCase()}…`
        );
        try {
          const proficiencyLevel =
            (userData.language_proficiencies ?? {})[sessionLanguage] ?? "A2";
          const res = await aiApi.suggestWords({
            user_id: currentUserId,
            source_language: userData.native_language ?? "de",
            target_language: sessionLanguage,
            count: MIN_WORDS_PER_LANG,
            proficiency_level: proficiencyLevel,
          });
          if (res.added > 0) {
            toast.success(`Auto-generated ${res.added} starter word${res.added !== 1 ? "s" : ""}!`);
            // Reload queue now that new words exist
            const refreshedWords = await trainingApi.queue({
              user_id: currentUserId,
              target_lang: sessionLanguage,
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
        } catch {
          // non-fatal
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
  }, [currentUserId, selectedCategory, sessionLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function practiceAll() {
    setLoading(true);
    try {
      const words = await trainingApi.queue({
        user_id: currentUserId,
        target_lang: sessionLanguage || undefined,
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
   * Smart vocabulary generation — scoped to the active session language.
   * Focuses on the single language chosen for this session, respecting CEFR level.
   */
  async function suggestWords() {
    if (!user) return;
    const sourceLang = user.native_language ?? "de";

    if (!sessionLanguage) {
      toast.error("Please choose a session language first.");
      return;
    }

    setSuggesting(true);
    setSuggestStatus("Analysing your vocabulary…");
    try {
      const progressStats = await usersApi.progress(currentUserId);
      const langStats = progressStats.languages ?? [];
      const stat = langStats.find((s) => s.target_language === sessionLanguage);
      const wordCount = stat?.total_words ?? 0;
      const avgStrength = stat?.avg_memory_strength ?? 0;
      const proficiencyLevel = (user.language_proficiencies ?? {})[sessionLanguage] ?? "A2";
      const phase =
        wordCount < MIN_WORDS_PER_LANG
          ? `bootstrapping (${wordCount} words so far)`
          : `strengthening (avg. strength ${Math.round(avgStrength)}%)`;

      setSuggestStatus(`Generating words for ${sessionLanguage.toUpperCase()} — ${phase}…`);

      const result = await aiApi.suggestWords({
        user_id: currentUserId,
        source_language: sourceLang,
        target_language: sessionLanguage,
        count: 12,
        proficiency_level: proficiencyLevel,
      });

      if (result.added > 0) {
        toast.success(`${result.added} new word${result.added !== 1 ? "s" : ""} added!`);
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

  // ── Language picker (One Language at a Time) ──────────────────────────────
  if (!sessionLanguage) {
    const targetLangs = user?.target_languages ?? [];
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Globe className="h-12 w-12 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">One Language at a Time</h2>
          <p className="text-slate-400 max-w-sm text-sm">
            Focus your daily session on one language to avoid interference.
            Switch languages only between separate sessions.
          </p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Choose today's language</p>
          <div className="flex flex-col gap-3">
            {targetLangs.length === 0 ? (
              <p className="text-slate-500 text-sm text-center">
                No target languages set.{" "}
                <a href="/settings" className="text-indigo-400 hover:underline">Configure in Settings</a>
              </p>
            ) : (
              targetLangs.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSessionLanguage(lang)}
                  className="flex items-center gap-3 bg-slate-700 hover:bg-indigo-600 border border-slate-600 hover:border-indigo-500 text-white font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  <span className="text-2xl">{LANGUAGE_FLAGS[lang] ?? "🌐"}</span>
                  <span>{LANGUAGES[lang] ?? lang}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Session language banner ───────────────────────────────────────────────
  const SessionBanner = () => (
    <div className="w-full max-w-lg mx-auto mb-3 flex items-center justify-between bg-indigo-950 border border-indigo-800 rounded-xl px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-indigo-200">
        <Lock className="h-3.5 w-3.5 text-indigo-400" />
        <span className="text-lg">{LANGUAGE_FLAGS[sessionLanguage] ?? "🌐"}</span>
        <span className="font-semibold">{LANGUAGES[sessionLanguage] ?? sessionLanguage} session</span>
      </div>
      <button
        onClick={() => setSessionLanguage(null)}
        className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-2 py-1 rounded-lg transition-colors"
      >
        End Session
      </button>
    </div>
  );

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">
          {hasAnyWords ? "All caught up!" : "No vocabulary yet"}
        </h2>
        <p className="text-slate-400 text-center max-w-sm">
          {hasAnyWords
            ? `All ${LANGUAGE_FLAGS[sessionLanguage] ?? ""} ${LANGUAGES[sessionLanguage] ?? sessionLanguage} words are scheduled for a future review. Practice them anyway or let the AI suggest new ones.`
            : `You have no ${LANGUAGE_FLAGS[sessionLanguage] ?? ""} ${LANGUAGES[sessionLanguage] ?? sessionLanguage} vocabulary yet. Let the AI suggest words to get started!`}
        </p>
        <SessionBanner />
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
              {suggesting ? "Generating…" : `AI: Suggest ${LANGUAGES[sessionLanguage] ?? sessionLanguage} words`}
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
        {sessionLanguage && (
          <p className="text-slate-400 text-sm">
            {LANGUAGE_FLAGS[sessionLanguage]} {LANGUAGES[sessionLanguage] ?? sessionLanguage} session
          </p>
        )}
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
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={loadQueue}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Train again
          </button>
          <button
            onClick={() => setSessionLanguage(null)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Globe className="h-4 w-4" />
            New Language Session
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
      {/* Session language lock banner */}
      <SessionBanner />

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

