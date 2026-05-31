import logging
import os
import json
import random
import hashlib
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load backend/.env first, then fall back to root .env
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=False)

LANGUAGE_NAMES = {
    "de": "German",
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "sv": "Swedish",
    "pl": "Polish",
}

# Semantic vocabulary categories shown as folders in the UI
WORD_CATEGORIES = {
    "animals":    "Animals",
    "food":       "Food & Drinks",
    "clothing":   "Clothing",
    "household":  "Household",
    "body":       "Body",
    "nature":     "Nature",
    "people":     "People & Family",
    "work":       "Work & Career",
    "travel":     "Travel & Transport",
    "emotions":   "Emotions",
    "time":       "Time & Dates",
    "health":     "Health",
    "shopping":   "Shopping",
    "education":  "Education",
    "technology": "Technology",
    "sports":     "Sports",
    "verbs":      "Verbs",
    "adjectives": "Adjectives & Adverbs",
    "phrases":    "Phrases",
    "other":      "Other",
}

_mistral_client = None


def _get_mistral():
    global _mistral_client
    if _mistral_client is None:
        key = os.getenv("MISTRAL_API_KEY", "").strip().strip("'\"")
        if key:
            from mistralai import Mistral
            _mistral_client = Mistral(api_key=key)
    return _mistral_client


def _mistral_model() -> str:
    return os.getenv("LLM_MODEL", "mistral-large-latest")


def _is_rate_limited(exc: Exception) -> bool:
    return "429" in str(exc) or "rate" in str(exc).lower()


