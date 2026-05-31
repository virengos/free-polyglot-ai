"use client";

import { useEffect, useRef, useState } from "react";
import { usersApi, auditApi } from "@/lib/api";
import type { AuditLicenseResult, ComplianceResult } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import {
  LANGUAGES,
  LANGUAGE_FLAGS,
  CEFR_LEVELS,
  EXERCISE_TYPES,
} from "@/types";
import {
  CheckCircle2,
  Globe,
  Target,
  BookOpen,
  Save,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
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

  // ── Audit state ────────────────────────────────────────────────────────────
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [licenseData, setLicenseData] = useState<AuditLicenseResult | null>(null);
  const [complianceData, setComplianceData] = useState<ComplianceResult | null>(null);
  const [auditTab, setAuditTab] = useState<"licenses" | "compliance">("licenses");
  // lifted so filter/search survive tab-switches and re-renders of LicenseTab
  const [licenseFilter, setLicenseFilter] = useState<"all" | "review" | "restricted">("all");
  const [licenseSearch, setLicenseSearch] = useState("");

  async function loadAudit() {
    setAuditLoading(true);
    try {
      const [lic, comp] = await Promise.all([auditApi.licenses(), auditApi.compliance()]);
      setLicenseData(lic);
      setComplianceData(comp);
    } finally {
      setAuditLoading(false);
    }
  }

  function handleToggleAudit() {
    const next = !auditOpen;
    setAuditOpen(next);
    if (next && !licenseData) loadAudit();
  }

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

      {/* ── Audit ─────────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <button
          onClick={handleToggleAudit}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-slate-700 bg-slate-800/60 hover:border-slate-500 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <div className="text-left">
              <p className="font-semibold text-white">Audit</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Open-source licence compliance &amp; feature-originality check
              </p>
            </div>
          </div>
          {auditOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
        </button>

        {auditOpen && (
          <div className="mt-3 border border-slate-700 rounded-2xl overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-slate-700">
              {(["licenses", "compliance"] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setAuditTab(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    auditTab === tab
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {tab === "licenses" ? "Dependency Licences" : "Feature Originality"}
                </button>
              ))}
              <button
                type="button"
                onClick={loadAudit}
                disabled={auditLoading}
                title="Refresh"
                className="px-4 text-slate-400 hover:text-white transition-colors border-l border-slate-700"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", auditLoading && "animate-spin")} />
              </button>
            </div>

            {auditLoading && !licenseData ? (
              <div className="p-6 text-center text-slate-400 text-sm animate-pulse">
                Running audit…
              </div>
            ) : auditTab === "licenses" && licenseData ? (
              <LicenseTab
                data={licenseData}
                filter={licenseFilter}
                onFilterChange={setLicenseFilter}
                search={licenseSearch}
                onSearchChange={setLicenseSearch}
              />
            ) : auditTab === "compliance" && complianceData ? (
              <ComplianceTab data={complianceData} />
            ) : null}
          </div>
        )}
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

// ── Audit sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "approved" | "review" | "restricted" | "pass" | "warning" | "fail" }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    approved: { label: "Approved", cls: "bg-emerald-900/40 text-emerald-400 border-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    pass:     { label: "Pass",     cls: "bg-emerald-900/40 text-emerald-400 border-emerald-700", icon: <CheckCircle2 className="h-3 w-3" /> },
    review:   { label: "Review",   cls: "bg-amber-900/40  text-amber-400  border-amber-700",    icon: <AlertTriangle  className="h-3 w-3" /> },
    warning:  { label: "Warning",  cls: "bg-amber-900/40  text-amber-400  border-amber-700",    icon: <AlertTriangle  className="h-3 w-3" /> },
    restricted:{ label: "Restricted", cls: "bg-red-900/40 text-red-400   border-red-700",      icon: <XCircle        className="h-3 w-3" /> },
    fail:     { label: "Fail",     cls: "bg-red-900/40   text-red-400    border-red-700",       icon: <XCircle        className="h-3 w-3" /> },
  };
  const { label, cls, icon } = map[status] ?? map.review;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", cls)}>
      {icon}{label}
    </span>
  );
}

function OverallBanner({ overall, label }: { overall: "pass" | "warning" | "fail"; label: string }) {
  const map = {
    pass:    "bg-emerald-900/30 border-emerald-700 text-emerald-300",
    warning: "bg-amber-900/30  border-amber-700  text-amber-300",
    fail:    "bg-red-900/30    border-red-700    text-red-300",
  };
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3 border-b text-sm font-medium", map[overall])}>
      {overall === "pass" && <CheckCircle2 className="h-4 w-4" />}
      {overall === "warning" && <AlertTriangle className="h-4 w-4" />}
      {overall === "fail" && <XCircle className="h-4 w-4" />}
      {label}
    </div>
  );
}

function LicenseTab({
  data,
  filter,
  onFilterChange,
  search,
  onSearchChange,
}: {
  data: import("@/lib/api").AuditLicenseResult;
  filter: "all" | "review" | "restricted";
  onFilterChange: (f: "all" | "review" | "restricted") => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const { summary, packages } = data;
  const listRef = useRef<HTMLDivElement>(null);

  // scroll list to top whenever filter or search changes
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [filter, search]);

  const q = search.toLowerCase();
  const visible = packages.filter((p) => {
    const matchesFilter = filter === "all" ? true : p.status === filter;
    const matchesSearch = q === "" || p.name.toLowerCase().includes(q) || p.license.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const summaryLabel = summary.overall === "pass"
    ? `All ${summary.total} packages use approved licences.`
    : summary.overall === "warning"
    ? `${summary.review} package(s) need licence review — click \"Review\" to inspect.`
    : `${summary.restricted} restricted package(s) detected!`;

  // clicking the warning banner pre-selects the review filter
  function handleBannerClick() {
    if (summary.overall === "warning") onFilterChange("review");
    if (summary.overall === "fail")    onFilterChange("restricted");
  }

  return (
    <div>
      <div
        role={summary.overall !== "pass" ? "button" : undefined}
        tabIndex={summary.overall !== "pass" ? 0 : undefined}
        onClick={summary.overall !== "pass" ? handleBannerClick : undefined}
        onKeyDown={summary.overall !== "pass" ? (e) => e.key === "Enter" && handleBannerClick() : undefined}
        className={summary.overall !== "pass" ? "cursor-pointer" : ""}
      >
        <OverallBanner overall={summary.overall} label={summaryLabel} />
      </div>

      {/* filter buttons + search */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/40">
        {(["all", "review", "restricted"] as const).map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
              filter === f
                ? "border-indigo-500 bg-indigo-600/30 text-white"
                : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-400"
            )}
          >
            {f === "all"
              ? `All (${summary.total})`
              : f === "review"
              ? `Review (${summary.review})`
              : `Restricted (${summary.restricted})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1">
          <Search className="h-3 w-3 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search packages…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-36"
          />
        </div>
      </div>

      {/* count indicator */}
      <div className="px-4 py-1.5 bg-slate-800/20 border-b border-slate-700/50">
        <span className="text-xs text-slate-500">
          Showing <span className="text-slate-300 font-medium">{visible.length}</span> of{" "}
          <span className="text-slate-300 font-medium">{summary.total}</span> packages
        </span>
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto divide-y divide-slate-700/60">
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-slate-500 text-sm">No packages match the current filter.</p>
        ) : (
          visible.map((pkg) => (
            <div key={pkg.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{pkg.name}</p>
                <p className="text-xs text-slate-400">{pkg.license}</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{pkg.version}</span>
              <StatusBadge status={pkg.status} />
              {pkg.home && (
                <a href={pkg.home} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))
        )}
      </div>
      <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
        Licence data sourced from installed Python package metadata (importlib.metadata).
      </p>
    </div>
  );
}

function ComplianceTab({ data }: { data: import("@/lib/api").ComplianceResult }) {
  const { summary, items } = data;
  const [expanded, setExpanded] = useState<string | null>(null);

  const summaryLabel = summary.overall === "pass"
    ? `All ${summary.total} features pass the originality check.`
    : summary.overall === "warning"
    ? `${summary.warning} feature(s) need review.`
    : `${summary.fail} feature(s) failed the originality check!`;

  const riskColor: Record<string, string> = {
    low:    "text-emerald-400",
    medium: "text-amber-400",
    high:   "text-red-400",
  };

  return (
    <div>
      <OverallBanner overall={summary.overall} label={summaryLabel} />
      <div className="divide-y divide-slate-700/60">
        {items.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
            >
              <StatusBadge status={item.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{item.feature}</p>
                <p className="text-xs text-slate-400 truncate">Ref: {item.reference}</p>
              </div>
              <span className={cn("text-xs font-semibold shrink-0", riskColor[item.risk])}>
                {item.risk} risk
              </span>
              {expanded === item.id ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
            </button>
            {expanded === item.id && (
              <div className="px-4 pb-4 bg-slate-800/30 space-y-2">
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Commercial reference: </span>
                  {item.reference} ({item.reference_license})
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold">Our approach: </span>
                  {item.our_approach}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-700">
        This checklist documents independent development. It does not constitute legal advice.
      </p>
    </div>
  );
}
