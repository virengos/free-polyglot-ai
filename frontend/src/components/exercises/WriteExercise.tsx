"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/types";
import { cn } from "@/lib/utils";
import { LANGUAGE_FLAGS } from "@/types";
import { speak } from "@/lib/tts";
import SpecialCharsBar, { insertAtCursor } from "@/components/SpecialCharsBar";

interface WriteExerciseProps {
  word: VocabularyWord;
  onResult: (correct: boolean) => void;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function WriteExercise({ word, onResult }: WriteExerciseProps) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput("");
    setSubmitted(false);
    inputRef.current?.focus();
  }, [word.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || submitted) return;
    const isCorrect = normalize(input) === normalize(word.translation);
    setCorrect(isCorrect);
    setSubmitted(true);
    setTimeout(() => onResult(isCorrect), 1500);
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto">
      {/* Prompt */}
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-2">
          {LANGUAGE_FLAGS[word.source_language]} Write the translation in{" "}
          {LANGUAGE_FLAGS[word.target_language]}
        </p>
        <div className="flex items-center justify-center gap-3">
          <p className="text-4xl font-bold text-white">{word.word}</p>
          <button
            type="button"
            onClick={() =>
              speak(word.word, word.source_language, {
                onStart: () => setIsSpeaking(true),
                onEnd: () => setIsSpeaking(false),
              })
            }
            className={cn(
              "transition-colors",
              isSpeaking
                ? "text-indigo-400 animate-pulse"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>
        {word.example_sentence && (
          <p className="text-slate-500 text-sm mt-3 italic">
            Context: „{word.example_sentence}"
          </p>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={submitted}
          placeholder="Your translation…"
          className={cn(
            "w-full px-5 py-4 rounded-xl border bg-slate-800 text-white placeholder:text-slate-500 outline-none transition-colors text-lg",
            !submitted && "border-slate-700 focus:border-indigo-500",
            submitted && correct && "border-emerald-500 bg-emerald-900/20",
            submitted && !correct && "border-red-500 bg-red-900/20"
          )}
        />

        {/* Special character bar — shown only when not yet submitted */}
        {!submitted && (
          <SpecialCharsBar
            language={word.target_language}
            onInsert={(char) => insertAtCursor(inputRef, char, input, setInput)}
          />
        )}

        {!submitted && (
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40"
            disabled={!input.trim()}
          >
            Check
          </button>
        )}
      </form>

      {/* Feedback */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-2"
          >
            {correct ? (
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle className="h-5 w-5" />
                Correct!
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <XCircle className="h-5 w-5" />
                  Wrong
                </div>
                <p className="text-slate-300 text-sm">
                  Correct answer:{" "}
                  <span className="font-bold text-white">{word.translation}</span>
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


