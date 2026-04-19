import { useEffect, useRef, useState, useCallback } from 'react'
import { MicVAD } from '@ricky0123/vad-web'
import { float32ToWavBlob, blobToBase64 } from '../services/audioUtils'

/**
 * Hook for Silero VAD (Voice Activity Detection).
 * Auto-detects speech start/end and provides the captured WAV audio as base64.
 *
 * @param onSpeechStart - called when user starts speaking
 * @param onSpeechEnd - called when user stops, receives base64-encoded WAV
 */
export function useVAD(onSpeechStart, onSpeechEnd) {
  const [isActive, setIsActive] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState(null)
  const vadRef = useRef(null)

  // Stable refs so the VAD instance always sees the latest callbacks
  const onStartRef = useRef(onSpeechStart)
  const onEndRef = useRef(onSpeechEnd)
  useEffect(() => { onStartRef.current = onSpeechStart }, [onSpeechStart])
  useEffect(() => { onEndRef.current = onSpeechEnd }, [onSpeechEnd])

  const start = useCallback(async () => {
    if (vadRef.current) return
    setError(null)

    try {
      const vad = await MicVAD.new({
        onSpeechStart: () => {
          setIsSpeaking(true)
          onStartRef.current?.()
        },
        onSpeechEnd: async (audio) => {
          setIsSpeaking(false)
          try {
            const wavBlob = float32ToWavBlob(audio, 16000)
            const base64 = await blobToBase64(wavBlob)
            onEndRef.current?.(base64)
          } catch (err) {
            console.error('Failed to encode VAD audio:', err)
          }
        },
        onVADMisfire: () => setIsSpeaking(false),
      })

      vad.start()
      vadRef.current = vad
      setIsActive(true)
    } catch (err) {
      console.error('Failed to start VAD:', err)
      setError(err.message || 'Failed to start voice detection')
    }
  }, [])

  const stop = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.destroy()
      vadRef.current = null
    }
    setIsActive(false)
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop])

  return { isActive, isSpeaking, error, start, stop }
}