def _chat(prompt: str, max_tokens: int = 300, model: Optional[str] = None) -> Optional[str]:
    """Send a prompt to Mistral. Returns text or None."""
    global _mistral_client
    mistral = _get_mistral()
    if not mistral:
        logger.warning("Mistral client not available – MISTRAL_API_KEY missing or empty")
        return None
    chosen_model = model or _mistral_model()
    try:
        resp = mistral.chat.complete(
            model=chosen_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        if _is_rate_limited(exc):
            logger.warning("Mistral rate limit (429) hit for model %s", chosen_model)
        else:
            logger.error("Mistral API call failed: %s", exc)
        # Reset cached client on auth/connection failures so the next call retries
        if any(kw in str(exc).lower() for kw in ("unauthorized", "401", "connection", "timeout")):
            _mistral_client = None
        return None


async def generate_example_sentence(word: str, language: str, level: str = "A2") -> Optional[str]:
    """Generate a natural example sentence for a vocabulary word."""
    lang_name = LANGUAGE_NAMES.get(language, language)
    prompt = (
        f"Write one short, natural example sentence in {lang_name} "
        f"(CEFR level {level}) using the word '{word}'. "
        "Return only the sentence, nothing else."
    )
    return _chat(prompt, max_tokens=150)


async def generate_word_info(word: str, source_lang: str, target_lang: str) -> Optional[dict]:
    """Generate full word info: translation, part of speech, example, synonym."""
    src = LANGUAGE_NAMES.get(source_lang, source_lang)
    tgt = LANGUAGE_NAMES.get(target_lang, target_lang)
    prompt = (
        f"For the {src} word '{word}', provide:\n"
        f"1. Translation in {tgt}\n"
        "2. Part of speech (noun/verb/adjective/adverb/other)\n"
        f"3. A short natural example sentence in {src}\n"
        f"4. Translation of the example sentence in {tgt}\n"
        "5. One synonym (in the same source language)\n\n"
        'Respond ONLY with valid JSON: '
        '{"translation":"...","part_of_speech":"...","example":"...","example_translation":"...","synonym":"..."}'
    )
    raw = _chat(prompt, max_tokens=400)
    if raw is None:
        return None
    try:
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception:
        return None


async def generate_word_image_url(word: str, language: str, force_new: bool = False) -> Optional[str]:
    """Use Mistral to find the best English keyword, then return a LoremFlickr URL."""
    lang_name = LANGUAGE_NAMES.get(language, language)
    prompt = (
        f"The {lang_name} vocabulary word is '{word}'. "
        "What is the single best English keyword (1-2 words, lowercase, no articles) "
        "to search for an image that visually represents this word? "
        "Reply with ONLY the keyword, nothing else."
    )
    # Use the small/fast model for this trivial single-keyword task to preserve
    # rate-limit quota on the larger model for more complex operations.
    keyword = _chat(prompt, max_tokens=20, model="mistral-small-latest")
    if not keyword:
        return None
    # Clean up the keyword – strip quotes, punctuation, limit length
    keyword = keyword.strip().strip("\"'.,;").replace(" ", "+")[:40]
    if not keyword:
        return None
    # For explicit regeneration use a random lock so a different image is returned.
    # For initial generation use a stable hash so the same image is always picked.
    if force_new:
        lock = random.randint(0, 9999)
    else:
        lock = int(hashlib.md5(word.encode()).hexdigest()[:8], 16) % 10000
    return f"https://loremflickr.com/400/300/{keyword}?lock={lock}"


async def classify_word_category(word: str, translation: str, part_of_speech: Optional[str], language: str) -> Optional[str]:
    """Ask Mistral to assign one of the predefined semantic categories to the word."""
    categories = ", ".join(WORD_CATEGORIES.keys())
    lang_name = LANGUAGE_NAMES.get(language, language)
    prompt = (
        f"Classify the {lang_name} vocabulary word '{word}' (translation: '{translation}', "
        f"part of speech: '{part_of_speech or 'unknown'}') into exactly one of these categories:\n"
        f"{categories}\n"
        "Reply with ONLY the category key, nothing else."
    )
    raw = _chat(prompt, max_tokens=20, model="mistral-small-latest")
    if not raw:
        return None
    cat = raw.strip().lower().strip("\"'.,;")
    return cat if cat in WORD_CATEGORIES else None


async def generate_context_story(words: list[str], language: str) -> Optional[str]:
    """Embed multiple vocabulary words in a short story."""
    lang_name = LANGUAGE_NAMES.get(language, language)
    word_list = ", ".join(f"'{w}'" for w in words)
    prompt = (
        f"Write a short, engaging story (4–6 sentences) in {lang_name} "
        f"that naturally uses all of these words: {word_list}. "
        "Bold each vocabulary word with **word**. Return only the story."
    )
    return _chat(prompt, max_tokens=400)


async def generate_fill_in_blank(
    topic: str,
    target_language: str,
    source_language: str = "de",
    level: str = "A2",
) -> Optional[dict]:
    """Generate a fill-in-the-blank conversation exercise for a given topic."""
    lang_name = LANGUAGE_NAMES.get(target_language, target_language)
    source_lang_name = LANGUAGE_NAMES.get(source_language, source_language)

    topic_descriptions = {
        "age":             "introducing yourself and talking about your age",
        "origin":          "talking about where you come from, your hometown and country",
        "profession":      "talking about your job and career",
        "hobbies":         "talking about hobbies and free time activities",
        "morning_routine": "describing your morning routine (getting up, breakfast, etc.)",
        "family":          "talking about your family members",
        "food":            "talking about your favourite foods and eating habits",
        "weekend":         "describing what you do on weekends",
    }

    description = topic_descriptions.get(topic, topic)

    prompt = (
        f"Create a fill-in-the-blank vocabulary exercise in {lang_name} "
        f"for a {level} learner.\n"
        f"Topic: {description}\n\n"
        "STRICT RULES:\n"
        "1. Write 3-5 short first-person sentences about the topic.\n"
        "2. Choose 4-6 blanks. ONLY blank out vocabulary/grammar words "
        "(verbs, prepositions, adjectives, adverbs, nouns). "
        "NEVER blank out a number, a name, or unique personal detail — "
        "the learner cannot guess those. "
        "Good examples: verb form, preposition, adjective, noun.\n"
        "3. For each blank, provide a short English hint (2-4 words) describing "
        "the word type/category, e.g. 'verb (to have)', 'preposition', "
        "'adjective (size)', 'noun (family member)'.\n"
        "4. Return ONLY valid JSON, no markdown fences:\n"
        '{"text":"Je ___ étudiant. Je ___ de Berlin.","blanks":["suis","viens"],'
        '"blank_hints":["verb (être)","verb (venir)"],'
        f'"translation":"{source_lang_name}: Ich bin Student. Ich komme aus Berlin.",'
        '"hint":"Fill in the missing grammar words."}\n\n'
        "blank_hints must have exactly the same length as blanks."
    )

    raw = _chat(prompt, max_tokens=700)
    if not raw:
        return None
    try:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text.strip())
        if "text" not in data or "blanks" not in data:
            return None
        # Validate blank count matches answer count
        blank_count = data["text"].count("___")
        if blank_count != len(data["blanks"]):
            return None
        # Ensure blank_hints has the right length (pad or trim if AI got it wrong)
        hints = data.get("blank_hints", [])
        if len(hints) != blank_count:
            data["blank_hints"] = (hints + [""] * blank_count)[:blank_count]
        return data
    except Exception:
        logger.error("Failed to parse fill-in-the-blank JSON for topic=%s lang=%s", topic, target_language)
        return None


