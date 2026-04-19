import whisper
import tempfile
import soundfile as sf
import logging
import numpy as np
import os
import time
import traceback
import subprocess
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load Whisper model
try:
    model = whisper.load_model("medium")
    logger.info("Whisper model 'medium' loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise


def _unique_name(prefix, ext):
    """Generate a unique filename to avoid collisions."""
    return f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"


def convert_to_wav(audio_bytes, temp_dir, extension='.tmp', retries=3):
    input_file = os.path.join(temp_dir, _unique_name("input_audio", extension))
    output_file = os.path.join(temp_dir, _unique_name("converted_audio", ".wav"))

    for attempt in range(retries):
        try:
            with open(input_file, "wb") as f:
                f.write(audio_bytes)
            logger.info(f"Input audio written to {input_file}")

            ffmpeg_cmd = [
                "ffmpeg", "-y", "-i", input_file,
                "-ac", "1",       # Mono
                "-ar", "16000",   # 16kHz sample rate
                "-af", "afftdn=nf=-25",  # Noise reduction
                "-f", "wav",
                output_file
            ]
            subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
            logger.info(f"FFmpeg conversion successful: {output_file}")
            return output_file
        except subprocess.CalledProcessError as e:
            logger.error(f"Attempt {attempt + 1}: FFmpeg conversion failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}: Failed to convert audio: {e}")
        finally:
            if os.path.exists(input_file):
                try:
                    os.remove(input_file)
                except Exception as e:
                    logger.error(f"Failed to clean up {input_file}: {e}")
        time.sleep(0.5)

    logger.error("All conversion attempts failed")
    return None


def transcribe_chunk(audio_bytes, language="en", retries=3, temp_dir=None, extension='.tmp'):
    """
    Transcribe audio bytes using Whisper model, supporting multiple audio formats.

    Args:
        audio_bytes: Raw audio bytes (any format, e.g., MP3, WAV, WebM)
        language: Language code for transcription (default: 'en')
        retries: Number of retries for file operations
        temp_dir: Custom temporary directory (optional)
        extension: File extension of the input audio (default: '.tmp')

    Returns:
        Transcribed text or None if transcription fails
    """
    try:
        if not audio_bytes or len(audio_bytes) < 44:
            logger.error(f"Invalid audio bytes: {len(audio_bytes) if audio_bytes else 0} bytes")
            return None

        temp_dir = temp_dir or tempfile.gettempdir()
        os.makedirs(temp_dir, exist_ok=True)

        # Verify FFmpeg is available
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            logger.error("FFmpeg not found. Please install FFmpeg.")
            return None

        # Convert audio to WAV
        wav_file = convert_to_wav(audio_bytes, temp_dir, extension, retries)
        if not wav_file or not os.path.exists(wav_file):
            logger.error("Failed to convert audio to WAV")
            return None

        # Read converted WAV file
        try:
            audio_data, sample_rate = sf.read(wav_file)
            logger.info(f"Audio read: sample_rate={sample_rate}, shape={audio_data.shape}")
        except Exception as e:
            logger.error(f"Failed to read converted WAV file: {e}")
            return None
        finally:
            if os.path.exists(wav_file):
                try:
                    os.remove(wav_file)
                except Exception:
                    pass

        # Convert stereo to mono if necessary
        if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
            audio_data = np.mean(audio_data, axis=1)

        # Ensure float32 format
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)

        if audio_data.size == 0:
            logger.error("Audio data is empty after processing")
            return None

        # Write audio to a temporary WAV file for Whisper
        temp_file = os.path.join(temp_dir, _unique_name("whisper_audio", ".wav"))
        try:
            sf.write(temp_file, audio_data, sample_rate)
            logger.info(f"Audio written for Whisper: {temp_file}")

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
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"Unexpected error in transcribe_chunk: {e}\n{traceback.format_exc()}")
        return None
