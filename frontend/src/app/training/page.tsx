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
  const [hasAnyWords, setHasAnyWords] = useState(false);

  // Load category definitions once
  useEffect(() => {
    vocabularyApi.categories().then(setCategories).catch(() => {});
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [words, userData] = await Promise.all([
        trainingApi.queue({
          user_id: currentUserId,
          limit: 20,
          category: selectedCategory || undefined,
        }),
        usersApi.get(currentUserId),
      ]);
      setUser(userData);
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
    } catch (err) {
      console.error("Failed to load training queue", err);
      toast.error("Could not load training queue");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, selectedCategory]);

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

  async function suggestWords() {
    const sourceLang = user?.native_language ?? "de";
    const targetLang = user?.target_languages?.[0] ?? "en";
    setSuggesting(true);
    try {
      const result = await aiApi.suggestWords({
        user_id: currentUserId,
        source_language: sourceLang,
        target_language: targetLang,
        count: 8,
      });
      toast.success(`${result.added} new words added to your vocabulary!`);
      loadQueue();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "AI service unavailable. Check your MISTRAL_API_KEY.";
      toast.error(msg);
    } finally {
      setSuggesting(false);
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
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Sparkles className={`h-4 w-4 ${suggesting ? "animate-spin" : ""}`} />
            {suggesting ? "Generating…" : "AI: Suggest new words"}
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

