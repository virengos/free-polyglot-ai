// ─── Domain Types ────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  xp: number;
  level: number;
  streak_days: number;
  streak_last_date: string | null;
  native_language: string;
  target_languages: string[];
  created_at: string;
}

export interface VocabularyWord {
  id: number;
  user_id: number;
  source_language: string;
  target_language: string;
  word: string;
  translation: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  image_url: string | null;
  synonyms: string[];
  tags: string[];
  notes: string | null;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  memory_strength: number;
  times_correct: number;
  times_wrong: number;
  last_reviewed: string | null;
  created_at: string;
}

export interface TrainingSession {
  id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  words_reviewed: number;
  correct_count: number;
  xp_earned: number;
  language_pairs: { source: string; target: string }[];
}

export interface ProgressStats {
  user_id: number;
  total_words: number;
  words_mastered: number;
  words_learning: number;
  words_new: number;
  words_due_now: number;
  total_reviews: number;
  correct_reviews: number;
  accuracy_percent: number;
  total_xp: number;
  level: number;
  streak_days: number;
  languages: LanguageStat[] | null;
  recent_sessions: TrainingSession[] | null;
}

export interface LanguageStat {
  source_language: string;
  target_language: string;
  total_words: number;
  mastered: number;
  avg_memory_strength: number;
}

// ─── Training / Review ────────────────────────────────────────────────────────

export type ExerciseType = "flashcard" | "multiple_choice" | "write" | "fill";

export interface ReviewResult {
  word_id: number;
  xp_earned: number;
  memory_strength: number;
  next_review: string;
  correct: boolean;
  new_level: number | null;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AIHint {
  hint: string;
  mnemonic: string | null;
}

export interface AIExplanation {
  explanation: string;
  examples: string[];
}

// ─── Language codes ───────────────────────────────────────────────────────────

export const LANGUAGES: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  sv: "Svenska",
  pl: "Polski",
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  sv: "🇸🇪",
  pl: "🇵🇱",
};
