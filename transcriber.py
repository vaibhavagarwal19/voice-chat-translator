import whisper
import tempfile
import soundfile as sf
import io
import logging
import numpy as np
import os
import time
import traceback
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Whisper model
try:
    model = whisper.load_model("base")
    logger.info("Whisper model 'base' loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise

def transcribe_chunk(audio_bytes, language="en", retries=3, temp_dir=None):
    """
    Transcribe audio bytes using Whisper model.
    
    Args:
        audio_bytes: Raw audio bytes (expected in WAV format)
        language: Language code for transcription (default: 'en')
        retries: Number of retries for file operations
        temp_dir: Custom temporary directory (optional)
    
    Returns:
        Transcribed text or None if transcription fails
    """
    try:
        SUPPORTED_WHISPER_LANGUAGES = {'en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ar', 'nl', 'hi'}
        if language not in SUPPORTED_WHISPER_LANGUAGES:
            logger.error(f"Unsupported Whisper language: {language}")
            return None

        # Validate audio bytes
        if not audio_bytes or len(audio_bytes) < 44:  # Minimum WAV header size
            logger.error("Invalid audio bytes: Empty or too small")
            return None

        # Read audio bytes to ensure WAV format
        with io.BytesIO(audio_bytes) as audio_io:
            try:
                audio_data, sample_rate = sf.read(audio_io)
                logger.info(f"Audio read successfully: sample_rate={sample_rate}, shape={audio_data.shape}")
            except Exception as e:
                logger.error(f"Failed to read audio with soundfile: {e}")
                return None

        # Convert stereo to mono if necessary
        if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
            audio_data = np.mean(audio_data, axis=1)  # Average channels for mono
            logger.info("Converted stereo audio to mono")

        # Ensure audio is in correct format
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)
            logger.info("Converted audio to float32")

        # Validate audio data
        if audio_data.size == 0:
            logger.error("Audio data is empty after processing")
            return None

        # Use custom temp directory or default
        temp_dir = temp_dir or tempfile.gettempdir()
        logger.info(f"Using temporary directory: {temp_dir}")
        if not os.path.exists(temp_dir):
            try:
                os.makedirs(temp_dir)
                logger.info(f"Created temporary directory: {temp_dir}")
            except Exception as e:
                logger.error(f"Failed to create temporary directory {temp_dir}: {e}")
                return None

        # Verify write permissions
        try:
            test_file = os.path.join(temp_dir, "test_permissions.txt")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            logger.info(f"Write permissions verified for {temp_dir}")
        except Exception as e:
            logger.error(f"No write permissions for {temp_dir}: {e}")
            return None

        # Check FFmpeg availability
        ffmpeg_paths = [
            "ffmpeg",  # Default PATH
            "/usr/bin/ffmpeg",  # Common Linux path
            "/usr/local/bin/ffmpeg"  # Alternative Linux path
        ]
        ffmpeg_found = False
        for ffmpeg_path in ffmpeg_paths:
            try:
                ffmpeg_check = subprocess.run([ffmpeg_path, "-version"], capture_output=True, text=True, check=True)
                logger.info(f"FFmpeg found at {ffmpeg_path}: {ffmpeg_check.stdout.splitlines()[0]}")
                ffmpeg_found = True
                break
            except (FileNotFoundError, subprocess.CalledProcessError) as e:
                logger.warning(f"FFmpeg check failed for {ffmpeg_path}: {e}")
                continue

        if not ffmpeg_found:
            logger.error("FFmpeg not found in any specified paths. Please ensure FFmpeg is installed and accessible.")
            return None

        # Write audio to a manually created file
        for attempt in range(retries):
            temp_file = os.path.join(temp_dir, f"whisper_audio_{int(time.time())}_{attempt}.wav")
            try:
                sf.write(temp_file, audio_data, sample_rate)
                logger.info(f"Audio written to file: {temp_file}")

                # Verify file exists and is accessible
                if not os.path.exists(temp_file):
                    logger.error(f"File {temp_file} does not exist after writing")
                    continue
                logger.info(f"File {temp_file} exists, size: {os.path.getsize(temp_file)} bytes")

                # Brief delay to ensure file is fully written
                time.sleep(0.1)

                # Transcribe audio
                try:
                    result = model.transcribe(temp_file, fp16=False, language=language)
                    transcribed_text = result['text'].strip()
                    if not transcribed_text:
                        logger.warning("Transcription returned empty text")
                        return None
                    logger.info(f"Transcription successful: {transcribed_text}")
                    return transcribed_text
                except Exception as e:
                    logger.error(f"Whisper transcription failed: {e}\n{traceback.format_exc()}")
                    return None
                finally:
                    # Clean up file
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                            logger.info(f"Cleaned up temporary file: {temp_file}")
                        except Exception as e:
                            logger.error(f"Failed to clean up {temp_file}: {e}")
            except Exception as e:
                logger.error(f"Attempt {attempt + 1}: Failed to write audio to {temp_file}: {e}\n{traceback.format_exc()}")
                if attempt == retries - 1:
                    # Fallback: Write to a debug file
                    debug_file = os.path.join(temp_dir, f"debug_audio_{int(time.time())}.wav")
                    try:
                        sf.write(debug_file, audio_data, sample_rate)
                        logger.info(f"Debug audio written to {debug_file}")
                    except Exception as debug_e:
                        logger.error(f"Failed to write debug audio to {debug_file}: {debug_e}\n{traceback.format_exc()}")
                    return None
                time.sleep(0.5)  # Brief delay before retry

        logger.error("All retry attempts failed")
        return None

    except Exception as e:
        logger.error(f"Unexpected error in transcribe_chunk: {e}\n{traceback.format_exc()}")
        return None