from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from transcriber import transcribe_chunk
from translator import load_translation_model, translate_text
from tts import speak_text
import base64
import numpy as np
import io
import soundfile as sf
import logging
import os
import time

# Configure logging with a console handler
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(name)s %(levelname)s: %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)
logger.debug("Logging initialized at DEBUG level for Flask-SocketIO server")

app = Flask(__name__)
# Change the SocketIO initialization to:
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=20000,      # Adjust timeouts for polling
    ping_interval=10000
)

# Store user language preferences and translation models
user_languages = {}  # {sid: {'spoken': 'en', 'listen': 'fr', 'room_id': 'room1'}}
room_occupancy = {}  # {room_id: set([sid1, sid2])} - tracks users in each room
translation_models = {}  # {(src_lang, tgt_lang): translator}

# Supported languages (aligned with tts.py)
SUPPORTED_LANGUAGES = {'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ar', 'nl', 'hi', 'ur', 'bn'}

# Define temporary directory
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)
    logger.info(f"Created temporary directory: {TEMP_DIR}")

# Serve frontend
@app.route('/ui')
def serve_ui():
    return render_template('index.html')

# REST API: Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "message": "Voice translation server is running"})

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    sid = request.sid
    logger.info(f"Client connected: {sid} with transport {request.environ.get('HTTP_X_TRANSPORT', 'unknown')}")
    emit('connected', {'sid': sid})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logger.info(f"Client disconnected: {sid}")
    if sid in user_languages:
        room_id = user_languages[sid]['room_id']
        logger.info(f"User {sid} disconnected from room {room_id}")
        
        # Remove user from room occupancy
        if room_id in room_occupancy and sid in room_occupancy[room_id]:
            room_occupancy[room_id].discard(sid)
            if not room_occupancy[room_id]:  # If room is empty, clean up
                del room_occupancy[room_id]
                logger.debug(f"Room {room_id} is now empty and removed")
        
        # Notify other users in the room
        other_users = [s for s in user_languages 
                      if user_languages[s]['room_id'] == room_id and s != sid]
        for other_sid in other_users:
            emit('user_left', {'sid': sid}, room=other_sid)
        
        leave_room(room_id)
        del user_languages[sid]
    logger.debug(f"Session cleanup completed for {sid}")

@socketio.on('join_call')
def handle_join_call(data):
    sid = request.sid
    room_id = data.get('room_id')
    spoken_lang = data.get('spoken')
    listen_lang = data.get('listen')
    
    if not room_id or not spoken_lang or not listen_lang:
        logger.warning(f"Join attempt failed for {sid}: Missing room_id, spoken, or listen parameters")
        emit('error', {'message': 'Missing room_id, spoken, or listen parameters'})
        return
    
    if spoken_lang not in SUPPORTED_LANGUAGES or listen_lang not in SUPPORTED_LANGUAGES:
        logger.warning(f"Join attempt failed for {sid}: Unsupported language (spoken: {spoken_lang}, listen: {listen_lang})")
        emit('error', {'message': f"Unsupported language. Supported: {SUPPORTED_LANGUAGES}"})
        return
    
    # Add user to room
    if room_id not in room_occupancy:
        room_occupancy[room_id] = set()
    room_occupancy[room_id].add(sid)
    
    user_languages[sid] = {'spoken': spoken_lang, 'listen': listen_lang, 'room_id': room_id}
    join_room(room_id)
    logger.info(f"User {sid} joined call {room_id} (speaks: {spoken_lang}, listens: {listen_lang})")
    
    # Notify existing users in the room
    other_users = [s for s in user_languages 
                  if user_languages[s]['room_id'] == room_id and s != sid]
    for other_sid in other_users:
        emit('user_joined', {'sid': sid}, room=other_sid)
    
    # Load translation models
    other_sids = [s for s in user_languages if s != sid and user_languages[s]['room_id'] == room_id]
    for other_sid in other_sids:
        other_spoken = user_languages[other_sid]['spoken']
        other_listen = user_languages[other_sid]['listen']
        for src, tgt in [(spoken_lang, other_listen), (other_spoken, listen_lang)]:
            if src == tgt:  # Skip same-language pairs
                logger.debug(f"Skipping model load for same-language pair {src} to {tgt}")
                continue
            if (src, tgt) not in translation_models:
                try:
                    translator = load_translation_model(src, tgt)
                    translation_models[(src, tgt)] = translator
                except Exception as e:
                    logger.error(f"Failed to load translator for {src} to {tgt}: {str(e)}")
    
    emit('joined', {'room_id': room_id, 'sid': sid, 'room_size': len(room_occupancy[room_id])})

