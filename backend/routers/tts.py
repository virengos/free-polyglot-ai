from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

router = APIRouter(prefix="/api/tts", tags=["tts"])

# Realistic female neural voices via Microsoft Edge TTS (free, no API key needed)
# These are the same voices as Azure Cognitive Services Neural TTS.
VOICE_MAP: dict[str, str] = {
    "de": "de-DE-KatjaNeural",
    "en": "en-GB-SoniaNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "sv": "sv-SE-SofieNeural",
    "pl": "pl-PL-ZofiaNeural",
}

DEFAULT_VOICE = "en-GB-SoniaNeural"


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("")
async def text_to_speech(payload: TTSRequest):
    """
    Convert text to speech using Microsoft Edge TTS (free, neural quality).
    Returns an audio/mp3 stream.
    """
    try:
        import edge_tts
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="edge-tts library not installed. Run: pip install edge-tts",
        )

    voice = VOICE_MAP.get(payload.language, DEFAULT_VOICE)

    try:
        communicate = edge_tts.Communicate(payload.text, voice)
        audio_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        audio_bytes = b"".join(audio_chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Edge TTS error: {exc}") from exc

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="Edge TTS returned no audio data.")

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )
