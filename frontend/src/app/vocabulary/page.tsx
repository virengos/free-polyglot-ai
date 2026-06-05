"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { vocabularyApi, usersApi, aiApi } from "@/lib/api";
import type { VocabularyWord, WordCategory } from "@/types";
import { WORD_CATEGORY_ICONS, LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import { useAppStore } from "@/store/appStore";
import VocabCard from "@/components/VocabCard";
import AddWordModal from "@/components/AddWordModal";
import BulkImportModal from "@/components/BulkImportModal";
import { Plus, Search, Filter, Star, Sparkles, FolderOpen, Folder, Lock, RefreshCw, Trash2, ChevronLeft, ChevronRight, FileUp } from "lucide-react";
import toast from "react-hot-toast";

export default function VocabularyPage() {
  const { currentUserId, sessionLanguage } = useAppStore();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [categories, setCategories] = useState<WordCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editWord, setEditWord] = useState<VocabularyWord | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestingPhrases, setSuggestingPhrases] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Pagination
  const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
  type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(50);
  const [totalCount, setTotalCount] = useState(0);

  // Track whether we already kicked off background tasks for this user in this session
  const imageFillTriggered = useRef(false);
  const autoClassifyTriggered = useRef(false);
  // Always hold the latest loadWords so background timeouts don't use a stale closure
  const loadWordsRef = useRef<() => Promise<void>>(async () => {});

  // Load category definitions once
  useEffect(() => {
    vocabularyApi.categories().then(setCategories).catch(() => {});
  }, []);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => {
    setPage(1);
  }, [search, filterLang, favoritesOnly, selectedCategory, pageSize]);

  const loadWords = useCallback(async () => {
    setLoading(true);
    const filterParams = {
      user_id: currentUserId,
      search: search || undefined,
      target_language: filterLang || undefined,
      favorites_only: favoritesOnly || undefined,
      category: selectedCategory || undefined,
    };
    try {
      const [data, countResult] = await Promise.all([
        vocabularyApi.list({ ...filterParams, skip: (page - 1) * pageSize, limit: pageSize }),
        vocabularyApi.count(filterParams),
      ]);
      setWords(data);
      setTotalCount(countResult.total);
    } catch {
      toast.error("Error loading vocabulary");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, search, filterLang, favoritesOnly, selectedCategory, page, pageSize]);

  useEffect(() => {
    loadWordsRef.current = loadWords;
  }, [loadWords]);

  useEffect(() => {
    const t = setTimeout(loadWords, 300);
    return () => clearTimeout(t);
  }, [loadWords]);

  // Compute per-category word counts from the full unfiltered list for the sidebar
  const [allWords, setAllWords] = useState<VocabularyWord[]>([]);
  useEffect(() => {
    vocabularyApi
      .list({ user_id: currentUserId, limit: 5000 })
      .then((data) => {
        setAllWords(data);
        // Auto-fill images for words that still lack one (runs once per session per user)
        const missing = data.filter((w) => !w.image_url).length;
        if (missing > 0 && !imageFillTriggered.current) {
          imageFillTriggered.current = true;
          aiApi.fillMissingImages(currentUserId).then((res) => {
            if (res.queued > 0) {
              setTimeout(() => {
                vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
                loadWordsRef.current();
              }, 6000);
            }
          }).catch(() => {});
        }
        // Auto-classify words that have no category yet (runs once per session per user)
        const nullCategoryCount = data.filter((w) => !w.category).length;
        if (nullCategoryCount > 0 && !autoClassifyTriggered.current) {
          autoClassifyTriggered.current = true;
          aiApi.reclassifyOthers(currentUserId).then((res) => {
            if (res.queued > 0) {
              setTimeout(() => {
                vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
                loadWordsRef.current();
              }, 10000);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of allWords) {
      const key = w.category ?? "other";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [allWords]);

  // Categories that actually have words
  const activeCategories = useMemo(
    () => categories.filter((c) => (categoryCounts[c.key] ?? 0) > 0),
    [categories, categoryCounts]
  );

  async function handleDelete(id: number) {
    if (!confirm("Really delete this word?")) return;
    try {
      await vocabularyApi.delete(id);
      toast.success("Deleted");
      loadWords();
      setAllWords((prev) => prev.filter((w) => w.id !== id));
    } catch {
      toast.error("Error deleting");
    }
  }

  async function handleToggleFavorite(id: number) {
    try {
      const updated = await vocabularyApi.toggleFavorite(id);
      setWords((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch {
      toast.error("Could not update favorite");
    }
  }

  function handleEdit(word: VocabularyWord) {
    setEditWord(word);
    setShowModal(true);
  }

  function handleModalClose() {
    setShowModal(false);
    setEditWord(null);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  async function handleReclassifyOthers() {
    const othersCount = categoryCounts["other"] ?? 0;
    if (othersCount === 0) {
      toast("No words in the Other folder.");
      return;
    }
    setReclassifying(true);
    try {
      const res = await aiApi.reclassifyOthers(currentUserId);
      toast.success(res.message);
      // Reload after a delay so reclassified words appear in their new folders
      setTimeout(() => {
        vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
        loadWordsRef.current();
      }, 8000);
    } catch {
      toast.error("Reclassification failed. Please try again.");
    } finally {
      setReclassifying(false);
    }
  }

  async function handleDeduplicate() {
    setDeduplicating(true);
    try {
      const res = await aiApi.deduplicate(currentUserId);
      if (res.deleted === 0) {
        toast("No duplicates found.");
      } else {
        toast.success(res.message);
        vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
        loadWords();
      }
    } catch {
      toast.error("Deduplication failed. Please try again.");
    } finally {
      setDeduplicating(false);
    }
  }

  async function handleSuggestPhrases() {
    setSuggestingPhrases(true);
    try {
      const user = await usersApi.get(currentUserId);
      const sourceLang = user.native_language;
      const targetLang = sessionLanguage || filterLang || user.target_languages[0] || "en";
      const proficiencyLevel = (user.language_proficiencies ?? {})[targetLang] ?? "A2";
      const result = await aiApi.suggestPhrases({
        user_id: currentUserId,
        source_language: sourceLang,
        target_language: targetLang,
        count: 6,
        proficiency_level: proficiencyLevel,
      });
      toast.success(`${result.added} new phrase(s) added!`);
      loadWords();
      vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail ?? "";
      toast.error(detail || "AI service unavailable. Please try again in a moment.");
    } finally {
      setSuggestingPhrases(false);
    }
  }

  async function handleSuggestWords() {
    setSuggesting(true);
    try {
      const user = await usersApi.get(currentUserId);
      const sourceLang = user.native_language;
      // Respect the active session language; fall back to filter or first target language
      const targetLang = sessionLanguage || filterLang || user.target_languages[0] || "en";
      const proficiencyLevel = (user.language_proficiencies ?? {})[targetLang] ?? "A2";
      const result = await aiApi.suggestWords({
        user_id: currentUserId,
        source_language: sourceLang,
        target_language: targetLang,
        count: 8,
        proficiency_level: proficiencyLevel,
      });
      toast.success(`${result.added} new words added!`);
      loadWords();
      // The backend also fills images for any existing words that lacked one;
      // schedule a second reload so those images appear in the UI.
      imageFillTriggered.current = false; // allow the allWords effect to re-run fill if needed
      setTimeout(() => {
        vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
        loadWordsRef.current();
      }, 6000);
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail ?? "";
      const msg = detail || "AI service unavailable. Please try again in a moment.";
      toast.error(msg);
    } finally {
      setSuggesting(false);
    }
  }

  const selectedCategoryLabel =
    categories.find((c) => c.key === selectedCategory)?.label ?? "All Categories";
  const fromEntry = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const toEntry = Math.min(page * pageSize, totalCount);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vocabulary</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {totalCount > 0 ? `${fromEntry}–${toEntry} of ${totalCount}` : "0"} entries · {selectedCategoryLabel}
          </p>
        </div>
        <div className="flex gap-2">
          {(categoryCounts["other"] ?? 0) > 0 && (
            <button
              onClick={handleReclassifyOthers}
              disabled={reclassifying}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-slate-600"
              title={`Re-classify ${categoryCounts["other"]} word(s) from the Other folder into the correct categories`}
            >
              <RefreshCw className={`h-4 w-4 ${reclassifying ? "animate-spin" : ""}`} />
              {reclassifying ? "Reclassifying…" : `Sort Others (${categoryCounts["other"]})`}
            </button>
          )}
          <button
            onClick={handleDeduplicate}
            disabled={deduplicating}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-slate-600"
            title="Find and remove duplicate vocabulary entries"
          >
            <Trash2 className={`h-4 w-4 text-rose-400 ${deduplicating ? "animate-pulse" : ""}`} />
            {deduplicating ? "Checking…" : "Remove Dupes"}
          </button>
          <button
            onClick={handleSuggestPhrases}
            disabled={suggestingPhrases}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-slate-600"
            title={sessionLanguage ? `Generate ${LANGUAGES[sessionLanguage] ?? sessionLanguage} phrases (session locked)` : "Let AI suggest useful phrases & idioms"}
          >
            {sessionLanguage ? (
              <Lock className="h-4 w-4 text-purple-400" />
            ) : (
              <Sparkles className={`h-4 w-4 text-purple-400 ${suggestingPhrases ? "animate-spin" : ""}`} />
            )}
            {suggestingPhrases ? "Generating…" : "AI Phrases"}
          </button>
          <button
            onClick={handleSuggestWords}
            disabled={suggesting}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-slate-600"
            title={sessionLanguage ? `Generate ${LANGUAGES[sessionLanguage] ?? sessionLanguage} words (session locked)` : "Let AI suggest new vocabulary words"}
          >
            {sessionLanguage ? (
              <Lock className="h-4 w-4 text-indigo-400" />
            ) : (
              <Sparkles className={`h-4 w-4 ${suggesting ? "animate-spin" : ""}`} />
            )}
            {suggesting
              ? "Generating…"
              : sessionLanguage
              ? `AI Suggest ${LANGUAGE_FLAGS[sessionLanguage] ?? ""} ${LANGUAGES[sessionLanguage] ?? sessionLanguage}`
              : "AI Suggest"}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors border border-slate-600"
            title="Import multiple vocabulary pairs from text"
          >
            <FileUp className="h-4 w-4 text-emerald-400" />
            Import
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Category Sidebar */}
        <aside className="lg:w-56 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Folders</p>
          <nav className="flex flex-row flex-wrap lg:flex-col gap-1">
            {/* All */}
            <button
              onClick={() => setSelectedCategory("")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
                selectedCategory === ""
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {selectedCategory === "" ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
              <span className="flex-1 truncate">All</span>
              <span className="text-xs opacity-60">{allWords.length}</span>
            </button>

            {activeCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key === selectedCategory ? "" : cat.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left ${
                  selectedCategory === cat.key
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="text-base leading-none">{WORD_CATEGORY_ICONS[cat.key] ?? "📦"}</span>
                <span className="flex-1 truncate">{cat.label}</span>
                <span className="text-xs opacity-60">{categoryCounts[cat.key] ?? 0}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
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
            <button
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                favoritesOnly
                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
              title="Show favorites only"
            >
              <Star className={`h-4 w-4 ${favoritesOnly ? "fill-yellow-400 text-yellow-400" : ""}`} />
              Favorites
            </button>
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
                <VocabCard key={word.id} word={word} onDelete={handleDelete} onEdit={handleEdit} onToggleFavorite={handleToggleFavorite} />
              ))}
            </div>
          )}

          {/* Pagination bar */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Per page:</span>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      pageSize === size
                        ? "bg-indigo-600 text-white font-semibold"
                        : "bg-slate-800 border border-slate-700 hover:border-indigo-500 hover:text-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-500 select-none">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`min-w-[2rem] px-2 py-1 rounded-lg text-sm transition-colors ${
                          page === item
                            ? "bg-indigo-600 text-white font-semibold"
                            : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddWordModal
        userId={currentUserId}
        open={showModal}
        onClose={handleModalClose}
        onAdded={loadWords}
        editWord={editWord}
      />
      <BulkImportModal
        userId={currentUserId}
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          vocabularyApi.list({ user_id: currentUserId, limit: 5000 }).then(setAllWords).catch(() => {});
          loadWords();
        }}
      />
    </div>
  );
}
