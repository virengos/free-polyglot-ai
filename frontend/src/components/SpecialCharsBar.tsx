"use client";

import { cn } from "@/lib/utils";

// Special characters grouped by language
const SPECIAL_CHARS: Record<string, string[]> = {
  de: ["ä", "ö", "ü", "Ä", "Ö", "Ü", "ß"],
  fr: ["à", "â", "é", "è", "ê", "ë", "î", "ï", "ô", "ù", "û", "ü", "ç", "œ", "æ", "Œ", "Æ", "À", "É", "È"],
  es: ["á", "é", "í", "ó", "ú", "ü", "ñ", "Á", "É", "Í", "Ó", "Ú", "Ñ", "¡", "¿"],
  sv: ["å", "ä", "ö", "Å", "Ä", "Ö"],
  pl: ["ą", "ć", "ę", "ł", "ń", "ó", "ś", "ź", "ż", "Ą", "Ć", "Ę", "Ł", "Ń", "Ó", "Ś", "Ź", "Ż"],
  en: [],
};

interface SpecialCharsBarProps {
  /** BCP-47 / internal language code, e.g. "fr", "de" */
  language: string;
  /** Called with the character that was clicked */
  onInsert: (char: string) => void;
  className?: string;
}

/**
 * Renders a compact row of clickable special-character buttons for the given
 * language. Returns null when no special characters are defined (e.g. English).
 */
export default function SpecialCharsBar({ language, onInsert, className }: SpecialCharsBarProps) {
  const chars = SPECIAL_CHARS[language] ?? [];
  if (chars.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 p-1.5 bg-slate-900/80 border border-slate-700 rounded-xl",
        className
      )}
      // Prevent the toolbar click from stealing focus from the input
      onMouseDown={(e) => e.preventDefault()}
    >
      {chars.map((ch) => (
        <button
          key={ch}
          type="button"
          tabIndex={-1}
          onClick={() => onInsert(ch)}
          className="min-w-[2rem] h-8 px-2 rounded-lg bg-slate-800 hover:bg-indigo-600 text-white text-sm font-medium border border-slate-700 hover:border-indigo-500 transition-colors"
        >
          {ch}
        </button>
      ))}
    </div>
  );
}

/**
 * Inserts `char` at the current cursor position of a controlled <input>.
 * Restores focus and caret position after React's re-render.
 */
export function insertAtCursor(
  inputRef: React.RefObject<HTMLInputElement | null>,
  char: string,
  currentValue: string,
  setValue: (v: string) => void
) {
  const el = inputRef.current;
  const start = el ? (el.selectionStart ?? currentValue.length) : currentValue.length;
  const end = el ? (el.selectionEnd ?? currentValue.length) : currentValue.length;
  const next = currentValue.slice(0, start) + char + currentValue.slice(end);
  setValue(next);
  if (el) {
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  }
}