async def suggest_vocabulary(
    existing_words: list[dict],
    source_lang: str,
    target_lang: str,
    count: int = 5,
    proficiency_level: str = "A2",
    sparse_categories: list[str] | None = None,
) -> Optional[list[dict]]:
    """Ask the AI to suggest new vocabulary words based on existing ones."""
    src = LANGUAGE_NAMES.get(source_lang, source_lang)
    tgt = LANGUAGE_NAMES.get(target_lang, target_lang)

    # Map CEFR level to human-readable description for the prompt
    cefr_description = {
        "A1": "absolute beginner (A1)",
        "A2": "elementary (A2)",
        "B1": "intermediate (B1)",
        "B2": "upper-intermediate (B2)",
        "C1": "advanced (C1)",
        "C2": "proficient/native-level (C2)",
    }.get(proficiency_level.upper(), f"level {proficiency_level}")

    # Use up to 30 words as AI context; pass all words as an explicit exclusion list
    sample = existing_words[:30]
    if sample:
        word_list = ", ".join(f'"{w["word"]}" ({w["translation"]})' for w in sample)
        context = f"They already know these words: {word_list}. "
    else:
        context = ""

    # Build a compact exclusion list of just the source words so the AI
    # cannot re-suggest any of them regardless of how many the user has.
    all_words = [w["word"] for w in existing_words]
    exclusion = ""
    if all_words:
        exclusion = (
            "IMPORTANT: Do NOT suggest any of the following words (exact or close variants): "
            + ", ".join(f'"{w}"' for w in all_words)
            + ". "
        )

    # Build a hint for sparse categories so the AI prefers to fill them up
    sparse_hint = ""
    if sparse_categories:
        sparse_hint = (
            f"IMPORTANT: The following vocabulary categories are still sparse (fewer than 5 words). "
            f"Prefer words from these categories: {", ".join(sparse_categories[:10])}. "
        )

    prompt = (
        f"A language learner is learning {tgt} from {src}. "
        f"Their current proficiency in {tgt} is {cefr_description}. "
        f"{context}"
        f"{exclusion}"
        f"{sparse_hint}"
        f"Suggest {count} useful new {src}\u2192{tgt} vocabulary words appropriate for {cefr_description} level "
        "that are not already in the exclusion list. "
        "Return ONLY a JSON array with no extra text:\n"
        '[{"word":"...","translation":"...","part_of_speech":"...","category":"...","example_sentence":"...","example_translation":"..."}]\n'
        f'Valid categories: {", ".join(WORD_CATEGORIES.keys())}'
    )

    raw = _chat(prompt, max_tokens=1200)
    if raw is None:
        return None
    try:
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
        return json.loads(raw.strip())
    except Exception:
        return None

