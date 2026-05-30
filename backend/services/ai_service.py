import os
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load backend/.env first, then fall back to root .env (where MISTRAL_API_KEY lives)
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
_anthropic_client = None
_openai_client = None


def _get_mistral():
    global _mistral_client
    if _mistral_client is None:
        key = os.getenv("MISTRAL_API_KEY", "").strip().strip("'\"")
        if key:
            from mistralai.client.sdk import Mistral
            _mistral_client = Mistral(api_key=key)
    return _mistral_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if key:
            import anthropic
            _anthropic_client = anthropic.Anthropic(api_key=key)
    return _anthropic_client


def _get_openai():
    global _openai_client
    if _openai_client is None:
        key = os.getenv("OPENAI_API_KEY", "").strip()
        if key:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=key)
    return _openai_client


def _mistral_model() -> str:
    return os.getenv("LLM_MODEL", "mistral-large-latest")


def _chat(prompt: str, max_tokens: int = 300) -> Optional[str]:
    """Send a prompt to Mistral (primary) or Anthropic (fallback). Returns text or None."""
    mistral = _get_mistral()
    if mistral:
        try:
            resp = mistral.chat.complete(
                model=_mistral_model(),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
            )
            return resp.choices[0].message.content.strip()
        except Exception:
            pass  # fall through to Anthropic

    anthropic = _get_anthropic()
    if anthropic:
        try:
            message = anthropic.messages.create(
                model="claude-opus-4-5",
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text.strip()
        except Exception:
            pass

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
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception:
        return None


async def generate_word_image_url(word: str, language: str) -> Optional[str]:
    """Generate an image for a vocabulary word using DALL-E 3."""
    client = _get_openai()
    if not client:
        return None

    lang_name = LANGUAGE_NAMES.get(language, language)
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=(
                f"A clean, simple illustration representing the {lang_name} word '{word}'. "
                "Flat design style, white background, suitable for language learning."
            ),
            size="512x512",
            quality="standard",
            n=1,
        )
        return response.data[0].url
    except Exception:
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



async def generate_word_image_url(word: str, language: str) -> Optional[str]:
    """Generate an image for a vocabulary word using DALL-E 3."""
    client = _get_openai()
    if not client:
        return None

    lang_name = LANGUAGE_NAMES.get(language, language)
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=(
                f"A clean, simple illustration representing the {lang_name} word '{word}'. "
                "Flat design style, white background, suitable for language learning."
            ),
            size="512x512",
            quality="standard",
            n=1,
        )
        return response.data[0].url
    except Exception:
        return None


async def generate_context_story(words: list[str], language: str) -> Optional[str]:
    """Embed multiple vocabulary words in a short story."""
    client = _get_anthropic()
    if not client:
        return None

    lang_name = LANGUAGE_NAMES.get(language, language)
    word_list = ", ".join(f"'{w}'" for w in words)
    try:
        message = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": (
                    f"Write a short, engaging story (4–6 sentences) in {lang_name} "
                    f"that naturally uses all of these words: {word_list}. "
                    "Bold each vocabulary word with **word**. Return only the story."
                ),
            }],
        )
        return message.content[0].text.strip()
    except Exception:
        return None
