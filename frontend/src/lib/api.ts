import axios from "axios";
import type {
  User,
  VocabularyWord,
  TrainingSession,
  ProgressStats,
  ReviewResult,
  WordCategory,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => api.get<User[]>("/api/users/").then((r) => r.data),
  get: (id: number) => api.get<User>(`/api/users/${id}`).then((r) => r.data),
  create: (payload: {
    username: string;
    email: string;
    native_language: string;
    target_languages: string[];
  }) => api.post<User>("/api/users/", payload).then((r) => r.data),
  update: (
    id: number,
    payload: {
      native_language?: string;
      target_languages?: string[];
      language_proficiencies?: Record<string, string>;
      daily_word_goal?: number;
      preferred_exercises?: string[];
    }
  ) => api.put<User>(`/api/users/${id}`, payload).then((r) => r.data),
  progress: (id: number) =>
    api.get<ProgressStats>(`/api/users/${id}/progress`).then((r) => r.data),
};

// ─── Vocabulary ───────────────────────────────────────────────────────────────

export const vocabularyApi = {
  categories: () =>
    api.get<WordCategory[]>("/api/words/categories").then((r) => r.data),

  list: (params: {
    user_id: number;
    source_language?: string;
    target_language?: string;
    search?: string;
    favorites_only?: boolean;
    category?: string;
    skip?: number;
    limit?: number;
  }) =>
    api.get<VocabularyWord[]>("/api/words/", { params }).then((r) => r.data),

  count: (params: {
    user_id: number;
    source_language?: string;
    target_language?: string;
    search?: string;
    favorites_only?: boolean;
    category?: string;
  }) =>
    api.get<{ total: number }>("/api/words/count", { params }).then((r) => r.data),

  get: (id: number) =>
    api.get<VocabularyWord>(`/api/words/${id}`).then((r) => r.data),

  create: (payload: {
    user_id: number;
    source_language: string;
    target_language: string;
    word: string;
    translation: string;
    part_of_speech?: string;
    category?: string;
    example_sentence?: string;
    example_translation?: string;
    synonyms?: string[];
    tags?: string[];
    notes?: string;
  }) => api.post<VocabularyWord>("/api/words/", payload).then((r) => r.data),

  update: (
    id: number,
    payload: Partial<{
      translation: string;
      part_of_speech: string;
      category: string;
      example_sentence: string;
      example_translation: string;
      image_url: string;
      synonyms: string[];
      tags: string[];
      notes: string;
    }>
  ) => api.put<VocabularyWord>(`/api/words/${id}`, payload).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/api/words/${id}`).then((r) => r.data),

  toggleFavorite: (id: number) =>
    api.patch<VocabularyWord>(`/api/words/${id}/favorite`).then((r) => r.data),

  distractors: (id: number, count = 3) =>
    api
      .get<string[]>(`/api/words/${id}/distractors`, { params: { count } })
      .then((r) => r.data),

  bulkImport: (payload: {
    user_id: number;
    source_language: string;
    target_language: string;
    items: { word: string; translation: string }[];
  }) =>
    api
      .post<{ added: number; skipped: number; skipped_words: string[] }>("/api/words/bulk-import", payload)
      .then((r) => r.data),
};

// ─── Training ─────────────────────────────────────────────────────────────────

export const trainingApi = {
  queue: (params: {
    user_id: number;
    source_lang?: string;
    target_lang?: string;
    category?: string;
    limit?: number;
    include_new?: boolean;
    include_all?: boolean;
  }) =>
    api
      .get<VocabularyWord[]>("/api/train/queue", { params })
      .then((r) => r.data),

  review: (payload: {
    user_id: number;
    word_id: number;
    quality: number; // 0-5
    mode: string;   // "flashcard" | "multiple_choice" | "write"
  }) =>
    api.post<ReviewResult>("/api/train/review", payload).then((r) => r.data),

  startSession: (payload: {
    user_id: number;
    language_pairs?: { source: string; target: string }[];
  }) =>
    api
      .post<TrainingSession>("/api/train/session", payload)
      .then((r) => r.data),

  endSession: (session_id: number, payload: { ended_at?: string }) =>
    api
      .patch<TrainingSession>(`/api/train/session/${session_id}/end`, payload)
      .then((r) => r.data),
};

// ─── AI ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  generateSentence: (word: string, language: string, level = "A2") =>
    api
      .post<{ sentence: string }>("/api/ai/sentence", { word, language, level })
      .then((r) => r.data),

  wordInfo: (word: string, source_language: string, target_language: string) =>
    api
      .post("/api/ai/word-info", { word, source_language, target_language })
      .then((r) => r.data),

  story: (words: string[], language: string) =>
    api
      .post<{ story: string }>("/api/ai/story", { words, language })
      .then((r) => r.data),

  suggestWords: (payload: {
    user_id: number;
    source_language: string;
    target_language: string;
    count?: number;
    proficiency_level?: string;
  }) =>
    api
      .post<{ added: number; words: VocabularyWord[] }>("/api/ai/suggest", payload)
      .then((r) => r.data),

  suggestPhrases: (payload: {
    user_id: number;
    source_language: string;
    target_language: string;
    count?: number;
    proficiency_level?: string;
  }) =>
    api
      .post<{ added: number; words: VocabularyWord[] }>("/api/ai/suggest-phrases", payload)
      .then((r) => r.data),

  fillMissingImages: (user_id: number) =>
    api
      .post<{ queued: number; message: string }>("/api/ai/fill-missing-images", null, {
        params: { user_id },
      })
      .then((r) => r.data),

  reclassifyOthers: (user_id: number) =>
    api
      .post<{ queued: number; message: string }>("/api/ai/reclassify-others", null, {
        params: { user_id },
      })
      .then((r) => r.data),

  deduplicate: (user_id: number) =>
    api
      .post<{ deleted: number; message: string }>("/api/ai/deduplicate", null, {
        params: { user_id },
      })
      .then((r) => r.data),

  generateImage: (word: string, language: string) =>
    api
      .post<{ url: string }>("/api/ai/image", null, { params: { word, language } })
      .then((r) => r.data),
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditPackage {
  name: string;
  version: string;
  license: string;
  status: "approved" | "review" | "restricted";
  home: string;
}

export interface AuditLicenseSummary {
  total: number;
  approved: number;
  review: number;
  restricted: number;
  overall: "pass" | "warning" | "fail";
}

export interface AuditLicenseResult {
  packages: AuditPackage[];
  summary: AuditLicenseSummary;
}

export interface ComplianceItem {
  id: string;
  feature: string;
  reference: string;
  reference_license: string;
  our_approach: string;
  status: "pass" | "warning" | "fail";
  risk: "low" | "medium" | "high";
}

export interface ComplianceResult {
  items: ComplianceItem[];
  summary: {
    total: number;
    pass: number;
    warning: number;
    fail: number;
    overall: "pass" | "warning" | "fail";
  };
}

export const auditApi = {
  licenses: () =>
    api.get<AuditLicenseResult>("/api/audit/licenses").then((r) => r.data),
  compliance: () =>
    api.get<ComplianceResult>("/api/audit/compliance").then((r) => r.data),
};

// ─── Conversations ────────────────────────────────────────────────────────────

export interface ConversationTopic {
  id: string;
  label: string;
  emoji: string;
  title_en: string;
}

export interface FillInBlankExercise {
  text: string;             // e.g. "Je ___ étudiant. Je ___ de Berlin."
  blanks: string[];         // answers in order
  blank_hints?: string[];   // per-blank context labels, e.g. ["verb (être)", "verb (venir)"]
  translation: string;
  hint: string;
}

export const conversationsApi = {
  topics: () =>
    api.get<ConversationTopic[]>("/api/conversations/topics").then((r) => r.data),

  exercise: (payload: {
    user_id: number;
    topic: string;
    target_language: string;
    source_language?: string;
    level?: string;
  }) =>
    api
      .post<FillInBlankExercise>("/api/conversations/exercise", payload)
      .then((r) => r.data),
};

export default api;