@socketio.on('leave_call')
def handle_leave_call():
    sid = request.sid
    if sid not in user_languages:
        logger.warning(f"Leave attempt failed for {sid}: User not in any call")
        emit('error', {'message': 'User not in any call'}, room=sid)
        return
    
    room_id = user_languages[sid]['room_id']
    
    # Remove user from room
    if room_id in room_occupancy and sid in room_occupancy[room_id]:
        room_occupancy[room_id].discard(sid)
        if not room_occupancy[room_id]:  # If room is empty, clean up
            del room_occupancy[room_id]
            logger.debug(f"Room {room_id} is now empty and removed")
    
    # Notify other users in the room
    other_users = [s for s in user_languages 
                  if user_languages[s]['room_id'] == room_id and s != sid]
    for other_sid in other_users:
        emit('user_left', {'sid': sid}, room=other_sid)
    
    leave_room(room_id)
    del user_languages[sid]
    emit('left', {'room_id': room_id}, room=sid)
    logger.info(f"User {sid} left call {room_id}")

@socketio.on('audio_chunk')
def handle_audio(data):
    sid = request.sid
    if 'content' not in data:
        logger.warning(f"Audio chunk processing failed for {sid}: Missing audio chunk")
        emit('error', {'message': 'Missing audio chunk'}, room=sid)
        return
    
    try:
        audio_bytes = base64.b64decode(data['content'])
        if not audio_bytes:
            logger.warning(f"Audio chunk processing failed for {sid}: Empty audio data")
            emit('error', {'message': 'Empty audio data'}, room=sid)
            return
        logger.debug(f"Audio received for {sid}: {len(audio_bytes)} bytes")
    except Exception as e:
        logger.error(f"Audio chunk processing failed for {sid}: Invalid audio format: {str(e)}")
        emit('error', {'message': f"Invalid audio format: {str(e)}"}, room=sid)
        return
    
    if sid not in user_languages:
        logger.warning(f"Audio chunk processing failed for {sid}: User not registered")
        emit('error', {'message': 'User not registered. Please join a call first.'}, room=sid)
        return
    
    sender_lang = user_languages[sid]['spoken']
    room_id = user_languages[sid]['room_id']
    
    # Transcribe audio
    logger.debug(f"Transcribing audio for {sid} in {sender_lang}...")
    try:
        text = transcribe_chunk(audio_bytes, language=sender_lang, temp_dir=TEMP_DIR)
        if not text:
            logger.warning(f"No text transcribed for audio from {sid}")
            emit('error', {'message': 'No text transcribed from audio'}, room=sid)
            return
        logger.debug(f"Transcription result for {sid}: {text}")
    except Exception as e:
        logger.error(f"Transcription error for {sid}: {str(e)}")
        emit('error', {'message': f"Transcription error: {str(e)}"}, room=sid)
        return
    
    # Find all other users in the call
    other_sids = [s for s in user_languages if s != sid and user_languages[s]['room_id'] == room_id]
    if not other_sids:
        logger.warning(f"No other users found in call {room_id} for {sid}")
        emit('error', {'message': 'No other users in the call'}, room=sid)
        return
    
    # Translate and send to all other users
    for target_sid in other_sids:
        target_lang = user_languages[target_sid]['listen']
        logger.debug(f"Processing translation for {target_sid} (from {sender_lang} to {target_lang})")
        try:
            if sender_lang == target_lang:  # Skip translation for same-language pairs
                translated_text = text
                logger.debug(f"No translation needed for {target_sid} (same language: {target_lang})")
            else:
                if (sender_lang, target_lang) not in translation_models:
                    logger.debug(f"Loading translation model for {sender_lang} to {target_lang}")
                    translator = load_translation_model(sender_lang, target_lang)
                    translation_models[(sender_lang, target_lang)] = translator
                translator = translation_models[(sender_lang, target_lang)]
                
                logger.debug(f"Translating from {sender_lang} to {target_lang} for {target_sid}...")
                translated_text = translate_text(text, translator, sender_lang, target_lang)
            
            logger.debug(f"Translation result for {target_sid}: {translated_text}")
            
            logger.debug(f"Generating TTS for {translated_text} in {target_lang}")
            try:
                audio_b64 = speak_text(translated_text, lang=target_lang)
                logger.debug(f"TTS generated for {target_sid}")
            except Exception as e:
                logger.error(f"TTS generation failed for {target_sid}: {str(e)}")
                emit('error', {'message': f"TTS generation error: {str(e)}"}, room=target_sid)
                continue
            
            logger.debug(f"Emitting translated_audio to {target_sid}")
            emit('translated_audio', {
                'content': audio_b64,
                'from_sid': sid,
                'to_lang': target_lang
            }, room=target_sid)
        except Exception as e:
            logger.error(f"Translation error for {sid} to {target_sid}: {str(e)}")
            emit('error', {'message': f"Translation error: {str(e)}"}, room=target_sid)

