import base64
import logging
import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room

from transcriber import transcribe_chunk
from translator import load_translation_model, translate_text
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
user_languages = {}      # {sid: {'spoken', 'listen', 'room_id'}}
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
    spoken_lang = data.get('spoken')
    listen_lang = data.get('listen')

    if not room_id or not spoken_lang or not listen_lang:
        emit('error', {'message': 'Missing room_id, spoken, or listen parameters'})
        return

    if spoken_lang not in SUPPORTED_LANGUAGES or listen_lang not in SUPPORTED_LANGUAGES:
        emit('error', {'message': 'Unsupported language'})
        return

    room_occupancy.setdefault(room_id, set()).add(sid)
    user_languages[sid] = {'spoken': spoken_lang, 'listen': listen_lang, 'room_id': room_id}
    join_room(room_id)
    logger.info(f"{sid} joined {room_id} ({spoken_lang} -> {listen_lang})")

    for other_sid in get_other_sids(sid, room_id):
        emit('user_joined', {'sid': sid, 'spoken': spoken_lang}, room=other_sid)

        # Pre-load translation models in both directions
        other = user_languages[other_sid]
        try:
            get_or_load_translator(spoken_lang, other['listen'])
            get_or_load_translator(other['spoken'], listen_lang)
        except Exception as e:
            logger.error(f"Failed to pre-load translation model: {e}")

    emit('joined', {
        'room_id': room_id,
        'sid': sid,
        'room_size': len(room_occupancy[room_id]),
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

    # Run interim transcription every ~3 chunks once buffer is large enough
    chunk_index = data.get('chunk_index', 0)
    if chunk_index > 0 and chunk_index % 3 == 0 and len(audio_buffers[sid]) > 50000:
        sender_lang = user_languages[sid]['spoken']
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

    sender_lang = user_languages[sid]['spoken']
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

    for target_sid in get_other_sids(sid, room_id):
        target_lang = user_languages[target_sid]['listen']
        try:
            translated_text = translate_for_target(text, sender_lang, target_lang)
            audio_b64 = speak_text(translated_text, lang=target_lang)
            emit('translated_audio', {
                'audio': audio_b64,
                'original_text': text,
                'translated_text': translated_text,
                'from': sid,
                'to_lang': target_lang,
            }, room=target_sid)
        except Exception as e:
            logger.error(f"Translation/TTS error for {target_sid}: {e}")
            emit('error', {'message': f"Translation error: {e}"}, room=target_sid)


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

    sender_lang = user_languages[sid]['spoken']
    room_id = user_languages[sid]['room_id']

    for target_sid in get_other_sids(sid, room_id):
        target_lang = user_languages[target_sid]['listen']
        try:
            translated_text = translate_for_target(text, sender_lang, target_lang)
            emit('translated_text', {
                'original_text': text,
                'translated_text': translated_text,
                'from': sid,
                'to_lang': target_lang,
            }, room=target_sid)
        except Exception as e:
            logger.error(f"Text translation error: {e}")
            emit('error', {'message': f"Translation error: {e}"}, room=target_sid)


if __name__ == '__main__':
    print("Starting Flask-SocketIO server on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)
