import logging
from collections import OrderedDict
from threading import Lock

from deep_translator import GoogleTranslator, MyMemoryTranslator

logger = logging.getLogger(__name__)

LANGUAGE_MAP = {
    'zh': 'zh-CN',
}

# LRU cache for translations: (text, src, tgt) -> translated_text.
# In-memory only, ~1000 entries by default — enough to skip re-translating
# common phrases ("hello", "yes", etc.) within a session.
_CACHE_MAX_SIZE = 1000
_translation_cache = OrderedDict()
_cache_lock = Lock()
_cache_stats = {'hits': 0, 'misses': 0}


def _cache_get(key):
    with _cache_lock:
        if key in _translation_cache:
            _translation_cache.move_to_end(key)
            _cache_stats['hits'] += 1
            return _translation_cache[key]
        _cache_stats['misses'] += 1
        return None


def _cache_set(key, value):
    with _cache_lock:
        _translation_cache[key] = value
        _translation_cache.move_to_end(key)
        if len(_translation_cache) > _CACHE_MAX_SIZE:
            _translation_cache.popitem(last=False)


def get_cache_stats():
    """Useful for debugging / metrics endpoint."""
    with _cache_lock:
        total = _cache_stats['hits'] + _cache_stats['misses']
        return {
            'hits': _cache_stats['hits'],
            'misses': _cache_stats['misses'],
            'size': len(_translation_cache),
            'hit_rate': _cache_stats['hits'] / total if total else 0,
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
    Cached: identical (text, src, tgt) within a session returns instantly.
    """
    if translator is None or src_lang == tgt_lang or not text.strip():
        return text

    src = _normalize(src_lang)
    tgt = _normalize(tgt_lang)

    # Cache lookup
    cache_key = (text, src, tgt)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Primary: Google Translate REST endpoint
    try:
        result = GoogleTranslator(source=src, target=tgt).translate(text)
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        logger.warning(f"GoogleTranslator failed ({src}->{tgt}): {e}, trying MyMemory")

    # Fallback: MyMemory (free, slightly lower quality)
    try:
        result = MyMemoryTranslator(source=src, target=tgt).translate(text)
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        logger.error(f"All translators failed ({src}->{tgt}): {e}")
        raise ValueError(f"Translation failed: {e}")
