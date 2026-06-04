"use client";

import { useEffect, useState } from "react";
import { usersApi } from "@/lib/api";
import type { ProgressStats, DailyStat } from "@/types";
import { useAppStore } from "@/store/appStore";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";
import { LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import {
  BookOpen,
  Flame,
  Lightbulb,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

// ── helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 750) return "text-emerald-400";
  if (score >= 500) return "text-yellow-400";
  if (score >= 250) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 750) return "bg-emerald-500/20 border-emerald-700";
  if (score >= 500) return "bg-yellow-500/20 border-yellow-700";
  if (score >= 250) return "bg-orange-500/20 border-orange-700";
  return "bg-red-500/20 border-red-700";
}

function scoreLabel(score: number): string {
  if (score >= 750) return "Excellent";
  if (score >= 500) return "Good";
  if (score >= 250) return "Developing";
  return "Beginner";
}

// Build last-N-days activity map from daily_stats
function buildActivityChart(
  dailyStats: DailyStat[],
  days: number
): { date: string; label: string; total: number; langs: Record<string, number> }[] {
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayLabel = i === 0 ? "Today" : i === 1 ? "Yest." : d.toLocaleDateString("en", { weekday: "short" });
    const matching = dailyStats.filter((s) => s.date === iso);
    const langs: Record<string, number> = {};
    let total = 0;
    for (const s of matching) {
      langs[s.target_language] = (langs[s.target_language] ?? 0) + s.words_reviewed;
      total += s.words_reviewed;
    }
    result.push({ date: iso, label: dayLabel, total, langs });
  }
  return result;
}

// ── component ──────────────────────────────────────────────────────────────────

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
        <div className="text-slate-400 animate-pulse text-lg">Loading dashboard…</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <p className="text-slate-400">Backend not reachable.</p>
        <p className="text-slate-600 text-sm">
          Start the backend server with{" "}
          <code className="bg-slate-800 px-2 py-0.5 rounded text-xs">
            uvicorn main:app --reload
          </code>
        </p>
      </div>
    );
  }

  const accuracy = Math.round(stats.accuracy_percent);
  const activityDays = buildActivityChart(stats.daily_stats ?? [], 7);
  const maxActivity = Math.max(...activityDays.map((d) => d.total), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Your learning progress at a glance</p>
      </div>

      {/* ── Top Stats Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Level"
          value={stats.level}
          icon={<Star className="h-4 w-4" />}
          sublabel={`${stats.total_xp} XP total`}
        />
        <StatCard
          label="Streak"
          value={`${stats.streak_days}d`}
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          sublabel={stats.streak_days === 0 ? "Train today to start!" : "day streak"}
        />
        <StatCard
          label="Vocabulary"
          value={stats.total_words}
          icon={<BookOpen className="h-4 w-4" />}
          sublabel={`${stats.words_due_now} due`}
        />
        <StatCard
          label="Accuracy"
          value={`${accuracy}%`}
          icon={<Target className="h-4 w-4" />}
          sublabel={stats.total_reviews === 0 ? "No reviews yet" : `${stats.total_reviews} reviews`}
        />
      </div>

      {/* ── Call-to-action when no reviews done yet ─────────────────────────── */}
      {stats.total_reviews === 0 && stats.total_words > 0 && (
        <div className="bg-indigo-900/40 border border-indigo-700 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-200">Start training to see your stats!</p>
            <p className="text-xs text-indigo-300 mt-0.5">
              XP, streak, and accuracy are earned through training sessions. Words become{" "}
              <span className="text-emerald-400 font-medium">Mastered</span> after multiple correct
              reviews over several days — just like Anki.
            </p>
          </div>
        </div>
      )}

      {/* ── Suggestions ─────────────────────────────────────────────────────── */}
      {(stats.suggestions ?? []).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">Suggested Activity</h2>
          </div>
          <ul className="space-y-2">
            {(stats.suggestions ?? []).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-yellow-400 mt-0.5 shrink-0">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Language Scores ──────────────────────────────────────────────────── */}
      {(stats.languages ?? []).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Language Scores</h2>
          <div className="space-y-4">
            {(stats.languages ?? []).map((lang) => (
              <div key={`${lang.source_language}-${lang.target_language}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{LANGUAGE_FLAGS[lang.target_language]}</span>
                    <span className="text-sm font-medium text-slate-200">
                      {LANGUAGES[lang.target_language] ?? lang.target_language}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${scoreBg(lang.language_score)}`}
                    >
                      <span className={scoreColor(lang.language_score)}>
                        {scoreLabel(lang.language_score)}
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${scoreColor(lang.language_score)}`}>
                      {lang.language_score}
                    </span>
                    <span className="text-slate-500 text-xs"> /1000</span>
                  </div>
                </div>
                <ProgressBar
                  value={lang.language_score / 10}
                  color={
                    lang.language_score >= 750
                      ? "bg-emerald-500"
                      : lang.language_score >= 500
                      ? "bg-yellow-500"
                      : lang.language_score >= 250
                      ? "bg-orange-500"
                      : "bg-red-500"
                  }
                />
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>{lang.mastered}/{lang.total_words} mastered</span>
                  <span>avg. strength {lang.avg_memory_strength}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Learning Status ──────────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Learning Status</h2>
          <span className="text-xs text-slate-400">{stats.total_words} words</span>
        </div>
        {stats.total_words > 0 ? (
          <div className="space-y-3">
            <ProgressBar
              label="Mastered (≥80%)"
              value={(stats.words_mastered / stats.total_words) * 100}
              color="bg-emerald-500"
              showPercent
            />
            <ProgressBar
              label="In Progress"
              value={(stats.words_learning / stats.total_words) * 100}
              color="bg-blue-500"
              showPercent
            />
            <ProgressBar
              label="New"
              value={(stats.words_new / stats.total_words) * 100}
              color="bg-slate-500"
              showPercent
            />
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No vocabulary words yet.</p>
        )}
      </div>

      {/* ── 7-Day Activity Chart ─────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Weekly Activity</h2>
        <div className="flex items-end gap-2 h-20">
          {activityDays.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: "56px" }}>
                <div
                  className={`w-full rounded-t transition-all ${
                    day.total > 0 ? "bg-indigo-500 hover:bg-indigo-400" : "bg-slate-700"
                  }`}
                  style={{
                    height: day.total > 0 ? `${Math.max(4, (day.total / maxActivity) * 56)}px` : "4px",
                  }}
                  title={`${day.total} word${day.total !== 1 ? "s" : ""} reviewed`}
                />
              </div>
              <span className="text-xs text-slate-500 truncate w-full text-center">
                {day.label}
              </span>
              {day.total > 0 && (
                <span className="text-xs text-indigo-400 font-medium">{day.total}</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-2">Words reviewed per day (last 7 days)</p>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/training"
          className="bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-2xl p-6 flex items-center gap-4"
        >
          <div className="bg-indigo-500 rounded-xl p-3">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">Start Training</p>
            <p className="text-indigo-200 text-sm">
              {stats.words_due_now > 0
                ? `${stats.words_due_now} words due`
                : "All words reviewed"}
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
            <p className="font-bold text-white">Manage Vocabulary</p>
            <p className="text-slate-400 text-sm">Add &amp; edit</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

