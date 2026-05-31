"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Volume2, Star, ImageOff, RefreshCw } from "lucide-react";
import type { VocabularyWord } from "@/types";
import { cn, memoryColor, memoryLabel } from "@/lib/utils";
import { LANGUAGE_FLAGS, WORD_CATEGORY_ICONS } from "@/types";
import { speak } from "@/lib/tts";
import { aiApi, vocabularyApi } from "@/lib/api";
import toast from "react-hot-toast";

interface FlashcardProps {
  word: VocabularyWord;
  onRate: (quality: number) => void;
  onToggleFavorite?: (id: number) => void;
}

const QUALITY_BUTTONS = [
  { q: 1, label: "Wrong", color: "bg-red-600 hover:bg-red-500" },
  { q: 2, label: "Hard", color: "bg-orange-600 hover:bg-orange-500" },
  { q: 3, label: "Okay", color: "bg-yellow-600 hover:bg-yellow-500" },
  { q: 4, label: "Good", color: "bg-blue-600 hover:bg-blue-500" },
  { q: 5, label: "Perfect", color: "bg-emerald-600 hover:bg-emerald-500" },
];

export default function Flashcard({ word, onRate, onToggleFavorite }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(word.image_url ?? null);
  const [regenLoading, setRegenLoading] = useState(false);

  async function handleRegenImage(e: React.MouseEvent) {
    e.stopPropagation();
    setRegenLoading(true);
    try {
      const result = await aiApi.generateImage(word.word, word.source_language);
      if (!result?.url) throw new Error("No URL returned");
      setImageUrl(result.url);
      setImgError(false);
      await vocabularyApi.update(word.id, { image_url: result.url });
      toast.success("Image updated!");
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail ?? "";
      toast.error(detail || "Could not generate image. Try again in a moment.");
    } finally {
      setRegenLoading(false);
    }
  }

  function triggerSpeak(text: string, lang: string, key: string) {
    setSpeakingKey(key);
    speak(text, lang, { onEnd: () => setSpeakingKey(null) });
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {/* Card */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: 1000 }}
        onClick={() => setFlipped((f) => !f)}
      >
        {/* Favorite star button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(word.id);
            }}
            className={cn(
              "absolute top-3 right-3 z-10 transition-colors",
              word.is_favorite
                ? "text-yellow-400 hover:text-yellow-300"
                : "text-slate-600 hover:text-slate-400"
            )}
            title={word.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={cn("h-5 w-5", word.is_favorite && "fill-yellow-400")} />
          </button>
        )}
        <motion.div
          className="relative w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
        >
          {/* Front */}
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden min-h-48 flex flex-col items-center justify-center gap-4"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Word image */}
            {imageUrl && !imgError && (
              <div className="w-full h-40 relative overflow-hidden group">
                <img
                  src={imageUrl}
                  alt={word.word}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
                {word.category && (
                  <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                    {WORD_CATEGORY_ICONS[word.category] ?? "📦"} {word.category}
                  </span>
                )}
                <button
                  onClick={handleRegenImage}
                  disabled={regenLoading}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                  title="Regenerate image"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", regenLoading && "animate-spin")} />
                </button>
              </div>
            )}
            {(!imageUrl || imgError) && (
              <div className="flex flex-col items-center gap-1 pt-4">
                <ImageOff className="h-8 w-8 text-slate-600" />
                <button
                  onClick={handleRegenImage}
                  disabled={regenLoading}
                  className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", regenLoading && "animate-spin")} />
                  {regenLoading ? "Generating…" : "Generate image"}
                </button>
              </div>
            )}
            <div className="px-8 pb-6 flex flex-col items-center gap-4">
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
                    triggerSpeak(word.word, word.source_language, "word");
                  }}
                  className={cn(
                    "transition-colors",
                    speakingKey === "word"
                      ? "text-indigo-400 animate-pulse"
                      : "text-slate-400 hover:text-white"
                  )}
                  title="Pronunciation"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
                <span className="text-slate-500 text-xs">Tap to flip</span>
              </div>
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-indigo-900 border border-indigo-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="flex items-center gap-3">
              <p className="text-3xl font-bold text-white">{word.translation}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerSpeak(word.translation, word.target_language, "translation");
                }}
                className={cn(
                  "transition-colors",
                  speakingKey === "translation"
                    ? "text-indigo-400 animate-pulse"
                    : "text-indigo-300 hover:text-white"
                )}
                title="Pronunciation"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            </div>
            {word.example_translation && (
              <div className="flex items-center gap-2 mt-2">
                <p className="text-slate-300 text-sm italic text-center">
                  „{word.example_translation}"
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerSpeak(word.example_translation!, word.target_language, "example");
                  }}
                  className={cn(
                    "transition-colors shrink-0",
                    speakingKey === "example"
                      ? "text-indigo-400 animate-pulse"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                  title="Speak example sentence"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {word.example_sentence && (
              <p className="text-slate-500 text-xs text-center italic">
                {word.example_sentence}
              </p>
            )}
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
