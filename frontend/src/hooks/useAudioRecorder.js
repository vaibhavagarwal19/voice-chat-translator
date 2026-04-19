import { useState, useRef, useCallback } from 'react'
import { blobToBase64 } from '../services/audioUtils'

export function useAudioRecorder(onChunk, onStart, onStop) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunkIndexRef = useRef(0)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunkIndexRef.current = 0

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const base64 = await blobToBase64(e.data)
          onChunk?.(base64, chunkIndexRef.current)
          chunkIndexRef.current += 1
        }
      }

      // Notify backend that streaming has started
      onStart?.()

      mediaRecorder.start(2000) // Send chunks every 2 seconds
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [onChunk, onStart])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    setIsRecording(false)

    // Notify backend that streaming has stopped
    onStop?.()
  }, [onStop])

  return { isRecording, startRecording, stopRecording }
}
