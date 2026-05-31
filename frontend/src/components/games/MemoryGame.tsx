"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { vocabularyApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import type { VocabularyWord } from "@/types";
import { Trophy, RefreshCcw, Loader2 } from "lucide-react";

interface MemoryCard {
  id: string;
  pairId: number;
  content: string;
  type: "word" | "translation";
  imageUrl: string | null;
  isFlipped: boolean;
  isMatched: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCards(words: VocabularyWord[]): MemoryCard[] {
  const pairs: MemoryCard[] = words.flatMap((w) => [
    {
      id: `word-${w.id}`,
      pairId: w.id,
      content: w.word,
      type: "word" as const,
      imageUrl: w.image_url ?? null,
      isFlipped: false,
      isMatched: false,
    },
    {
      id: `trans-${w.id}`,
      pairId: w.id,
      content: w.translation,
      type: "translation" as const,
      imageUrl: null,
      isFlipped: false,
      isMatched: false,
    },
  ]);
  return shuffle(pairs);
}

export default function MemoryGame() {
  const { currentUserId } = useAppStore();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [won, setWon] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [pairCount, setPairCount] = useState(8);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const totalPairs = cards.length / 2;

  const handleImgError = useCallback((cardId: string) => {
    setImgErrors((prev) => new Set(prev).add(cardId));
  }, []);

  const loadWords = useCallback(
    async (count: number) => {
      setLoading(true);
      setWon(false);
      setMoves(0);
      setMatched(0);
      setFlipped([]);
      setImgErrors(new Set());
      try {
        const words = await vocabularyApi.list({ user_id: currentUserId });
        const picked = shuffle(words).slice(0, count);
        setCards(buildCards(picked));
      } catch {
        setCards([]);
      } finally {
        setLoading(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    loadWords(pairCount);
  }, [loadWords, pairCount]);

  const handleCardClick = (cardId: string) => {
    if (blocking) return;

    setCards((prev) => {
      const card = prev.find((c) => c.id === cardId);
      if (!card || card.isFlipped || card.isMatched) return prev;
      return prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c));
    });

    setFlipped((prev) => {
      if (prev.length === 1 && prev[0] !== cardId) {
        // Second card flipped — check for match
        const newFlipped = [...prev, cardId];
        setMoves((m) => m + 1);

        setCards((prevCards) => {
          const [firstId, secondId] = newFlipped;
          const first = prevCards.find((c) => c.id === firstId)!;
          const second = prevCards.find((c) => c.id === secondId)!;

          if (first.pairId === second.pairId && first.type !== second.type) {
            // Match!
            const updated = prevCards.map((c) =>
              c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c
            );
            const newMatched = updated.filter((c) => c.isMatched).length / 2;
            setMatched(newMatched);
            if (newMatched === updated.length / 2) setWon(true);
            return updated;
          } else {
            // No match — flip back after delay
            setBlocking(true);
            setTimeout(() => {
              setCards((c) =>
                c.map((card) =>
                  card.id === firstId || card.id === secondId
                    ? { ...card, isFlipped: false }
                    : card
                )
              );
              setBlocking(false);
            }, 900);
            return prevCards.map((c) =>
              c.id === secondId ? { ...c, isFlipped: true } : c
            );
          }
        });

        return [];
      }

      if (prev.length === 0) return [cardId];
      return prev;
    });
  };

  const accuracy =
    moves > 0 ? Math.round((matched / moves) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Pairs:</span>
          {[4, 6, 8, 10, 12].map((n) => (
            <button
              key={n}
              onClick={() => {
                setPairCount(n);
              }}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                pairCount === n
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => loadWords(pairCount)}
          className="ml-auto flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <RefreshCcw className="h-4 w-4" />
          New Game
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 text-sm text-slate-400">
        <span>
          Moves: <span className="text-white font-semibold">{moves}</span>
        </span>
        <span>
          Matched:{" "}
          <span className="text-emerald-400 font-semibold">
            {matched}/{totalPairs}
          </span>
        </span>
        <span>
          Accuracy: <span className="text-white font-semibold">{accuracy}%</span>
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      )}

      {/* No words */}
      {!loading && cards.length === 0 && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
          <p>No vocabulary words found.</p>
          <p className="text-sm">Add some words first via the Vocabulary page.</p>
        </div>
      )}

      {/* Win screen */}
      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex flex-col items-center gap-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-10 text-center"
          >
            <Trophy className="h-14 w-14 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">You won!</h2>
            <p className="text-slate-300">
              Completed in <span className="font-bold text-white">{moves}</span> moves
              with <span className="font-bold text-yellow-400">{accuracy}%</span> accuracy.
            </p>
            <button
              onClick={() => loadWords(pairCount)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Grid */}
      {!loading && cards.length > 0 && !won && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${Math.min(totalPairs, 4)}, minmax(0, 1fr))`,
          }}
        >
          {cards.map((card) => (
            <motion.div
              key={card.id}
              className="relative h-36 cursor-pointer select-none"
              style={{ perspective: 800 }}
              onClick={() => handleCardClick(card.id)}
            >
              <motion.div
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: card.isFlipped || card.isMatched ? 180 : 0 }}
                transition={{ duration: 0.35 }}
              >
                {/* Back */}
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <span className="text-2xl">🌍</span>
                </div>

                {/* Front */}
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border ${
                    card.isMatched
                      ? "border-emerald-500/50 bg-emerald-900/40"
                      : card.type === "word"
                      ? "border-indigo-500/50 bg-indigo-900/40"
                      : "border-violet-500/50 bg-violet-900/40"
                  }`}
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  {card.imageUrl && !imgErrors.has(card.id) ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={card.imageUrl}
                        alt={card.content}
                        className="h-20 w-full object-cover"
                        onError={() => handleImgError(card.id)}
                        loading="lazy"
                      />
                      <span
                        className={`px-2 py-1 text-xs font-semibold leading-tight text-center truncate w-full ${
                          card.isMatched ? "text-emerald-300" : "text-indigo-200"
                        }`}
                      >
                        {card.content}
                      </span>
                    </>
                  ) : (
                    <span
                      className={`px-2 text-center text-sm font-medium leading-tight ${
                        card.isMatched
                          ? "text-emerald-300"
                          : card.type === "word"
                          ? "text-indigo-200"
                          : "text-violet-200"
                      }`}
                    >
                      {card.content}
                    </span>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
