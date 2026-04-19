const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

export async function checkHealth() {
  const res = await fetch(`${BACKEND_URL}/health`)
  return res.json()
}

export async function translateAudioFile(file, spokenLang, listenLang) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('spoken_language', spokenLang)
  formData.append('listening_language', listenLang)

  const res = await fetch(`${BACKEND_URL}/translate_audio_file`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Translation failed')
  }

  return res.json()
}
