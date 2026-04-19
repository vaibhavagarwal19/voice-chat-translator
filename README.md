# Voice Chat Translator

A real-time multilingual voice & text chat platform. Each user picks **one** language — they speak in it, and see/hear everything in it. Other users' messages are auto-transcribed, translated, and synthesized into your language as you chat.

**Stack**: Python (Flask-SocketIO) · React (Vite + Tailwind + Sonner) · Faster-Whisper · deep-translator · gTTS · Silero VAD

---

## Features

- 🗣️ **Real-time voice translation** — speak in your language, others hear it in theirs
- 💬 **Text chat** — typed messages also auto-translate + generate TTS audio
- 🌍 **13 languages** — English, French, Spanish, German, Italian, Portuguese, Russian, Chinese, Arabic, Dutch, Hindi, Urdu, Bengali
- ⚡ **Hands-free Auto Mode** — Silero VAD auto-detects when you start/stop speaking
- 📡 **Live transcription** — see your words appear as you speak
- 🎵 **Audio file translation** — upload an audio file, get translated text + audio
- 👥 **Multi-user rooms** — join a room ID, chat with anyone else in the same room
- 🌙 **Dark mode** with persistent preference
- 📜 **Call history** stored locally
- 🚀 **LRU translation cache** for repeated phrases
- 📦 **Code-split bundles** — VAD lazy-loaded (~500KB) only when needed
- 🔔 **Toast notifications** for connection events, errors, and join/leave updates
- 💎 **Modern chat UI** — message bubbles, avatars, live typing indicators, smooth animations

---

## Architecture

```
┌─────────────┐                         ┌─────────────┐
│  React UI   │ ◄── WebSocket (SIO) ──► │   Flask     │
│  (Vite)     │ ◄──── REST  ─────────►  │  Backend    │
└─────────────┘                         └──────┬──────┘
       │                                       │
       │                                       ├──► Faster-Whisper (STT, int8)
       │                                       ├──► deep-translator (Google/MyMemory)
       │                                       ├──► gTTS (TTS)
       │                                       └──► LRU translation cache
       │
       └──► Silero VAD (browser, lazy-loaded)
```

### How a voice message flows

1. Browser captures audio chunks every 2s via MediaRecorder (or VAD detects an utterance)
2. Chunks are base64-encoded and streamed over WebSocket to the backend
3. Backend buffers per-user audio, runs interim transcription every chunk for live captions
4. On `stop_streaming`, backend transcribes the full utterance with Faster-Whisper
5. Backend fans out **one customized message per user** in the room, each with:
   - Text translated to that user's preferred language
   - TTS-generated audio in that user's language
6. Each user's frontend receives their localized version and plays the audio

---

## Setup

### Prerequisites

- Python 3.9+
- Node.js 22+
- FFmpeg installed (`brew install ffmpeg` on macOS)

### Backend

```bash
# Create virtualenv and install deps
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the Flask-SocketIO server
python app.py
```

The first run downloads the Faster-Whisper model (~1.5GB) — subsequent starts are fast.

Server runs on **http://localhost:5000**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on **http://localhost:5173**

Vite proxies `/socket.io`, `/health`, and `/translate_audio_file` to the backend on port 5000.

---

## Usage

1. Open http://localhost:5173/
2. Pick **My Language** (the one you want to speak and read in)
3. Enter a **Room ID** (e.g. `team-meeting`)
4. Click **Join Call**
5. Open another browser tab, pick a *different* language, join the same room
6. Either:
   - Click the mic button and start speaking, then click stop, OR
   - Toggle **Auto Mode** for hands-free voice detection
7. Both tabs see the chat in their own language

To translate a one-off audio file, use the **Translate Audio File** card on the dashboard.

---

## API Reference

### REST endpoints

- `GET /health` — health check
- `GET /cache_stats` — translation cache hit rate / size
- `POST /translate_audio_file` — multipart upload `audio` + form fields `spoken_language`, `listening_language`. Returns `{ original_text, translated_text, translated_audio (base64 mp3) }`

### WebSocket events

| Direction | Event | Payload |
|---|---|---|
| → | `join_call` | `{ room_id, language }` |
| → | `leave_call` | — |
| → | `start_streaming` | — |
| → | `audio_chunk` | `{ content (base64), chunk_index }` |
| → | `stop_streaming` | — |
| → | `text_message` | `{ text }` |
| ← | `joined` | `{ room_id, sid, language, room_size, participants[] }` |
| ← | `user_joined` / `user_left` | `{ sid, language }` |
| ← | `user_speaking` | `{ sid, speaking }` |
| ← | `transcription_update` | `{ text, is_final, from }` (live captions) |
| ← | `message` | `{ id, from_sid, is_self, original_text, original_lang, translated_text, translated_lang, audio }` |
| ← | `error` | `{ message }` |

