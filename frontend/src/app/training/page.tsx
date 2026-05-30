"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trainingApi } from "@/lib/api";
import type { VocabularyWord, ExerciseType } from "@/types";
import { useAppStore } from "@/store/appStore";
import Flashcard from "@/components/exercises/Flashcard";
import MultipleChoice from "@/components/exercises/MultipleChoice";
import WriteExercise from "@/components/exercises/WriteExercise";
import ProgressBar from "@/components/ProgressBar";
import { CheckCircle, XCircle, Trophy } from "lucide-react";
import toast from "react-hot-toast";

const EXERCISE_TYPES: ExerciseType[] = ["flashcard", "multiple_choice", "write"];

function pickExerciseType(word: VocabularyWord): ExerciseType {
  // New words → flashcard first; practiced words → vary
  if (word.repetitions === 0) return "flashcard";
  return EXERCISE_TYPES[Math.floor(Math.random() * EXERCISE_TYPES.length)];
}

export default function TrainingPage() {
  const { currentUserId } = useAppStore();
  const [queue, setQueue] = useState<VocabularyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [exerciseType, setExerciseType] = useState<ExerciseType>("flashcard");
  const [loading, setLoading] = useState(true);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [done, setDone] = useState(false);
  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const words = await trainingApi.queue({ user_id: currentUserId, limit: 20 });
      setQueue(words);
      setIndex(0);
      setCorrect(0);
      setWrong(0);
      setDone(false);
      if (words.length > 0) setExerciseType(pickExerciseType(words[0]));
    } catch (err) {
      console.error("Failed to load training queue", err);
      toast.error("Konnte Trainingswarteschlange nicht laden");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

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
      toast.error("Bewertung konnte nicht gespeichert werden");
      advance();
    }
  }

  function handleExerciseResult(isCorrect: boolean) {
    handleRating(isCorrect ? 4 : 1);
  }

  function advance() {
    const next = index + 1;
    if (next >= queue.length) {
      setDone(true);
    } else {
      setIndex(next);
      setExerciseType(pickExerciseType(queue[next]));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 animate-pulse">Lade Training…</div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">Alles wiederholt!</h2>
        <p className="text-slate-400 text-center">
          Keine fälligen Vokabeln. Füge neue hinzu oder komm später wieder.
        </p>
        <a
          href="/vocabulary"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Vokabeln verwalten
        </a>
      </div>
    );
  }

  if (done) {
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <Trophy className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold text-white">Session abgeschlossen!</h2>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-3xl font-bold text-emerald-400">{correct}</p>
              <p className="text-xs text-slate-400">Richtig</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-400">{wrong}</p>
              <p className="text-xs text-slate-400">Falsch</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{accuracy}%</p>
              <p className="text-xs text-slate-400">Genauigkeit</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadQueue}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Nochmal trainieren
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
    flashcard: "Karteikarte",
    multiple_choice: "Multiple Choice",
    write: "Schreibmodus",
    fill: "Lückentext",
  };

  return (
    <div className="flex flex-col min-h-screen p-6">
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
              <Flashcard word={currentWord} onRate={handleRating} />
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
