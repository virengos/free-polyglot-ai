"use client";

import { cn, memoryColor, memoryLabel } from "@/lib/utils";
import { LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import type { VocabularyWord } from "@/types";
import { Pencil, Trash2, Volume2, Star } from "lucide-react";
import { speak } from "@/lib/tts";

interface VocabCardProps {
  word: VocabularyWord;
  onEdit?: (word: VocabularyWord) => void;
  onDelete?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
}

export default function VocabCard({ word, onEdit, onDelete, onToggleFavorite }: VocabCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white truncate">{word.word}</span>
            {word.part_of_speech && (
              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                {word.part_of_speech}
              </span>
            )}
            <button
              type="button"
              onClick={() => speak(word.word, word.source_language)}
              className="text-slate-500 hover:text-white transition-colors"
              title="Speak word"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-slate-300 text-sm">{word.translation}</p>
            <button
              type="button"
              onClick={() => speak(word.translation, word.target_language)}
              className="text-slate-600 hover:text-slate-300 transition-colors"
              title="Speak translation"
            >
              <Volume2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(word.id)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                word.is_favorite
                  ? "text-yellow-400 hover:text-yellow-300 hover:bg-slate-700"
                  : "text-slate-500 hover:text-yellow-400 hover:bg-slate-700"
              )}
              title={word.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("h-3.5 w-3.5", word.is_favorite && "fill-yellow-400")} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(word)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(word.id)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Example */}
      {word.example_sentence && (
        <p className="text-slate-500 text-xs italic truncate">„{word.example_sentence}"</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>{LANGUAGE_FLAGS[word.source_language] ?? word.source_language}</span>
          <span>→</span>
          <span>{LANGUAGE_FLAGS[word.target_language] ?? word.target_language}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", memoryColor(word.memory_strength))} />
          <span className="text-xs text-slate-400">{memoryLabel(word.memory_strength)}</span>
        </div>
      </div>
    </div>
  );
}
