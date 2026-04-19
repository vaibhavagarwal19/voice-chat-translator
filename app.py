import os

# Workaround for OpenMP library conflict between PyTorch and CTranslate2
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import base64
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

from transcriber import transcribe_chunk
from translator import load_translation_model, translate_text, get_cache_stats
from tts import speak_text

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s: %(message)s',
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    ping_timeout=20000,
    ping_interval=10000,
)

SUPPORTED_LANGUAGES = {'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ar', 'nl', 'hi', 'ur', 'bn'}
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory state
user_languages = {}      # {sid: {'language', 'room_id'}}
room_occupancy = {}      # {room_id: set(sid)}
translation_models = {}  # {(src_lang, tgt_lang): translator}
audio_buffers = {}       # {sid: bytearray()}


# ----- Helpers -----

def get_other_sids(sid, room_id):
    return [s for s in user_languages
            if s != sid and user_languages[s]['room_id'] == room_id]


def get_or_load_translator(src_lang, tgt_lang):
    if src_lang == tgt_lang:
        return None
    key = (src_lang, tgt_lang)
    if key not in translation_models:
        translation_models[key] = load_translation_model(src_lang, tgt_lang)
    return translation_models[key]


def translate_for_target(text, src_lang, tgt_lang):
    if src_lang == tgt_lang:
        return text
    translator = get_or_load_translator(src_lang, tgt_lang)
    return translate_text(text, translator, src_lang, tgt_lang)


def cleanup_user(sid):
    """Remove a user from all in-memory state and notify the room."""
    audio_buffers.pop(sid, None)
    if sid not in user_languages:
        return

    room_id = user_languages[sid]['room_id']

    if room_id in room_occupancy:
        room_occupancy[room_id].discard(sid)
        if not room_occupancy[room_id]:
            del room_occupancy[room_id]

    for other_sid in get_other_sids(sid, room_id):
        emit('user_left', {'sid': sid}, room=other_sid)

    leave_room(room_id)
    del user_languages[sid]


# ----- REST Endpoints -----

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})


@app.route('/cache_stats', methods=['GET'])
def cache_stats():
    """Returns translation cache hit rate. Useful for verifying the cache is working."""
    return jsonify(get_cache_stats())


@app.route('/translate_audio_file', methods=['POST'])
def translate_audio_file():
    if 'audio' not in request.files:
        return jsonify({"error": "Missing audio file"}), 400

    spoken_lang = request.form.get('spoken_language') or request.form.get('spoken')
    listen_lang = request.form.get('listening_language') or request.form.get('listen')

    if not spoken_lang or not listen_lang:
        return jsonify({"error": "Missing language parameters"}), 400

    if spoken_lang not in SUPPORTED_LANGUAGES or listen_lang not in SUPPORTED_LANGUAGES:
        return jsonify({"error": "Unsupported language"}), 400

    audio_file = request.files['audio']
    extension = os.path.splitext(audio_file.filename)[1] if audio_file.filename else '.tmp'
    audio_bytes = audio_file.read()

    try:
        text = transcribe_chunk(audio_bytes, language=spoken_lang, temp_dir=TEMP_DIR, extension=extension)
        if not text:
            return jsonify({"error": "Could not transcribe audio"}), 500

        translated_text = translate_for_target(text, spoken_lang, listen_lang)
        translated_audio_b64 = speak_text(translated_text, lang=listen_lang)

        return jsonify({
            "original_text": text,
            "translated_text": translated_text,
            "translated_audio": translated_audio_b64,
        })
    except Exception as e:
        logger.error(f"Audio file translation error: {e}")
        return jsonify({"error": str(e)}), 500


# ----- WebSocket Handlers -----

@socketio.on('connect')
def handle_connect():
    sid = request.sid
    logger.info(f"Connected: {sid}")
    emit('connected', {'sid': sid})


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logger.info(f"Disconnected: {sid}")
    cleanup_user(sid)


@socketio.on('join_call')
def handle_join_call(data):
    sid = request.sid
    room_id = data.get('room_id')
    # User has ONE language - they speak it AND see/hear everything in it
    language = data.get('language') or data.get('spoken')

    if not room_id or not language:
        emit('error', {'message': 'Missing room_id or language'})
        return

    if language not in SUPPORTED_LANGUAGES:
        emit('error', {'message': f'Unsupported language: {language}'})
        return

    # Snapshot existing participants BEFORE adding the new user
    existing = [
        {'sid': s, 'language': user_languages[s]['language']}
        for s in user_languages
        if user_languages[s]['room_id'] == room_id
    ]

    room_occupancy.setdefault(room_id, set()).add(sid)
    user_languages[sid] = {'language': language, 'room_id': room_id}
    join_room(room_id)
    logger.info(f"{sid} joined {room_id} (language: {language})")

    for other_sid in get_other_sids(sid, room_id):
        emit('user_joined', {'sid': sid, 'language': language}, room=other_sid)

        # Pre-load translation models in both directions
        other_lang = user_languages[other_sid]['language']
        try:
            get_or_load_translator(language, other_lang)
            get_or_load_translator(other_lang, language)
        except Exception as e:
            logger.error(f"Failed to pre-load translation model: {e}")

    emit('joined', {
        'room_id': room_id,
        'sid': sid,
        'language': language,
        'room_size': len(room_occupancy[room_id]),
        'participants': existing,
    })


