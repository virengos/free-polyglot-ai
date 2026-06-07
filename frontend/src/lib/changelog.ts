export interface ChangelogEntry {
  version: string;
  date: string;
  features: string[];
  bugfixes?: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "2.2.0",
    date: "2026-06-07",
    features: [
      "Language Basics page: new sidebar entry (GraduationCap icon) for learning fundamental vocabulary — weekdays, months, telling time, numbers 1–20, colors, seasons, greetings, directions, weather, family members, body parts, and basic foods",
      "Learn mode: interactive flashcard grid — click any card to reveal the translation; 'Show all' toggle flips all cards at once; optional example sentence overlay per card",
      "Practice mode: AI-generated fill-in-the-blank exercises focused on the selected basics topic, with word bank, special character bar, per-blank hints, answer reveal, and translation",
      "12 topic modules, each with AI-generated vocabulary sets (4–20 items in natural order) and dedicated practice exercises",
      "Backend: new /api/basics router with GET /topics, POST /set (vocabulary list), and POST /exercise endpoints",
      "AI service: two new functions — generate_basics_set and generate_basics_exercise",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-06-05",
    features: [
      "Vocabulary page: pagination — view 25, 50, or 100 words per page with prev/next navigation and ellipsis for large lists",
      "Vocabulary page: header now shows 'X–Y of Z entries' so you always know your position in the list",
      "Auto-classify: words without a category are automatically sent to AI for classification when the vocabulary page opens (once per session)",
      "Bulk Import: new 'Import' button opens a modal where you can paste many vocabulary pairs at once (comma- or tab-separated, one pair per line)",
      "Bulk Import: live preview table shows the first 10 parsed pairs and counts valid rows vs. lines missing a translation",
      "Bulk Import: duplicate entries (same word + source language) are silently skipped; the result shows how many were added vs. skipped",
      "Bulk Import: all imported words are enriched with AI category and image in the background",
      "Backend: new GET /api/words/count endpoint returns the total matching a filter set (used for pagination)",
      "Backend: GET /api/words/ now accepts skip and limit parameters (max 5000) for server-side pagination",
    ],
    bugfixes: [
      "Category sidebar counts are now loaded with limit:5000 so they reflect all words, not just the current page",
      "loadWords closure inside setTimeout callbacks replaced with a stable ref to avoid stale-closure bugs after filter changes",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-06-04",
    features: [
      "Dashboard: per-language score (0–1000) based on average memory strength, with colour-coded badges (Beginner / Developing / Good / Excellent)",
      "Dashboard: Suggested Activity panel — context-sensitive tips based on streak status, words due, and weakest language",
      "Dashboard: 7-day activity bar chart showing words reviewed per day",
      "DailyStats table: training activity (words reviewed, correct count, XP earned) is now persisted per user, language, and day — forms the basis for long-term progress tracking",
      "AI suggest-phrases endpoint: AI generates idiomatic phrases (Redewendungen) scoped to target language and CEFR level, auto-saved to the phrases category",
      "Vocabulary page: 'Suggest Phrases' button to generate new idiomatic expressions",
      "Vocabulary page: 'Deduplicate' button removes exact duplicate entries (keeping the copy with the most learning progress)",
      "Deduplication endpoint: /api/ai/deduplicate removes exact duplicate vocabulary per user+language pair",
      "AI vocabulary suggest: deduplication scope tightened to source+target language pair (avoids false conflicts across different target languages)",
    ],
    bugfixes: [
      "AI output: slashes used as pronoun separators (ich/wir) are now automatically replaced with commas (ich, wir) so TTS reads them correctly",
      "AI prompt: explicit instruction added to never use backslash or forward slash to separate word variants or personal pronouns",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-05-31",
    features: [
      "Memory game: vocabulary is now filtered to the active session language — only words for the language you chose in Training are shown",
      "Memory game: translation cards now display the same image as their matching word card, so every card in the grid has a visual clue",
      "Memory game: larger cards (h-44) and bigger, bolder text for improved readability",
      "Memory game: language badge shows the current session language (flag + name) above the game board",
      "Memory game: warning banner with link to Training shown when no session language is selected",
    ],
    bugfixes: [
      "Memory game: accuracy score now shown alongside explicit Correct / Wrong / Attempts counters — win screen displays the full breakdown (e.g. '8 correct out of 40 attempts')",
      "Memory game: wrong counter tracks each failed pair attempt independently and resets on new game",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-05-31",
    features: [
      "Conversations page: practise everyday topics with AI-generated fill-in-the-blank exercises (age, origin, profession, hobbies, morning routine, family, food, weekend)",
      "Conversations sidebar entry with MessageSquare icon",
      "Special characters bar in the Write exercise — inserts accented letters (é, ü, ñ, …) at cursor position for the active target language",
      "Vocabulary folder: 'Sort Others' button reclassifies all words still sitting in the Other folder into their correct semantic categories using AI",
      "AI suggest now preferentially fills underrepresented vocabulary categories (sparse category hints)",
    ],
    bugfixes: [
      "Write exercise input gap reduced for a tighter layout",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-05-31",
    features: [
      "One Language at a Time: training sessions are now locked to a single language to prevent interference between languages",
      "Language picker screen shown at the start of every training session — choose the language for today",
      "Active session language lock banner displayed during training with an 'End Session' button",
      "AI vocabulary generation (training page and vocabulary page) now scopes to the active session language only",
      "Session language resets on page refresh, enforcing the one-language-per-session rule",
      "Session complete screen includes a 'New Language Session' button to switch to another language",
      "Vocabulary page 'AI Suggest' button shows lock icon and language name when a session is active",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-05-31",
    features: [
      "Audit panel: check open-source license compliance and prevent 1:1 copying of commercial features",
      "Proficiency-aware AI suggestions: vocabulary difficulty adapts to user level",
      "Duplicate prevention: AI no longer generates vocabulary that already exists for the same language",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-05-31",
    features: [
      "AI-generated images for all vocabulary words including verbs",
      "Images are automatically generated whenever new vocabulary is added via AI",
      "Existing vocabulary entries are updated with images on demand",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-05-30",
    features: [
      "Star/favorites system on flashcards to bookmark vocabulary",
      "Vocabulary editing: update word, translation, and category inline",
      "AI word suggestions: let AI propose new vocabulary for a selected category",
    ],
    bugfixes: [
      "Fixed SM-2 spaced repetition algorithm scheduling edge cases",
      "Corrected interval calculation for newly mastered words",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-05-30",
    features: [
      "Settings page: configure native language, target language, and proficiency level",
      "Daily goal setting and exercise type preferences",
      "Changelog sidebar entry (this page)",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-05-30",
    features: [
      "High-quality neural text-to-speech with a pleasant female voice",
      "TTS support for example sentences in addition to individual words",
      "Switched to Mistral-only AI backend for faster and more consistent responses",
    ],
    bugfixes: [
      "Improved TTS audio quality to match Quizlet/Google Translate standards",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-05-30",
    features: [
      "All UI content translated to English",
      "MIT License added with attribution to Damian Berghof",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-05-30",
    features: [
      "Mistral AI integration via private API key in .env",
      "ANKI-style spaced repetition (SM-2 algorithm): well-learned words repeat after increasing intervals",
      "Vocabulary organized by language and grammar category (nouns, verbs, adjectives, food, clothing, etc.)",
      "Context-sensitive example sentences generated by AI",
    ],
    bugfixes: [
      "Fixed vocabulary fetch failing on empty database",
      "Resolved routing issues in Next.js app router",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-05-30",
    features: [
      "Initial release of Polyglot AI Vocabulary Trainer",
      "Dashboard with progress stats and daily streak",
      "Flashcard, multiple-choice, and write exercises",
      "FastAPI backend with SQLite database",
      "Next.js 15 frontend with Tailwind CSS",
      "Docker Compose setup for easy deployment",
    ],
  },
];
