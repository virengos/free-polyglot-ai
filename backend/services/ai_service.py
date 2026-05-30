import os
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

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

_mistral_client = None


def _get_mistral():
    global _mistral_client
    if _mistral_client is None:
        key = os.getenv("MISTRAL_API_KEY", "").strip().strip("'\"")
        if key:
            from mistralai.client.sdk import Mistral
            _mistral_client = Mistral(api_key=key)
    return _mistral_client


def _mistral_model() -> str:
    return os.getenv("LLM_MODEL", "mistral-large-latest")


def _chat(prompt: str, max_tokens: int = 300) -> Optional[str]:
    """Send a prompt to Mistral. Returns text or None."""
    mistral = _get_mistral()
    if not mistral:
        return None
    try:
        resp = mistral.chat.complete(
            model=_mistral_model(),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
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


async def generate_word_image_url(word: str, language: str) -> Optional[str]:
    """Image generation requires DALL-E; not available with Mistral-only setup."""
    return None


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

