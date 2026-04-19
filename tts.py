from gtts import gTTS
import base64
import io

# Map language codes to gTTS-compatible codes
TTS_LANGUAGE_MAP = {
    'zh': 'zh-cn',
    'bn': 'bn',
    'ur': 'ur',
}

SUPPORTED_TTS_LANGS = {'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'zh-cn', 'ar', 'nl', 'hi', 'ur', 'bn'}


def speak_text(text, lang='fr'):
    if lang not in SUPPORTED_TTS_LANGS:
        raise ValueError(f"Language '{lang}' not supported by gTTS")

    # Map to gTTS-compatible code
    gtts_lang = TTS_LANGUAGE_MAP.get(lang, lang)

    tts = gTTS(text=text, lang=gtts_lang)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')
