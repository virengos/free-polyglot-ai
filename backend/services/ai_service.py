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


async def suggest_vocabulary(
    existing_words: list[dict],
    source_lang: str,
    target_lang: str,
    count: int = 5,
) -> Optional[list[dict]]:
    """Ask the AI to suggest new vocabulary words based on existing ones."""
    src = LANGUAGE_NAMES.get(source_lang, source_lang)
    tgt = LANGUAGE_NAMES.get(target_lang, target_lang)

    sample = existing_words[:15]
    if sample:
        word_list = ", ".join(f'"{w["word"]}" ({w["translation"]})' for w in sample)
        context = f"They already know these words: {word_list}. "
    else:
        context = ""

    prompt = (
        f"A language learner is learning {tgt} from {src}. "
        f"{context}"
        f"Suggest {count} useful new {src}\u2192{tgt} vocabulary words at beginner/intermediate level. "
        "Do not repeat words already in the list. "
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

