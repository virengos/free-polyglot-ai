import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format milliseconds as "m:ss" */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Accuracy 0-100 → color class */
export function accuracyColor(pct: number): string {
  if (pct >= 80) return "text-green-500";
  if (pct >= 50) return "text-yellow-500";
  return "text-red-500";
}

/** Memory strength 0-100 → label */
export function memoryLabel(strength: number): string {
  if (strength >= 80) return "Sehr gut";
  if (strength >= 50) return "Gut";
  if (strength >= 20) return "Lernend";
  return "Neu";
}

/** Memory strength 0-100 → Tailwind color */
export function memoryColor(strength: number): string {
  if (strength >= 80) return "bg-emerald-500";
  if (strength >= 50) return "bg-blue-500";
  if (strength >= 20) return "bg-yellow-500";
  return "bg-slate-400";
}

/** SM-2 quality 0-5 → descriptive label */
export function qualityLabel(q: number): string {
  const labels: Record<number, string> = {
    0: "Komplett falsch",
    1: "Falsch",
    2: "Schwierig",
    3: "Okay",
    4: "Gut",
    5: "Perfekt",
  };
  return labels[q] ?? "Unbekannt";
}

/** Shuffle an array (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
