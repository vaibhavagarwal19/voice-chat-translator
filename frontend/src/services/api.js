export async function checkHealth() {
  const res = await fetch('/health')
  return res.json()
}

export async function translateAudioFile(file, spokenLang, listenLang) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('spoken_language', spokenLang)
  formData.append('listening_language', listenLang)

  const res = await fetch('/translate_audio_file', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Translation failed')
  }

  return res.json()
}
