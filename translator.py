import logging

from deep_translator import GoogleTranslator, MyMemoryTranslator

logger = logging.getLogger(__name__)

# Map our language codes to deep-translator codes (mostly identical)
LANGUAGE_MAP = {
    'zh': 'zh-CN',
}


def _normalize(lang):
    return LANGUAGE_MAP.get(lang, lang)


def load_translation_model(src_lang, tgt_lang):
    """Returns a sentinel - actual translators are created per-request (cheap, stateless)."""
    if src_lang == tgt_lang:
        return None
    return True


def translate_text(text, translator, src_lang, tgt_lang):
    """
    Translate using deep-translator. Tries Google's official endpoint first
    (much more reliable than scraping with googletrans), falls back to MyMemory.
    """
    if translator is None or src_lang == tgt_lang or not text.strip():
        return text

    src = _normalize(src_lang)
    tgt = _normalize(tgt_lang)

    # Primary: Google Translate REST endpoint
    try:
        return GoogleTranslator(source=src, target=tgt).translate(text)
    except Exception as e:
        logger.warning(f"GoogleTranslator failed ({src}->{tgt}): {e}, trying MyMemory")

    # Fallback: MyMemory (free, slightly lower quality)
    try:
        return MyMemoryTranslator(source=src, target=tgt).translate(text)
    except Exception as e:
        logger.error(f"All translators failed ({src}->{tgt}): {e}")
        raise ValueError(f"Translation failed: {e}")
