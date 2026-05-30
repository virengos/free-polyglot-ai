"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  CEFR_LEVELS,
  EXERCISE_TYPES,
} from "@/types";
import { CheckCircle2, Globe, Target, BookOpen, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type Draft = {
  native_language: string;
  target_languages: string[];
  language_proficiencies: Record<string, string>;
  daily_word_goal: number;
  preferred_exercises: string[];
};

export default function SettingsPage() {
  const { currentUserId, setUser } = useAppStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    usersApi.get(currentUserId).then((user) => {
      setDraft({
        native_language: user.native_language,
        target_languages: user.target_languages ?? [],
        language_proficiencies: user.language_proficiencies ?? {},
        daily_word_goal: user.daily_word_goal ?? 10,
        preferred_exercises: user.preferred_exercises ?? ["flashcard", "multiple_choice", "write"],
      });
      setLoading(false);
    });
  }, [currentUserId]);

  if (loading || !draft) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 animate-pulse text-lg">Loading settings…</div>
      </div>
    );
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function toggleTargetLanguage(code: string) {
    if (!draft || code === draft.native_language) return;
    setDraft((d) => {
      if (!d) return d;
      const already = d.target_languages.includes(code);
      const next = already
        ? d.target_languages.filter((l) => l !== code)
        : [...d.target_languages, code];
      // clean up proficiency if removed
      const proficiencies = { ...d.language_proficiencies };
      if (already) delete proficiencies[code];
      return { ...d, target_languages: next, language_proficiencies: proficiencies };
    });
  }

  function setProficiency(lang: string, level: string) {
    setDraft((d) => d ? { ...d, language_proficiencies: { ...d.language_proficiencies, [lang]: level } } : d);
  }

  function toggleExercise(type: string) {
    setDraft((d) => {
      if (!d) return d;
      const already = d.preferred_exercises.includes(type);
      // keep at least one
      if (already && d.preferred_exercises.length === 1) return d;
      return {
        ...d,
        preferred_exercises: already
          ? d.preferred_exercises.filter((e) => e !== type)
          : [...d.preferred_exercises, type],
      };
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await usersApi.update(currentUserId, draft);
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const allLangCodes = Object.keys(LANGUAGES);

  return (
    <div className="p-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure your languages, proficiency levels and learning preferences.
        </p>
      </div>

      {/* ── Native language ────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-indigo-400" />
          <h2 className="font-semibold text-white">Native language</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {allLangCodes.map((code) => (
            <button
              key={code}
              onClick={() =>
                setDraft((d) =>
                  d && code !== d.native_language
                    ? {
                        ...d,
                        native_language: code,
                        // remove native from targets if present
                        target_languages: d.target_languages.filter((l) => l !== code),
                      }
                    : d
                )
              }
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                draft.native_language === code
                  ? "border-indigo-500 bg-indigo-600 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
              )}
            >
              <span>{LANGUAGE_FLAGS[code]}</span>
              <span>{LANGUAGES[code]}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Target languages + proficiency ────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-emerald-400" />
          <h2 className="font-semibold text-white">Languages to learn</h2>
          <span className="text-xs text-slate-500 ml-1">– tap to toggle</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {allLangCodes
            .filter((code) => code !== draft.native_language)
            .map((code) => {
              const active = draft.target_languages.includes(code);
              return (
                <button
                  key={code}
                  onClick={() => toggleTargetLanguage(code)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                    active
                      ? "border-emerald-500 bg-emerald-600/20 text-white"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                  )}
                >
                  <span>{LANGUAGE_FLAGS[code]}</span>
                  <span>{LANGUAGES[code]}</span>
                  {active && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                </button>
              );
            })}
        </div>

        {/* Proficiency selectors for chosen target languages */}
        {draft.target_languages.length > 0 && (
          <div className="space-y-3">
            {draft.target_languages.map((code) => (
              <div
                key={code}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-slate-800 rounded-xl px-4 py-3"
              >
                <span className="text-sm text-white font-medium w-28 shrink-0">
                  {LANGUAGE_FLAGS[code]} {LANGUAGES[code]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CEFR_LEVELS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setProficiency(code, value)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold border transition-colors",
                        draft.language_proficiencies[code] === value
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-400"
                      )}
                      title={label}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {draft.language_proficiencies[code] && (
                  <span className="text-xs text-slate-400 sm:ml-auto">
                    {CEFR_LEVELS.find((l) => l.value === draft.language_proficiencies[code])?.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Daily word goal ───────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-amber-400" />
          <h2 className="font-semibold text-white">Daily word goal</h2>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={draft.daily_word_goal}
            onChange={(e) =>
              setDraft((d) => d && { ...d, daily_word_goal: Number(e.target.value) })
            }
            className="flex-1 accent-indigo-500"
          />
          <span className="w-20 text-center text-white font-bold text-lg">
            {draft.daily_word_goal} <span className="text-xs font-normal text-slate-400">words</span>
          </span>
        </div>
      </section>

      {/* ── Preferred exercise types ──────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-pink-400" />
          <h2 className="font-semibold text-white">Preferred exercise types</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXERCISE_TYPES.map(({ value, label }) => {
            const active = draft.preferred_exercises.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleExercise(value)}
                className={cn(
                  "px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                  active
                    ? "border-pink-500 bg-pink-600/20 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
                )}
              >
                {active && <CheckCircle2 className="inline h-3.5 w-3.5 text-pink-400 mr-1.5" />}
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-2">At least one type must be selected.</p>
      </section>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all",
          saved
            ? "bg-emerald-600 text-white"
            : "bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60"
        )}
      >
        {saved ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Saved!
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
          </>
        )}
      </button>
    </div>
  );
}
