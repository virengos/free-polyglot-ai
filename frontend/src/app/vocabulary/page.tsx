"use client";

import { useCallback, useEffect, useState } from "react";
import { vocabularyApi } from "@/lib/api";
import type { VocabularyWord } from "@/types";
import { useAppStore } from "@/store/appStore";
import VocabCard from "@/components/VocabCard";
import AddWordModal from "@/components/AddWordModal";
import { LANGUAGES } from "@/types";
import { Plus, Search, Filter } from "lucide-react";
import toast from "react-hot-toast";

export default function VocabularyPage() {
  const { currentUserId } = useAppStore();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [showModal, setShowModal] = useState(false);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vocabularyApi.list({
        user_id: currentUserId,
        search: search || undefined,
        target_language: filterLang || undefined,
      });
      setWords(data);
    } catch {
      toast.error("Error loading vocabulary");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, search, filterLang]);

  useEffect(() => {
    const t = setTimeout(loadWords, 300);
    return () => clearTimeout(t);
  }, [loadWords]);

  async function handleDelete(id: number) {
    if (!confirm("Really delete this word?")) return;
    try {
      await vocabularyApi.delete(id);
      toast.success("Deleted");
      loadWords();
    } catch {
      toast.error("Error deleting");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vocabulary</h1>
          <p className="text-slate-400 text-sm mt-0.5">{words.length} entries</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <select
            value={filterLang}
            onChange={(e) => setFilterLang(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
          >
            <option value="">All languages</option>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Word grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-xl h-28 animate-pulse"
            />
          ))}
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-2">No vocabulary words found</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            Add your first word →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {words.map((word) => (
            <VocabCard key={word.id} word={word} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <AddWordModal
        userId={currentUserId}
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdded={loadWords}
      />
    </div>
  );
}
