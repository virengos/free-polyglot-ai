import { changelog } from "@/lib/changelog";
import { GitBranch, Wrench, Sparkles } from "lucide-react";

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitBranch className="h-7 w-7 text-indigo-400" />
          Changelog
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          All notable changes to Polyglot AI, following semantic versioning (x.y.z).
        </p>
      </div>

      <div className="relative border-l-2 border-slate-700 ml-4 space-y-10">
        {changelog.map((entry) => {
          const [major, minor, patch] = entry.version.split(".").map(Number);
          const isMinor = patch === 0 && minor > 0;
          const isMajor = minor === 0 && patch === 0;
          const dotColor = isMajor
            ? "bg-indigo-500"
            : isMinor
            ? "bg-emerald-500"
            : "bg-slate-500";

          return (
            <div key={entry.version} className="relative pl-8">
              {/* Timeline dot */}
              <span
                className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-slate-900 ${dotColor}`}
              />

              {/* Version badge + date */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-lg font-bold text-white">
                  v{entry.version}
                </span>
                <span className="text-xs text-slate-500">{entry.date}</span>
                {isMajor && (
                  <span className="text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-600/50 rounded-full px-2 py-0.5">
                    Major
                  </span>
                )}
                {isMinor && !isMajor && (
                  <span className="text-xs bg-emerald-600/30 text-emerald-300 border border-emerald-600/50 rounded-full px-2 py-0.5">
                    Minor
                  </span>
                )}
                {!isMajor && !isMinor && (
                  <span className="text-xs bg-slate-700/60 text-slate-400 border border-slate-600 rounded-full px-2 py-0.5">
                    Patch
                  </span>
                )}
              </div>

              {/* Features */}
              {entry.features.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> New Features
                  </h3>
                  <ul className="space-y-1">
                    {entry.features.map((f, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-emerald-400 mt-0.5">+</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bug fixes */}
              {entry.bugfixes && entry.bugfixes.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Bug Fixes
                  </h3>
                  <ul className="space-y-1">
                    {entry.bugfixes.map((b, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <span className="text-amber-400 mt-0.5">⚑</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
