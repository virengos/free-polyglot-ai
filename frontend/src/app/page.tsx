"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import type { ProgressStats } from "@/types";
import { useAppStore } from "@/store/appStore";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";
import { LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import {
  BookOpen,
  Flame,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { currentUserId } = useAppStore();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    usersApi
      .progress(currentUserId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400 animate-pulse text-lg">Lade Dashboard…</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <p className="text-slate-400">Backend nicht erreichbar.</p>
        <p className="text-slate-600 text-sm">
          Starte den Backend-Server mit{" "}
          <code className="bg-slate-800 px-2 py-0.5 rounded text-xs">
            uvicorn main:app --reload
          </code>
        </p>
      </div>
    );
  }

  const accuracy = Math.round(stats.accuracy_percent);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Dein Lernfortschritt auf einen Blick</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Level"
          value={stats.level}
          icon={<Star className="h-4 w-4" />}
          sublabel={`${stats.total_xp} XP gesamt`}
        />
        <StatCard
          label="Streak"
          value={`${stats.streak_days}d`}
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          sublabel="Tage in Folge"
        />
        <StatCard
          label="Vokabeln"
          value={stats.total_words}
          icon={<BookOpen className="h-4 w-4" />}
          sublabel={`${stats.words_due_now} fällig`}
        />
        <StatCard
          label="Genauigkeit"
          value={`${accuracy}%`}
          icon={<Target className="h-4 w-4" />}
          sublabel={`${stats.total_reviews} Wiederholungen`}
        />
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Lernstatus</h2>
          <span className="text-xs text-slate-400">{stats.total_words} Vokabeln</span>
        </div>
        {stats.total_words > 0 ? (
          <div className="space-y-3">
            <ProgressBar
              label="Gelernt (≥80%)"
              value={(stats.words_mastered / stats.total_words) * 100}
              color="bg-emerald-500"
              showPercent
            />
            <ProgressBar
              label="In Bearbeitung"
              value={(stats.words_learning / stats.total_words) * 100}
              color="bg-blue-500"
              showPercent
            />
            <ProgressBar
              label="Neu"
              value={(stats.words_new / stats.total_words) * 100}
              color="bg-slate-500"
              showPercent
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Noch keine Vokabeln vorhanden.</p>
        )}
      </div>

      {stats.languages.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Sprachen</h2>
          <div className="space-y-4">
            {stats.languages.map((lang) => (
              <div key={`${lang.source_language}-${lang.target_language}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">
                    {LANGUAGE_FLAGS[lang.source_language]} →{" "}
                    {LANGUAGE_FLAGS[lang.target_language]}{" "}
                    {LANGUAGES[lang.target_language] ?? lang.target_language}
                  </span>
                  <span className="text-xs text-slate-400">
                    {lang.mastered}/{lang.total_words} gelernt
                  </span>
                </div>
                <ProgressBar
                  value={
                    lang.total_words > 0 ? (lang.mastered / lang.total_words) * 100 : 0
                  }
                  color="bg-indigo-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/training"
          className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-2xl p-6 flex items-center gap-4"
        >
          <div className="bg-indigo-500 rounded-xl p-3">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">Training starten</p>
            <p className="text-indigo-200 text-sm">
              {stats.words_due_now > 0
                ? `${stats.words_due_now} Vokabeln fällig`
                : "Alle Vokabeln wiederholt"}
            </p>
          </div>
        </Link>

        <Link
          href="/vocabulary"
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors rounded-2xl p-6 flex items-center gap-4"
        >
          <div className="bg-slate-700 rounded-xl p-3">
            <BookOpen className="h-6 w-6 text-slate-300" />
          </div>
          <div>
            <p className="font-bold text-white">Vokabeln verwalten</p>
            <p className="text-slate-400 text-sm">Hinzufügen & bearbeiten</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
