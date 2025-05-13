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
    model = whisper.load_model("medium")
    logger.info("Whisper model 'medium' loaded successfully")
except Exception as e:
    logger.error(f"Failed to load Whisper model: {e}")
    raise

def convert_to_wav(audio_bytes, temp_dir, extension='.tmp', retries=3):
    input_file = os.path.join(temp_dir, f"input_audio_{int(time.time())}{extension}")
    output_file = os.path.join(temp_dir, f"converted_audio_{int(time.time())}.wav")

    for attempt in range(retries):
        try:
            # Write input audio with correct extension
            with open(input_file, "wb") as f:
                f.write(audio_bytes)
            logger.info(f"Input audio written to {input_file}")

            # Convert to WAV using FFmpeg
            ffmpeg_cmd = [
                "ffmpeg", "-y", "-i", input_file,
                "-ac", "1",  # Mono
                "-ar", "16000",  # 16kHz sample rate
                "-af", "afftdn=nf=-25",  # Noise reduction filter
                "-f", "wav",  # WAV format
                output_file
            ]
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
            logger.info(f"FFmpeg conversion successful: {output_file}")
            return output_file
        except subprocess.CalledProcessError as e:
            logger.error(f"Attempt {attempt + 1}: FFmpeg conversion failed: {e.stderr}")
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}: Failed to convert audio: {e}\n{traceback.format_exc()}")
        finally:
            if os.path.exists(input_file):
                try:
                    os.remove(input_file)
                    logger.info(f"Cleaned up input file: {input_file}")
                except Exception as e:
                    logger.error(f"Failed to clean up {input_file}: {e}")
        time.sleep(0.5)

    logger.error("All conversion attempts failed")
    return None

def transcribe_chunk(audio_bytes, language="en", retries=3, temp_dir=None, extension='.tmp'):
    """
    Transcribe audio bytes using Whisper model, supporting multiple audio formats.
    
    Args:
        audio_bytes: Raw audio bytes (any format, e.g., MP3, WAV, MP4)
        language: Language code for transcription (default: 'en')
        retries: Number of retries for file operations
        temp_dir: Custom temporary directory (optional)
        extension: File extension of the input audio (default: '.tmp')
    
    Returns:
        Transcribed text or None if transcription fails
    """
    try:
        # Log audio size for debugging
        logger.debug(f"Received audio bytes: {len(audio_bytes)} bytes")

        # Validate audio bytes
        if not audio_bytes:
            logger.error("Invalid audio bytes: Empty")
            return None
        if len(audio_bytes) < 44:  # Minimum WAV header size
            logger.error(f"Invalid audio bytes: Too small ({len(audio_bytes)} bytes, minimum 44 bytes)")
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

        # Explicitly add FFmpeg path to environment
        ffmpeg_bin = r"C:\ffmpeg\bin"
        os.environ["PATH"] = f"{ffmpeg_bin}{os.pathsep}{os.environ.get('PATH', '')}"
        logger.info(f"Updated PATH with FFmpeg: {os.environ['PATH']}")

        # Check FFmpeg availability
        ffmpeg_paths = [
            "ffmpeg",  # Default PATH
            os.path.join(ffmpeg_bin, "ffmpeg.exe"),  # Explicit path
            os.path.join(os.path.expanduser("~"), "ffmpeg", "bin", "ffmpeg.exe")  # User-specific path
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

        # Convert audio to WAV
        wav_file = convert_to_wav(audio_bytes, temp_dir, extension, retries)
        if not wav_file or not os.path.exists(wav_file):
            logger.error("Failed to convert audio to WAV")
            return None

        # Read converted WAV file
        try:
            audio_data, sample_rate = sf.read(wav_file)
            logger.info(f"Audio read successfully: sample_rate={sample_rate}, shape={audio_data.shape}")
        except Exception as e:
            logger.error(f"Failed to read converted WAV file: {e}")
            return None
        finally:
            # Clean up WAV file
            if os.path.exists(wav_file):
                try:
                    os.remove(wav_file)
                    logger.info(f"Cleaned up WAV file: {wav_file}")
                except Exception as e:
                    logger.error(f"Failed to clean up {wav_file}: {e}")

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

        # Write audio to a temporary WAV file for Whisper
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
                    logger.info(f"Calling Whisper transcribe on file: {temp_file}")
                    logger.info(f"Audio dtype: {audio_data.dtype}, sample_rate: {sample_rate}, shape: {audio_data.shape}")

                    result = model.transcribe(temp_file, fp16=False, language=language)
                    logger.debug(f"Whisper result: {result}")

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