---

## Project Structure

```
voice-chat-translator/
├── app.py                 # Flask + SocketIO server, WebSocket handlers
├── transcriber.py         # Faster-Whisper STT pipeline + ffmpeg conversion
├── translator.py          # deep-translator wrapper + LRU cache
├── tts.py                 # gTTS text-to-speech
├── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── pages/         # DashboardPage, CallPage, HistoryPage, SettingsPage
    │   ├── components/
    │   │   ├── layout/    # AppShell, Navbar, MobileNav
    │   │   ├── dashboard/ # JoinCallCard, FileUploadCard
    │   │   ├── call/      # TranscriptionPanel, ChatInputBar, Avatar, ParticipantList
    │   │   ├── history/   # HistoryList, HistoryItem
    │   │   ├── settings/  # SettingsForm, ThemeToggle
    │   │   └── ui/        # Button, Card, Select, Badge
    │   ├── context/       # SocketContext, SettingsContext
    │   ├── hooks/         # useAudioRecorder, useVAD, useCallHistory, useLocalStorage
    │   ├── services/      # socket, api, audioUtils
    │   └── constants/     # languages, routes
    └── vite.config.js
```

---

## Performance Notes

- **Faster-Whisper (int8 quantized)** delivers ~5× speedup over baseline OpenAI Whisper at comparable accuracy
- **LRU translation cache** (1000 entries) skips redundant translation calls — common phrases return in <1ms
- **Code splitting** keeps the main bundle at ~316KB (gzip ~98KB); VAD module lazy-loads when Auto Mode is enabled
- **Translation models pre-loaded on join** for known room language pairs to avoid first-request latency

End-to-end voice → translated audio latency is typically **2-3 seconds** (transcription + translation + TTS), with **interim captions every ~2 seconds** during speech for a real-time feel.

---

## Deployment (Render)

This project includes a [`render.yaml`](render.yaml) Blueprint for one-click deployment to Render.

### Steps

1. **Push your code to GitHub** (Render needs a GitHub/GitLab repo).

2. **Sign up at [render.com](https://render.com)** and click **New → Blueprint**.

3. **Connect this repo**. Render will detect the `render.yaml` and create:
   - A Python web service (the Flask-SocketIO backend)
   - A static site (the React frontend)

4. **Wait for the backend to deploy** (~5-10 min on first build — installs ffmpeg + Python deps + downloads Whisper model).

5. **Note the backend URL** Render assigns you, e.g. `https://voice-translator-backend.onrender.com`.

6. **Set `VITE_BACKEND_URL`** in the frontend service's environment variables to that URL, then trigger a redeploy.

7. **Open your frontend URL** — done!

### Memory considerations

Render's free/starter tier gives you **512MB RAM**, which only fits the smaller Whisper models. The Blueprint defaults to `WHISPER_MODEL_SIZE=tiny` (75MB, fast but lower accuracy).

| Plan | RAM | Recommended Whisper Model |
|---|---|---|
| Free / Starter | 512MB | `tiny` (75MB) |
| Standard | 2GB | `base` (140MB) or `small` (460MB) |
| Pro | 4GB+ | `medium` (1.5GB) |

Change `WHISPER_MODEL_SIZE` in your service's environment variables to upgrade.

### Cold starts

Render's free tier spins down after 15 min of inactivity. The first request after spin-down takes ~30-60s while the model reloads. To avoid this, use a paid plan or ping `/health` periodically.

### CORS

After deploying, **tighten `ALLOWED_ORIGINS`** in the backend env vars from `*` to just your frontend URL:
```
ALLOWED_ORIGINS=https://voice-translator-frontend.onrender.com
```

### Environment variables reference

**Backend:**
- `WHISPER_MODEL_SIZE` — `tiny` / `base` / `small` / `medium`
- `ALLOWED_ORIGINS` — comma-separated list of allowed frontend origins, or `*`
- `PORT` — auto-set by Render
- `KMP_DUPLICATE_LIB_OK` — `TRUE` (required for OpenMP compatibility)
- `FLASK_ENV` — `production`

**Frontend:**
- `VITE_BACKEND_URL` — your deployed backend URL

---

## Future Improvements

- WebRTC for sub-second audio transport (replaces base64 over WebSocket)
- AI-powered meeting summaries via local LLM (Ollama + Llama 3) at end of call
- Auto language detection (Whisper supports detection out of the box)
- User accounts + persistent server-side history (PostgreSQL)
- Voice cloning TTS (Coqui XTTS-v2)
- Speaker diarization (pyannote.audio)
- Docker + GitHub Actions CI/CD
- Test suite (pytest, Vitest)
- Live deployment (Render/Vercel) with HTTPS for cross-device testing

---

## License

MIT
