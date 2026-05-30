"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sublabel?: string;
  className?: string;
}

export default function StatCard({ label, value, icon, sublabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-2",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
