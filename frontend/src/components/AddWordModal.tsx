"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { vocabularyApi } from "@/lib/api";
import { LANGUAGES } from "@/types";
import toast from "react-hot-toast";

interface AddWordModalProps {
  userId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddWordModal({ userId, open, onClose, onAdded }: AddWordModalProps) {
  const [form, setForm] = useState({
    source_language: "de",
    target_language: "en",
    word: "",
    translation: "",
    part_of_speech: "",
    example_sentence: "",
    tags: "",
  });
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.word.trim() || !form.translation.trim()) return;
    setLoading(true);
    try {
      await vocabularyApi.create({
        user_id: userId,
        source_language: form.source_language,
        target_language: form.target_language,
        word: form.word.trim(),
        translation: form.translation.trim(),
        part_of_speech: form.part_of_speech.trim() || undefined,
        example_sentence: form.example_sentence.trim() || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success("Word added!");
      setForm({
        source_language: "de",
        target_language: "en",
        word: "",
        translation: "",
        part_of_speech: "",
        example_sentence: "",
        tags: "",
      });
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
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Word</h2>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Language pair */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Source language</label>
                  <select
                    value={form.source_language}
                    onChange={(e) => update("source_language", e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Word + Translation */}
              <Field
                label="Word"
                value={form.word}
                placeholder="e.g. Haus"
                onChange={(v) => update("word", v)}
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
              <Field
                label="Example sentence (optional)"
                value={form.example_sentence}
                placeholder="e.g. Das Haus ist groß."
                onChange={(v) => update("example_sentence", v)}
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
                Save
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
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
      />
    </div>
  );
}
