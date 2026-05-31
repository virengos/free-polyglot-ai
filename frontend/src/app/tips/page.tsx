"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Link2, Sun, Brain, Clock, BookOpen, Repeat, Trophy, ExternalLink } from "lucide-react";
import { usersApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import { LANGUAGE_FLAGS, LANGUAGES } from "@/types";
import { cn } from "@/lib/utils";

// ─── Learning resources per language ─────────────────────────────────────────

interface Resource {
  name: string;
  url: string;
  description: string;
  free: boolean;
  country?: string;
}

const RESOURCES_BY_LANG: Record<string, Resource[]> = {
  fr: [
    {
      name: "TV5Monde – Apprendre le français",
      url: "https://apprendre.tv5monde.com",
      description: "Interactive exercises, videos and lessons by a public French-language broadcaster.",
      free: true,
      country: "🇫🇷🇧🇪🇨🇭",
    },
    {
      name: "Arte – Langue française",
      url: "https://www.arte.tv/fr/",
      description: "Franco-German cultural TV with quality French content and subtitles.",
      free: true,
      country: "🇫🇷🇩🇪",
    },
    {
      name: "RFI – Savoirs",
      url: "https://savoirs.rfi.fr",
      description: "Radio France Internationale's free French learning platform with podcasts and exercises.",
      free: true,
      country: "🇫🇷",
    },
    {
      name: "Le Point du FLE",
      url: "https://www.lepointdufle.net",
      description: "Huge directory of free French learning resources, graded by level.",
      free: true,
      country: "🇫🇷",
    },
    {
      name: "France Culture – Podcasts",
      url: "https://www.radiofrance.fr/franceculture",
      description: "Authentic French radio for advanced learners – culture, history, science.",
      free: true,
      country: "🇫🇷",
    },
  ],
  de: [
    {
      name: "Deutsche Welle – Deutsch lernen",
      url: "https://www.dw.com/de/deutsch-lernen/s-2055",
      description: "Germany's international broadcaster offers free courses from A1 to C1 with audio and video.",
      free: true,
      country: "🇩🇪",
    },
    {
      name: "Goethe-Institut – Online-Übungen",
      url: "https://www.goethe.de/de/spr/ueb.html",
      description: "Free grammar and vocabulary exercises from the official German cultural institute.",
      free: true,
      country: "🇩🇪",
    },
    {
      name: "ARD Mediathek",
      url: "https://www.ardmediathek.de",
      description: "Germany's public TV archive – authentic content with German subtitles.",
      free: true,
      country: "🇩🇪",
    },
    {
      name: "ZDF heute",
      url: "https://www.zdf.de",
      description: "German public broadcaster, great for listening to authentic news German.",
      free: true,
      country: "🇩🇪",
    },
    {
      name: "Slow German Podcast",
      url: "https://slowgerman.com",
      description: "Short podcast episodes spoken slowly in clear German – ideal for intermediate learners.",
      free: true,
      country: "🇩🇪",
    },
  ],
  es: [
    {
      name: "RTVE – Aprender español",
      url: "https://www.rtve.es/television/aprender-espanol/",
      description: "Spain's public broadcaster with dedicated Spanish learning content and authentic shows.",
      free: true,
      country: "🇪🇸",
    },
    {
      name: "Instituto Cervantes – Recursos",
      url: "https://cvc.cervantes.es/ensenanza/actividades_jv/",
      description: "Free interactive activities from the official Spanish language and culture institute.",
      free: true,
      country: "🇪🇸",
    },
    {
      name: "Radio Ambulante (NPR)",
      url: "https://radioambulante.org",
      description: "Spanish-language podcast with stories from across Latin America – great for listening practice.",
      free: true,
      country: "🌎",
    },
    {
      name: "Profe de ELE",
      url: "https://www.profedeele.es",
      description: "Free grammar explanations and exercises for all levels by a certified ELE teacher.",
      free: true,
      country: "🇪🇸",
    },
    {
      name: "Ver-taal",
      url: "https://www.ver-taal.com",
      description: "Short Spanish video clips from authentic TV with vocabulary and comprehension exercises.",
      free: true,
      country: "🇪🇸",
    },
  ],
  en: [
    {
      name: "BBC Learning English",
      url: "https://www.bbc.co.uk/learningenglish",
      description: "The BBC's free English learning hub with videos, grammar lessons and podcasts.",
      free: true,
      country: "🇬🇧",
    },
    {
      name: "VOA Learning English",
      url: "https://learningenglish.voanews.com",
      description: "Voice of America's slowly-spoken news service designed for English learners.",
      free: true,
      country: "🇺🇸",
    },
    {
      name: "British Council – LearnEnglish",
      url: "https://learnenglish.britishcouncil.org",
      description: "Comprehensive free platform with grammar, vocabulary, skills and games.",
      free: true,
      country: "🇬🇧",
    },
    {
      name: "Cambridge English – Free resources",
      url: "https://www.cambridgeenglish.org/learning-english/",
      description: "Sample tests, vocabulary lists and practice activities from Cambridge.",
      free: true,
      country: "🇬🇧",
    },
  ],
  sv: [
    {
      name: "SVT Play",
      url: "https://www.svtplay.se",
      description: "Sweden's public TV on-demand platform – authentic Swedish with Swedish subtitles.",
      free: true,
      country: "🇸🇪",
    },
    {
      name: "Svenska Dagbladet",
      url: "https://www.svd.se",
      description: "One of Sweden's main newspapers – great for reading authentic everyday Swedish.",
      free: true,
      country: "🇸🇪",
    },
    {
      name: "Riksteatern – Lättläst",
      url: "https://lattlast.se",
      description: "Easy-to-read news and stories in simplified Swedish for learners.",
      free: true,
      country: "🇸🇪",
    },
    {
      name: "SR – Sveriges Radio",
      url: "https://sverigesradio.se",
      description: "Public Swedish radio – listen to news, culture and entertainment in authentic Swedish.",
      free: true,
      country: "🇸🇪",
    },
  ],
  pl: [
    {
      name: "TVP VOD",
      url: "https://vod.tvp.pl",
      description: "Poland's public broadcaster on-demand – films, series and documentaries in Polish.",
      free: true,
      country: "🇵🇱",
    },
    {
      name: "Polskie Radio",
      url: "https://www.polskieradio.pl",
      description: "Poland's national public radio – news and culture in authentic Polish.",
      free: true,
      country: "🇵🇱",
    },
    {
      name: "e-polish.eu",
      url: "https://e-polish.eu/en/learning_polish/free_materials.html",
      description: "Free Polish grammar and vocabulary materials organised by level.",
      free: true,
      country: "🇵🇱",
    },
    {
      name: "Learn Polish Podcast",
      url: "https://www.learnpolishpodcast.com",
      description: "Beginner-friendly podcast episodes with transcripts and vocabulary lists.",
      free: true,
      country: "🇵🇱",
    },
  ],
};

// ─── Personalised tips ────────────────────────────────────────────────────────

interface Tip {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const UNIVERSAL_TIPS: Tip[] = [
  {
    icon: <Sun className="h-5 w-5 text-yellow-400" />,
    title: "Study in the Morning",
    body: "Your brain consolidates memories during sleep. Reviewing vocabulary right after waking up — before the day's distractions pile up — gives new words the best chance of moving into long-term memory.",
  },
  {
    icon: <Clock className="h-5 w-5 text-blue-400" />,
    title: "Take Regular Breaks (Pomodoro)",
    body: "Study for 25 minutes, then take a 5-minute break. After four cycles take a longer 15-minute break. Short, focused sessions beat marathon cramming every time.",
  },
  {
    icon: <BookOpen className="h-5 w-5 text-green-400" />,
    title: "Learn Vocabulary in Thematic Groups",
    body: "Cluster new words by topic (e.g. food, emotions, travel). The brain stores related words near each other — learning them together creates stronger memory links and makes retrieval faster.",
  },
  {
    icon: <Repeat className="h-5 w-5 text-indigo-400" />,
    title: "Use Spaced Repetition Consistently",
    body: "Don't skip your daily review session. The spaced repetition algorithm schedules words at exactly the right intervals — missing a day pushes words back and breaks the learning curve.",
  },
  {
    icon: <Brain className="h-5 w-5 text-purple-400" />,
    title: "Activate Multiple Senses",
    body: "Say words out loud when you review them, draw or picture the concept, and write sentences. Engaging ears, voice and eyes together multiplies retention compared to silent reading alone.",
  },
  {
    icon: <Trophy className="h-5 w-5 text-amber-400" />,
    title: "Celebrate Small Wins",
    body: "Mastering 10 words feels small, but 10 words every day is 3,650 words a year — enough to hold a conversation in almost any language. Track your streak and reward consistent effort.",
  },
];

function buildPersonalisedTips(targetLanguages: string[], proficiencies: Record<string, string>): Tip[] {
  const tips: Tip[] = [...UNIVERSAL_TIPS];

  if (targetLanguages.length > 1) {
    tips.splice(2, 0, {
      icon: <Brain className="h-5 w-5 text-pink-400" />,
      title: "One Language at a Time",
      body: `You are learning ${targetLanguages.map((l) => LANGUAGES[l] ?? l).join(" and ")}. Focus your daily session on one language at a time to avoid interference. Switch languages only between separate sessions.`,
    });
  }

  for (const lang of targetLanguages) {
    const level = proficiencies[lang];
    if (level === "A1" || level === "A2") {
      tips.push({
        icon: <BookOpen className="h-5 w-5 text-teal-400" />,
        title: `${LANGUAGE_FLAGS[lang] ?? ""} ${LANGUAGES[lang] ?? lang}: Build Your Core 1,000 Words First`,
        body: `At ${level} level, focus on the most common 1,000 words of ${LANGUAGES[lang] ?? lang}. They cover over 80 % of everyday speech. Add grammar rules only after you can recognise these words instinctively.`,
      });
    } else if (level === "B1" || level === "B2") {
      tips.push({
        icon: <BookOpen className="h-5 w-5 text-teal-400" />,
        title: `${LANGUAGE_FLAGS[lang] ?? ""} ${LANGUAGES[lang] ?? lang}: Switch to Immersion`,
        body: `You are at ${level} level in ${LANGUAGES[lang] ?? lang} — strong enough to learn from authentic content. Watch a short YouTube clip or read one article per day in ${LANGUAGES[lang] ?? lang}. Note unknown words and add them to your vocabulary list.`,
      });
    } else if (level === "C1" || level === "C2") {
      tips.push({
        icon: <Trophy className="h-5 w-5 text-amber-300" />,
        title: `${LANGUAGE_FLAGS[lang] ?? ""} ${LANGUAGES[lang] ?? lang}: Think in the Language`,
        body: `At ${level} you are nearly fluent. Push further by keeping an internal monologue in ${LANGUAGES[lang] ?? lang}, writing a short diary entry each day, and seeking native speaker conversation partners.`,
      });
    }
  }

  return tips;
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabId = "tips" | "resources";

export default function TipsPage() {
  const { currentUserId } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabId>("tips");
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [proficiencies, setProficiencies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.get(currentUserId).then((user) => {
      setTargetLanguages(user.target_languages ?? []);
      setProficiencies(user.language_proficiencies ?? {});
    }).finally(() => setLoading(false));
  }, [currentUserId]);

  const tips = buildPersonalisedTips(targetLanguages, proficiencies);

  // Gather resources for languages the user is learning (fallback to all if none set)
  const displayLanguages =
    targetLanguages.length > 0 ? targetLanguages : Object.keys(RESOURCES_BY_LANG);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "tips", label: "Learning Tips", icon: <Lightbulb className="h-4 w-4" /> },
    { id: "resources", label: "Free Resources", icon: <Link2 className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Lightbulb className="h-7 w-7 text-yellow-400" />
          Become a Polyglot
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Science-backed tips and the best free resources to accelerate your language learning.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-indigo-500 text-white bg-slate-800/60"
                : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Learning Tips */}
      {activeTab === "tips" && (
        <div>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading personalised tips…</p>
          ) : (
            <>
              {targetLanguages.length > 0 && (
                <p className="text-slate-400 text-sm mb-6">
                  Personalised for your languages:{" "}
                  {targetLanguages.map((l) => (
                    <span key={l} className="inline-flex items-center gap-1 mr-2 text-white">
                      {LANGUAGE_FLAGS[l]} {LANGUAGES[l] ?? l}
                    </span>
                  ))}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {tips.map((tip, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 font-semibold text-white">
                      {tip.icon}
                      {tip.title}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{tip.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Free Resources */}
      {activeTab === "resources" && (
        <div className="flex flex-col gap-10">
          {displayLanguages
            .filter((lang) => RESOURCES_BY_LANG[lang])
            .map((lang) => (
              <section key={lang}>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>{LANGUAGE_FLAGS[lang] ?? "🌐"}</span>
                  {LANGUAGES[lang] ?? lang}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {RESOURCES_BY_LANG[lang].map((res) => (
                    <a
                      key={res.url}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-xl border border-slate-700 bg-slate-800/50 p-4 hover:border-indigo-500 hover:bg-slate-800 transition-colors flex flex-col gap-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-white text-sm group-hover:text-indigo-300 transition-colors">
                          {res.name}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0 mt-0.5 transition-colors" />
                      </div>
                      {res.country && (
                        <span className="text-xs text-slate-500">{res.country}</span>
                      )}
                      <p className="text-slate-400 text-xs leading-relaxed mt-1">{res.description}</p>
                      <span className="mt-2 self-start text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                        Free
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ))}

          {/* Languages not yet supported */}
          {displayLanguages.filter((l) => !RESOURCES_BY_LANG[l]).length > 0 && (
            <p className="text-slate-500 text-sm">
              No curated resources yet for:{" "}
              {displayLanguages
                .filter((l) => !RESOURCES_BY_LANG[l])
                .map((l) => LANGUAGES[l] ?? l)
                .join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
