"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/types";
import { cn, memoryColor, memoryLabel } from "@/lib/utils";
import { LANGUAGE_FLAGS } from "@/types";

interface FlashcardProps {
  word: VocabularyWord;
  onRate: (quality: number) => void;
}

const QUALITY_BUTTONS = [
  { q: 1, label: "Wrong", color: "bg-red-600 hover:bg-red-500" },
  { q: 2, label: "Hard", color: "bg-orange-600 hover:bg-orange-500" },
  { q: 3, label: "Okay", color: "bg-yellow-600 hover:bg-yellow-500" },
  { q: 4, label: "Good", color: "bg-blue-600 hover:bg-blue-500" },
  { q: 5, label: "Perfect", color: "bg-emerald-600 hover:bg-emerald-500" },
];

export default function Flashcard({ word, onRate }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  function speak(text: string, lang: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    window.speechSynthesis.speak(utt);
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {/* Card */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.div
          className="relative w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
        >
          {/* Front */}
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl p-8 min-h-48 flex flex-col items-center justify-center gap-4"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>{LANGUAGE_FLAGS[word.source_language]}</span>
              <span className="capitalize">{word.source_language}</span>
              <span>→</span>
              <span>{LANGUAGE_FLAGS[word.target_language]}</span>
            </div>
            <p className="text-3xl font-bold text-white">{word.word}</p>
            {word.part_of_speech && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {word.part_of_speech}
              </span>
            )}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speak(word.word, word.source_language);
                }}
                className="text-slate-400 hover:text-white transition-colors"
                title="Pronunciation"
              >
                <Volume2 className="h-5 w-5" />
              </button>
              <span className="text-slate-500 text-xs">Tap to flip</span>
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-indigo-900 border border-indigo-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-3xl font-bold text-white">{word.translation}</p>
            {word.example_sentence && (
              <p className="text-slate-300 text-sm italic text-center mt-2">
                „{word.example_sentence}"
              </p>
            )}
            {word.example_translation && (
              <p className="text-slate-400 text-xs text-center">
                {word.example_translation}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(word.translation, word.target_language);
              }}
              className="text-indigo-300 hover:text-white transition-colors mt-2"
              title="Pronunciation"
            >
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Memory indicator */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <div className={cn("h-2 w-2 rounded-full", memoryColor(word.memory_strength))} />
        <span>{memoryLabel(word.memory_strength)}</span>
        <span className="text-slate-600">·</span>
        <span>{word.memory_strength}%</span>
      </div>

      {/* Rating buttons (shown after flip) */}
      {flipped && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-center gap-2 w-full"
        >
          {QUALITY_BUTTONS.map(({ q, label, color }) => (
            <button
              key={q}
              onClick={() => onRate(q)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95",
                color
              )}
            >
              {label}
            </button>
          ))}
        </motion.div>
      )}

      {/* Reset button */}
      {flipped && (
        <button
          onClick={() => setFlipped(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          View again
        </button>
      )}
    </div>
  );
}
