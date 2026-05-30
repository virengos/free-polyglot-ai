"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import type { VocabularyWord } from "@/types";
import { cn, shuffle } from "@/lib/utils";
import { LANGUAGE_FLAGS } from "@/types";
import { vocabularyApi } from "@/lib/api";

interface MultipleChoiceProps {
  word: VocabularyWord;
  onResult: (correct: boolean) => void;
}

export default function MultipleChoice({ word, onResult }: MultipleChoiceProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelected(null);
    setLoading(true);
    vocabularyApi
      .distractors(word.id, 3)
      .then((distractors) => {
        setOptions(shuffle([word.translation, ...distractors]));
      })
      .catch(() => {
        // Fallback: show just correct answer
        setOptions([word.translation]);
      })
      .finally(() => setLoading(false));
  }, [word.id, word.translation]);

  function handleSelect(option: string) {
    if (selected) return; // already answered
    setSelected(option);
    setTimeout(() => onResult(option === word.translation), 1200);
  }

  const isCorrect = (opt: string) => selected && opt === word.translation;
  const isWrong = (opt: string) => selected === opt && opt !== word.translation;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto">
      {/* Prompt */}
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-2">
          {LANGUAGE_FLAGS[word.source_language]} What is the translation of
        </p>
        <p className="text-4xl font-bold text-white">{word.word}</p>
        {word.part_of_speech && (
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full mt-2 inline-block">
            {word.part_of_speech}
          </span>
        )}
        <p className="text-slate-500 text-xs mt-1">
          {LANGUAGE_FLAGS[word.target_language]}?
        </p>
      </div>

      {/* Options */}
      {loading ? (
        <div className="text-slate-500 text-sm">Loading options…</div>
      ) : (
        <div className="grid gap-3 w-full">
          {options.map((opt) => (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleSelect(opt)}
              className={cn(
                "w-full px-5 py-4 rounded-xl border text-left text-sm font-medium transition-all",
                !selected && "border-slate-700 bg-slate-800 hover:border-indigo-500 hover:bg-slate-700 text-white",
                isCorrect(opt) && "border-emerald-500 bg-emerald-900/40 text-emerald-300",
                isWrong(opt) && "border-red-500 bg-red-900/40 text-red-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span>{opt}</span>
                {isCorrect(opt) && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                {isWrong(opt) && <XCircle className="h-5 w-5 text-red-400" />}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "text-sm font-semibold",
              selected === word.translation ? "text-emerald-400" : "text-red-400"
            )}
          >
            {selected === word.translation
              ? "✓ Correct!"
              : `✗ Correct answer: ${word.translation}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
