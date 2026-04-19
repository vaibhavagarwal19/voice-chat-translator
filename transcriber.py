import logging
import os
import subprocess
import tempfile
import time
import traceback
import uuid

import numpy as np
import soundfile as sf
import whisper

logger = logging.getLogger(__name__)

try:
    model = whisper.load_model("medium")
    logger.info("Whisper model 'medium' loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise


def _unique_name(prefix, ext):
    return f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"


def convert_to_wav(audio_bytes, temp_dir, extension='.tmp', retries=3):
    """Convert audio bytes to mono 16kHz WAV using ffmpeg."""
    input_file = os.path.join(temp_dir, _unique_name("input", extension))
    output_file = os.path.join(temp_dir, _unique_name("converted", ".wav"))

    for attempt in range(retries):
        try:
            with open(input_file, "wb") as f:
                f.write(audio_bytes)

            subprocess.run([
                "ffmpeg", "-y", "-i", input_file,
                "-ac", "1",
                "-ar", "16000",
                "-af", "afftdn=nf=-25",
                "-f", "wav",
                output_file,
            ], capture_output=True, text=True, check=True)
            return output_file
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg attempt {attempt + 1} failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Audio conversion attempt {attempt + 1} failed: {e}")
        finally:
            if os.path.exists(input_file):
                try:
                    os.remove(input_file)
                except OSError:
                    pass
        time.sleep(0.5)

    return None


def transcribe_chunk(audio_bytes, language="en", retries=3, temp_dir=None, extension='.tmp'):
    """Transcribe audio bytes using Whisper. Returns text or None on failure."""
    if not audio_bytes or len(audio_bytes) < 44:
        logger.error("Invalid audio bytes")
        return None

    temp_dir = temp_dir or tempfile.gettempdir()
    os.makedirs(temp_dir, exist_ok=True)

    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        logger.error("FFmpeg not found. Please install FFmpeg.")
        return None

    wav_file = convert_to_wav(audio_bytes, temp_dir, extension, retries)
    if not wav_file or not os.path.exists(wav_file):
        return None

    try:
        audio_data, sample_rate = sf.read(wav_file)
    except Exception as e:
        logger.error(f"Failed to read WAV: {e}")
        return None
    finally:
        if os.path.exists(wav_file):
            try:
                os.remove(wav_file)
            except OSError:
                pass

    if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
        audio_data = np.mean(audio_data, axis=1)

    if audio_data.dtype != np.float32:
        audio_data = audio_data.astype(np.float32)

    if audio_data.size == 0:
        return None

    temp_file = os.path.join(temp_dir, _unique_name("whisper", ".wav"))
    try:
        sf.write(temp_file, audio_data, sample_rate)
        result = model.transcribe(temp_file, fp16=False, language=language)
        text = result['text'].strip()
        return text or None
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}\n{traceback.format_exc()}")
        return None
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
