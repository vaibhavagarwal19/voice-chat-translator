import logging
import os
import subprocess
import tempfile
import time
import traceback
import uuid

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# Model size configurable via env var (tiny ~75MB, base ~140MB, small ~460MB,
# medium ~1.5GB). Use smaller models for low-RAM deployments.
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "medium")

try:
    model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    logger.info(f"Faster-Whisper model '{WHISPER_MODEL_SIZE}' (int8) loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Faster-Whisper model: {e}")
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
    """Transcribe audio bytes using Faster-Whisper. Returns text or None on failure."""
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
        segments, _info = model.transcribe(
            wav_file,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        text = " ".join(seg.text for seg in segments).strip()
        return text or None
    except Exception as e:
        logger.error(f"Faster-Whisper transcription failed: {e}\n{traceback.format_exc()}")
        return None
    finally:
        if os.path.exists(wav_file):
            try:
                os.remove(wav_file)
            except OSError:
                pass
