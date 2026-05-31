"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { vocabularyApi } from "@/lib/api";
import { LANGUAGES, WORD_CATEGORY_ICONS } from "@/types";
import type { VocabularyWord, WordCategory } from "@/types";
import toast from "react-hot-toast";

interface AddWordModalProps {
  userId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  editWord?: VocabularyWord | null;
}

const EMPTY_FORM = {
  source_language: "de",
  target_language: "en",
  word: "",
  translation: "",
  part_of_speech: "",
  category: "",
  example_sentence: "",
  example_translation: "",
  tags: "",
  notes: "",
};

export default function AddWordModal({ userId, open, onClose, onAdded, editWord }: AddWordModalProps) {
  const isEdit = !!editWord;
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<WordCategory[]>([]);

  useEffect(() => {
    vocabularyApi.categories().then(setCategories).catch(() => {});
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (editWord) {
      setForm({
        source_language: editWord.source_language,
        target_language: editWord.target_language,
        word: editWord.word,
        translation: editWord.translation,
        part_of_speech: editWord.part_of_speech ?? "",
        category: editWord.category ?? "",
        example_sentence: editWord.example_sentence ?? "",
        example_translation: editWord.example_translation ?? "",
        tags: editWord.tags.join(", "),
        notes: editWord.notes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editWord, open]);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.word.trim() || !form.translation.trim()) return;
    setLoading(true);
    try {
      if (isEdit && editWord) {
        await vocabularyApi.update(editWord.id, {
          translation: form.translation.trim(),
          part_of_speech: form.part_of_speech.trim() || undefined,
          category: form.category || undefined,
          example_sentence: form.example_sentence.trim() || undefined,
          example_translation: form.example_translation.trim() || undefined,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          notes: form.notes.trim() || undefined,
        });
        toast.success("Word updated!");
      } else {
        await vocabularyApi.create({
          user_id: userId,
          source_language: form.source_language,
          target_language: form.target_language,
          word: form.word.trim(),
          translation: form.translation.trim(),
          part_of_speech: form.part_of_speech.trim() || undefined,
          category: form.category || undefined,
          example_sentence: form.example_sentence.trim() || undefined,
          example_translation: form.example_translation.trim() || undefined,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          notes: form.notes.trim() || undefined,
        });
        toast.success("Word added! AI is generating image & category…");
      }
      onAdded();
      onClose();
    } catch {
      toast.error("Error saving");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{isEdit ? "Edit Word" : "Add Word"}</h2>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Language pair — read-only when editing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Source language</label>
                  <select
                    value={form.source_language}
                    onChange={(e) => update("source_language", e.target.value)}
                    disabled={isEdit}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Target language</label>
                  <select
                    value={form.target_language}
                    onChange={(e) => update("target_language", e.target.value)}
                    disabled={isEdit}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Word — read-only when editing */}
              <Field
                label="Word"
                value={form.word}
                placeholder="e.g. Haus"
                onChange={(v) => update("word", v)}
                disabled={isEdit}
              />
              <Field
                label="Translation"
                value={form.translation}
                placeholder="e.g. house"
                onChange={(v) => update("translation", v)}
              />
              <Field
                label="Part of speech (optional)"
                value={form.part_of_speech}
                placeholder="e.g. noun, verb"
                onChange={(v) => update("part_of_speech", v)}
              />

              {/* Category dropdown */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Category (optional — AI will auto-assign if left blank)
                </label>
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">— auto-assign —</option>
                  {categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {WORD_CATEGORY_ICONS[cat.key] ?? "📦"} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Example sentence (optional)"
                value={form.example_sentence}
                placeholder="e.g. Das Haus ist groß."
                onChange={(v) => update("example_sentence", v)}
              />
              <Field
                label="Example translation (optional)"
                value={form.example_translation}
                placeholder="e.g. The house is big."
                onChange={(v) => update("example_translation", v)}
              />
              <Field
                label="Notes (optional)"
                value={form.notes}
                placeholder="e.g. used in formal contexts"
                onChange={(v) => update("notes", v)}
              />
              <Field
                label="Tags (comma-separated, optional)"
                value={form.tags}
                placeholder="e.g. everyday, home"
                onChange={(v) => update("tags", v)}
              />

              <button
                type="submit"
                disabled={loading || !form.word.trim() || !form.translation.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Save changes" : "Add word"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
      />
    </div>
  );
}

