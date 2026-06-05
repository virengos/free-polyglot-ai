"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { vocabularyApi } from "@/lib/api";
import { LANGUAGES } from "@/types";
import toast from "react-hot-toast";

interface BulkImportModalProps {
  userId: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  word: string;
  translation: string;
  valid: boolean;
}

/** Parse pasted text into word/translation pairs.
 *  Supports comma-separated and tab-separated values.
 *  Lines with fewer than 2 columns are flagged invalid.
 */
function parseInput(text: string): ParsedRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Prefer tab split; fall back to first comma
      const parts = line.includes("\t")
        ? line.split("\t")
        : line.split(",");
      const word = (parts[0] ?? "").trim();
      const translation = parts.slice(1).join(",").trim(); // allow commas in translation
      return { word, translation, valid: word.length > 0 && translation.length > 0 };
    });
}

export default function BulkImportModal({ userId, open, onClose, onImported }: BulkImportModalProps) {
  const [rawText, setRawText] = useState("");
  const [sourceLang, setSourceLang] = useState("de");
  const [targetLang, setTargetLang] = useState("en");
  const [importing, setImporting] = useState(false);

  // Reset textarea on close
  useEffect(() => {
    if (!open) {
      setRawText("");
    }
  }, [open]);

  const rows = useMemo(() => parseInput(rawText), [rawText]);
  const validRows = rows.filter((r) => r.valid);
  const invalidCount = rows.length - validRows.length;

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const result = await vocabularyApi.bulkImport({
        user_id: userId,
        source_language: sourceLang,
        target_language: targetLang,
        items: validRows.map((r) => ({ word: r.word, translation: r.translation })),
      });
      if (result.added > 0) {
        toast.success(
          `${result.added} word${result.added !== 1 ? "s" : ""} imported!` +
            (result.skipped > 0 ? ` (${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped)` : "")
        );
      } else {
        toast(`All ${result.skipped} word${result.skipped !== 1 ? "s" : ""} already exist – nothing imported.`);
      }
      onImported();
      onClose();
    } catch (err: any) {
      const detail: string = err?.response?.data?.detail ?? "";
      toast.error(detail || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Bulk Import</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Instructions */}
              <p className="text-sm text-slate-400">
                Paste your vocabulary pairs below — one pair per line, separated by a{" "}
                <span className="text-slate-200 font-medium">comma</span> or a{" "}
                <span className="text-slate-200 font-medium">Tab</span>. Example:
              </p>
              <pre className="bg-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 select-all whitespace-pre">
{`der Hund,the dog
la maison\thome
красивый,beautiful`}
              </pre>

              {/* Language selectors */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Source language</label>
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Target language</label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Paste vocabulary pairs
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={"der Hund,the dog\ndie Katze,the cat\nder Apfel\tapple"}
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-y font-mono"
                />
              </div>

              {/* Preview summary */}
              {rows.length > 0 && (
                <div className="flex items-start gap-3 flex-wrap text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {validRows.length} valid pair{validRows.length !== 1 ? "s" : ""}
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      {invalidCount} line{invalidCount !== 1 ? "s" : ""} skipped (missing translation)
                    </span>
                  )}
                </div>
              )}

              {/* Preview table – show first 10 valid rows */}
              {validRows.length > 0 && (
                <div className="rounded-xl border border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-2 w-1/2">Word</th>
                        <th className="text-left px-4 py-2 w-1/2">Translation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-slate-700/60 hover:bg-slate-800/40">
                          <td className="px-4 py-2 text-white">{row.word}</td>
                          <td className="px-4 py-2 text-slate-300">{row.translation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validRows.length > 10 && (
                    <p className="text-xs text-slate-500 px-4 py-2 border-t border-slate-700/60">
                      … and {validRows.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
              <button
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importing…" : `Import ${validRows.length} word${validRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
