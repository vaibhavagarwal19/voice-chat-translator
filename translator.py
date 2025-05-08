from googletrans import Translator
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(name)s %(levelname)s: %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)
logger.debug("Logging initialized at DEBUG level for translator")

# Language code mapping for Google Translate
LANGUAGE_MAP = {
    'zh': 'zh-cn',  # Map zh to zh-cn for Google Translate
    'en': 'en',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'pt': 'pt',
    'ru': 'ru',
    'ar': 'ar',
    'nl': 'nl',
    'hi': 'hi',
    'ur': 'ur',
    'bn': 'bn'
}

def load_translation_model(src_lang, tgt_lang):
    """
    Initialize Google Translate client for src_lang to tgt_lang.
    
    Args:
        src_lang: Source language code (e.g., 'hi')
        tgt_lang: Target language code (e.g., 'bn')
    
    Returns:
        Translator object (or None for same-language pairs)
    """
    if src_lang == tgt_lang:
        logger.debug(f"No translation needed for same language: {src_lang}")
        return None
    
    try:
        translator = Translator()
        logger.info(f"Initialized Google Translate for {src_lang} to {tgt_lang}")
        return translator
    except Exception as e:
        logger.error(f"Failed to initialize Google Translate: {str(e)}")
        raise ValueError(f"Google Translate initialization failed: {str(e)}")

def translate_text(text, translator, src_lang, tgt_lang):
    """
    Translate text using Google Translate.
    
    Args:
        text: Input text to translate
        translator: Google Translate client (or None for same-language)
        src_lang: Source language code
        tgt_lang: Target language code
    
    Returns:
        Translated text
    """
    if translator is None:
        logger.debug("No translation needed (same language)")
        return text
    
    # Map language codes
    src_lang = LANGUAGE_MAP.get(src_lang, src_lang)
    tgt_lang = LANGUAGE_MAP.get(tgt_lang, tgt_lang)
    
    logger.debug(f"Translating text: '{text}' from {src_lang} to {tgt_lang}")
    
    try:
        # Retry logic for rate limits
        for attempt in range(3):
            try:
                translated = translator.translate(text, src=src_lang, dest=tgt_lang)
                translated_text = translated.text
                logger.debug(f"Translation result: '{translated_text}'")
                return translated_text
            except Exception as e:
                logger.warning(f"Translation attempt {attempt + 1} failed: {str(e)}")
                if attempt == 2:
                    raise
                time.sleep(1)  # Wait before retrying
    except Exception as e:
        logger.error(f"Translation failed for {src_lang} to {tgt_lang}: {str(e)}")
        raise ValueError(f"Google Translate error: {str(e)}")