@socketio.on('leave_call')
def handle_leave_call(data=None):
    sid = request.sid
    if sid not in user_languages:
        return
    room_id = user_languages[sid]['room_id']
    cleanup_user(sid)
    emit('left', {'room_id': room_id}, room=sid)


@socketio.on('start_streaming')
def handle_start_streaming(data=None):
    sid = request.sid
    if sid not in user_languages:
        emit('error', {'message': 'Not in a call'}, room=sid)
        return

    audio_buffers[sid] = bytearray()
    room_id = user_languages[sid]['room_id']
    logger.info(f"Streaming started: {sid}")

    for other_sid in get_other_sids(sid, room_id):
        emit('user_speaking', {'sid': sid, 'speaking': True}, room=other_sid)

    emit('streaming_started', {'status': 'ok'}, room=sid)


@socketio.on('audio_chunk')
def handle_audio(data):
    sid = request.sid
    if sid not in user_languages:
        emit('error', {'message': 'Not in a call'}, room=sid)
        return
    if 'content' not in data:
        return

    try:
        audio_bytes = base64.b64decode(data['content'])
    except Exception as e:
        logger.error(f"Invalid audio format from {sid}: {e}")
        return

    if not audio_bytes:
        return

    audio_buffers.setdefault(sid, bytearray()).extend(audio_bytes)

    # Run interim transcription on every chunk once buffer is large enough.
    # Faster-Whisper handles short audio well, so this gives a near real-time feel.
    chunk_index = data.get('chunk_index', 0)
    if chunk_index > 0 and len(audio_buffers[sid]) > 30000:
        sender_lang = user_languages[sid]['language']
        room_id = user_languages[sid]['room_id']
        try:
            text = transcribe_chunk(bytes(audio_buffers[sid]), language=sender_lang, temp_dir=TEMP_DIR)
            if text:
                payload = {'text': text, 'is_final': False, 'from': sid}
                emit('transcription_update', payload, room=sid)
                for other_sid in get_other_sids(sid, room_id):
                    emit('transcription_update', payload, room=other_sid)
        except Exception as e:
            logger.error(f"Interim transcription error for {sid}: {e}")


@socketio.on('stop_streaming')
def handle_stop_streaming(data=None):
    sid = request.sid
    if sid not in user_languages:
        return

    sender_lang = user_languages[sid]['language']
    room_id = user_languages[sid]['room_id']
    full_audio = bytes(audio_buffers.pop(sid, bytearray()))

    for other_sid in get_other_sids(sid, room_id):
        emit('user_speaking', {'sid': sid, 'speaking': False}, room=other_sid)

    if not full_audio or len(full_audio) < 1000:
        emit('transcription_update', {'text': '', 'is_final': True, 'from': sid}, room=sid)
        return

    logger.info(f"Final audio for {sid}: {len(full_audio)} bytes")

    try:
        text = transcribe_chunk(full_audio, language=sender_lang, temp_dir=TEMP_DIR)
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        emit('error', {'message': f"Transcription error: {e}"}, room=sid)
        return

    if not text:
        emit('transcription_update', {'text': '', 'is_final': True, 'from': sid}, room=sid)
        return

    emit('transcription_update', {'text': text, 'is_final': True, 'from': sid}, room=sid)

    # Broadcast a single shared message to ALL users in the room (including sender),
    # each customised to their listening language. This way both tabs see the
    # same conversation but in their own preferred language.
    _broadcast_message(sid, room_id, text, sender_lang, with_audio=True)


def _broadcast_message(sender_sid, room_id, text, sender_lang, with_audio=False):
    """Send one 'message' event per user in the room, translated to their listen language."""
    import time as _time
    message_id = f"{sender_sid}-{int(_time.time() * 1000)}"
    room_sids = list(room_occupancy.get(room_id, set()))

    for user_sid in room_sids:
        if user_sid not in user_languages:
            continue

        viewer_lang = user_languages[user_sid]['language']
        is_self = user_sid == sender_sid

        try:
            # The viewer's translated version of the message
            translated = text if is_self or sender_lang == viewer_lang \
                else translate_for_target(text, sender_lang, viewer_lang)

            # Generate audio for non-senders only (they're the ones who need to hear it)
            audio_b64 = None
            if with_audio and not is_self:
                try:
                    audio_b64 = speak_text(translated, lang=viewer_lang)
                except Exception as e:
                    logger.error(f"TTS failed for {user_sid}: {e}")

            emit('message', {
                'id': message_id,
                'from_sid': sender_sid,
                'is_self': is_self,
                'original_text': text,
                'original_lang': sender_lang,
                'translated_text': translated,
                'translated_lang': viewer_lang,
                'audio': audio_b64,
            }, room=user_sid)
        except Exception as e:
            logger.error(f"Broadcast error for {user_sid}: {e}")
            emit('error', {'message': f"Translation error: {e}"}, room=user_sid)


@socketio.on('text_message')
def handle_text_message(data):
    sid = request.sid
    text = (data.get('text') or data.get('message') or '').strip()
    if not text:
        emit('error', {'message': 'Empty text message'}, room=sid)
        return
    if sid not in user_languages:
        emit('error', {'message': 'Not in a call'}, room=sid)
        return

    sender_lang = user_languages[sid]['language']
    room_id = user_languages[sid]['room_id']
    _broadcast_message(sid, room_id, text, sender_lang, with_audio=True)


if __name__ == '__main__':
    print("Starting Flask-SocketIO server on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)
