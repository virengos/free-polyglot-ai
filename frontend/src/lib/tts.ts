/**
 * High-quality TTS utility.
 *
 * Primary path: Microsoft Edge TTS (edge-tts) via the backend.
 * Uses Azure Cognitive Services Neural voices — no API key required, completely free.
 * Female voices: Katja (DE), Sonia (EN), Elvira (ES), Denise (FR), Sofie (SV), Zofia (PL).
 *
 * Fallback: Web Speech API with the best available female voice, used when the
 * backend is unreachable.
 */

const TTS_ENDPOINT =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/tts";

// BCP-47 locale preferences for the Web Speech fallback
const LANGUAGE_LOCALES: Record<string, string[]> = {
  de: ["de-DE", "de-AT", "de-CH"],
  en: ["en-GB", "en-US", "en-AU"],
  es: ["es-ES", "es-MX", "es-US"],
  fr: ["fr-FR", "fr-CA"],
  sv: ["sv-SE"],
  pl: ["pl-PL"],
};

const FEMALE_VOICE_HINTS = [
  "female", "woman",
  "google uk english female",
  "zira", "hedda", "katja", "helena", "hortense", "paulina", "hedvig", "klara",
  "hazel", "susan", "linda", "heather",
  "samantha", "victoria", "karen", "moira", "tessa", "veena", "amelie", "monica",
  "alice", "anna", "emma", "lisa", "marie", "maria", "sofia", "julia",
  "fiona", "nora", "karin", "maja", "zosia", "ioana",
];

function isFemale(voice: SpeechSynthesisVoice): boolean {
  const n = voice.name.toLowerCase();
  return FEMALE_VOICE_HINTS.some((h) => n.includes(h));
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  const locales = LANGUAGE_LOCALES[lang] ?? [lang];
  let pool = all.filter((v) => locales.some((l) => v.lang === l));
  if (pool.length === 0) {
    const prefix = (locales[0] ?? lang).split("-")[0];
    pool = all.filter((v) => v.lang.startsWith(prefix));
  }
  if (pool.length === 0) return null;
  return (
    pool.find((v) => isFemale(v) && !v.localService) ??
    pool.find((v) => isFemale(v)) ??
    pool.find((v) => !v.localService) ??
    pool[0]
  );
}

function webSpeechFallback(
  text: string,
  lang: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.88;
  utt.pitch = 1.05;
  utt.volume = 1.0;
  utt.lang = LANGUAGE_LOCALES[lang]?.[0] ?? lang;
  if (onStart) utt.onstart = onStart;
  if (onEnd) { utt.onend = onEnd; utt.onerror = onEnd; }
  const doSpeak = () => {
    const voice = pickVoice(lang);
    if (voice) utt.voice = voice;
    window.speechSynthesis.speak(utt);
  };
  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
  }
}

// Track the currently playing audio element so we can stop it on demand
let currentAudio: HTMLAudioElement | null = null;

export interface SpeakOptions {
  /** Called when audio starts playing. */
  onStart?: () => void;
  /** Called when audio finishes or errors. */
  onEnd?: () => void;
}

/**
 * Speak `text` aloud using the OpenAI TTS API (ultra-realistic female voice).
 * Falls back to the Web Speech API if the backend is unavailable.
 *
 * @param text - Text to speak.
 * @param lang - App language code ("de" | "en" | "es" | "fr" | "sv" | "pl").
 * @param opts - Optional onStart / onEnd callbacks for UI feedback.
 */
export function speak(text: string, lang: string, opts: SpeakOptions = {}): void {
  if (typeof window === "undefined") return;

  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  window.speechSynthesis?.cancel();

  // Try OpenAI TTS via backend
  fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: lang }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;

      audio.onplay = () => opts.onStart?.();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        opts.onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        opts.onEnd?.();
      };

      audio.play().catch(() => {
        // Autoplay blocked — try Web Speech as last resort
        webSpeechFallback(text, lang, opts.onStart, opts.onEnd);
      });
    })
    .catch(() => {
      // Backend unavailable or no API key → fall back to Web Speech API
      webSpeechFallback(text, lang, opts.onStart, opts.onEnd);
    });
}