@socketio.on('text_message')
def handle_text_message(data):
    sid = request.sid
    if 'message' not in data:
        logger.warning(f"Text message processing failed for {sid}: Missing text message")
        emit('error', {'message': 'Missing text message'}, room=sid)
        return
    
    text = data['message']
    if not isinstance(text, str) or not text.strip():
        logger.warning(f"Text message processing failed for {sid}: Invalid or empty text message")
        emit('error', {'message': 'Invalid or empty text message'}, room=sid)
        return
    
    if sid not in user_languages:
        logger.warning(f"Text message processing failed for {sid}: User not registered")
        emit('error', {'message': 'User not registered. Please join a call first.'}, room=sid)
        return
    
    sender_lang = user_languages[sid]['spoken']
    room_id = user_languages[sid]['room_id']
    
    logger.debug(f"Received text message from {sid}: {text}")
    
    # Find all other users in the call
    other_sids = [s for s in user_languages if s != sid and user_languages[s]['room_id'] == room_id]
    if not other_sids:
        logger.warning(f"No other users found in call {room_id} for {sid}")
        emit('error', {'message': 'No other users in the call'}, room=sid)
        return
    
    # Translate and send to all other users
    for target_sid in other_sids:
        target_lang = user_languages[target_sid]['listen']
        logger.debug(f"Processing text translation for {target_sid} (from {sender_lang} to {target_lang})")
        try:
            if sender_lang == target_lang:  # Skip translation for same-language pairs
                translated_text = text
                logger.debug(f"No translation needed for {target_sid} (same language: {target_lang})")
            else:
                if (sender_lang, target_lang) not in translation_models:
                    logger.debug(f"Loading translation model for {sender_lang} to {target_lang}")
                    translator = load_translation_model(sender_lang, target_lang)
                    translation_models[(sender_lang, target_lang)] = translator
                translator = translation_models[(sender_lang, target_lang)]
                
                logger.debug(f"Translating text from {sender_lang} to {target_lang} for {target_sid}...")
                translated_text = translate_text(text, translator, sender_lang, target_lang)
            
            logger.debug(f"Text translation result for {target_sid}: {translated_text}")
            
            logger.debug(f"Emitting translated_text to {target_sid}")
            emit('translated_text', {
                'translated_text': translated_text,
                'from_sid': sid,
                'to_lang': target_lang
            }, room=target_sid)
        except Exception as e:
            logger.error(f"Text translation error for {sid} to {target_sid}: {str(e)}")
            emit('error', {'message': f"Text translation error: {str(e)}"}, room=target_sid)

@app.route('/translate_audio_file', methods=['POST'])
def translate_audio_file():
    # Check for required parameters
    if 'audio' not in request.files or 'spoken' not in request.form or 'listen' not in request.form:
        logger.warning("Audio file translation failed: Missing audio file or language parameters")
        return jsonify({"error": "Missing audio file or language parameters"}), 400

    spoken_lang = request.form['spoken']
    listen_lang = request.form['listen']
    audio_file = request.files['audio']

    # Validate languages
    if spoken_lang not in SUPPORTED_LANGUAGES or listen_lang not in SUPPORTED_LANGUAGES:
        logger.warning(f"Audio file translation failed: Unsupported language (spoken: {spoken_lang}, listen: {listen_lang})")
        return jsonify({"error": f"Unsupported language. Supported: {SUPPORTED_LANGUAGES}"}), 400

    # Get file extension for better format detection
    filename = audio_file.filename
    extension = os.path.splitext(filename)[1] if filename else '.tmp'
    audio_bytes = audio_file.read()

    try:
        # Transcribe the audio
        logger.debug(f"Transcribing audio file in {spoken_lang}...")
        text = transcribe_chunk(audio_bytes, language=spoken_lang, temp_dir=TEMP_DIR, extension=extension)
        if not text:
            logger.warning("Audio file translation failed: Could not transcribe audio")
            return jsonify({"error": "Could not transcribe audio"}), 500
        logger.debug(f"Transcription result: {text}")

        # Translate if languages differ
        if spoken_lang == listen_lang:
            translated_text = text
            logger.debug(f"No translation needed (same language: {listen_lang})")
        else:
            if (spoken_lang, listen_lang) not in translation_models:
                translator = load_translation_model(spoken_lang, listen_lang)
                translation_models[(spoken_lang, listen_lang)] = translator
            translator = translation_models[(spoken_lang, listen_lang)]
            logger.debug(f"Translating from {spoken_lang} to {listen_lang}...")
            translated_text = translate_text(text, translator, spoken_lang, listen_lang)
            logger.debug(f"Translation result: {translated_text}")

        # Generate translated audio in base64
        translated_audio_b64 = speak_text(translated_text, lang=listen_lang)
        if not translated_audio_b64:
            logger.error("Failed to generate translated audio")
            return jsonify({"error": "Failed to generate translated audio"}), 500

        return jsonify({
            "translated_text": translated_text,
            "translated_audio": translated_audio_b64
        })

    except Exception as e:
        logger.error(f"Audio file translation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

    
if __name__ == '__main__':
    print("Starting Flask-SocketIO server on http://172.16.11.159:5000")
    socketio.run(app, host='172.16.11.159', port=5000, debug=True, use_reloader=False)