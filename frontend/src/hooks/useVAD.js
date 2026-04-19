import { useEffect, useRef, useState, useCallback } from 'react'
import { float32ToWavBlob, blobToBase64 } from '../services/audioUtils'

/**
 * Hook for Silero VAD (Voice Activity Detection).
 * The @ricky0123/vad-web + onnxruntime-web bundle is ~500KB, so it's
 * dynamically imported only when the user actually enables Auto Mode.
 */
export function useVAD(onSpeechStart, onSpeechEnd) {
  const [isActive, setIsActive] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const vadRef = useRef(null)

  const onStartRef = useRef(onSpeechStart)
  const onEndRef = useRef(onSpeechEnd)
  useEffect(() => { onStartRef.current = onSpeechStart }, [onSpeechStart])
  useEffect(() => { onEndRef.current = onSpeechEnd }, [onSpeechEnd])

  const start = useCallback(async () => {
    if (vadRef.current) return
    setError(null)
    setIsLoading(true)

    try {
      // Lazy-load the heavy VAD module (saves ~500KB from main bundle)
      const { MicVAD } = await import('@ricky0123/vad-web')

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
    } finally {
      setIsLoading(false)
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

  useEffect(() => () => stop(), [stop])

  return { isActive, isSpeaking, isLoading, error, start, stop }
}
