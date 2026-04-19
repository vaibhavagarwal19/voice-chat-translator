import logging
import time

from googletrans import Translator

logger = logging.getLogger(__name__)

# Map language codes to Google Translate-compatible codes
LANGUAGE_MAP = {
    'zh': 'zh-cn',
}


def load_translation_model(src_lang, tgt_lang):
    """Initialize a Google Translate client. Returns None for same-language pairs."""
    if src_lang == tgt_lang:
        return None
    try:
        return Translator()
    except Exception as e:
        logger.error(f"Failed to initialize Google Translate: {e}")
        raise ValueError(f"Translator init failed: {e}")


def translate_text(text, translator, src_lang, tgt_lang):
    """Translate text with retry on transient failures."""
    if translator is None:
        return text

    src = LANGUAGE_MAP.get(src_lang, src_lang)
    tgt = LANGUAGE_MAP.get(tgt_lang, tgt_lang)

    for attempt in range(3):
        try:
            return translator.translate(text, src=src, dest=tgt).text
        except Exception as e:
            logger.warning(f"Translation attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                raise ValueError(f"Translation failed: {e}")
            time.sleep(1)
