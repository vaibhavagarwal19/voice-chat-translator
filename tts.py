from gtts import gTTS
import base64
import io

def speak_text(text, lang='fr'):
    supported_langs = ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh-cn', 'ar', 'nl', 'hi']  # Example list
    if lang not in supported_langs:
        raise ValueError(f"Language '{lang}' not supported by gTTS")
    tts = gTTS(text=text, lang=lang)
    buf = io.BytesIO()
    tts.write_to_fp(buf)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')