import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import socket from '../services/socket'

const SocketContext = createContext()

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [liveTranscription, setLiveTranscription] = useState(null) // interim text while speaking
  const [speakingUsers, setSpeakingUsers] = useState(new Set())
  const [isTranslating, setIsTranslating] = useState(false)

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('joined', (data) => {
      setCurrentRoom(data.room_id)
      setParticipants(data.participants || [])
      setError(null)
    })

    socket.on('user_joined', (data) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.sid === data.sid)) return prev
        return [...prev, data]
      })
    })

    socket.on('user_left', (data) => {
      setParticipants((prev) => prev.filter((p) => p.sid !== data.sid))
    })

    // Live transcription updates - shows what's being said in real time.
    // Final transcription is captured by sent_translation/translated_audio,
    // so we don't add it to messages here to avoid duplicates.
    socket.on('transcription_update', (data) => {
      if (data.is_final) {
        setLiveTranscription(null)
      } else {
        setLiveTranscription({
          text: data.text,
          from: data.from || 'other',
        })
      }
    })

    // Single shared message event - broadcast to everyone in the room.
    // Each user gets the message translated to their listening language.
    socket.on('message', (data) => {
      setLiveTranscription(null)
      setIsTranslating(false)
      setMessages((prev) => {
        // Dedupe by id (same message broadcast to multiple users)
        if (prev.some((m) => m.id === data.id)) return prev
        return [
          ...prev,
          {
            id: data.id,
            from_sid: data.from_sid,
            isSelf: data.is_self,
            originalText: data.original_text,
            originalLang: data.original_lang,
            translatedText: data.translated_text,
            translatedLang: data.translated_lang,
            audio: data.audio,
            timestamp: new Date().toISOString(),
          },
        ]
      })
    })

    // Track who is currently speaking
    socket.on('user_speaking', (data) => {
      setSpeakingUsers((prev) => {
        const next = new Set(prev)
        if (data.speaking) {
          next.add(data.sid)
        } else {
          next.delete(data.sid)
        }
        return next
      })
    })

    socket.on('error', (data) => {
      setError(data.message || 'An error occurred')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('joined')
      socket.off('user_joined')
      socket.off('user_left')
      socket.off('transcription_update')
      socket.off('message')
      socket.off('user_speaking')
      socket.off('error')
      socket.disconnect()
    }
  }, [])

  const joinCall = useCallback((roomId, spoken, listen) => {
    setMessages([])
    setError(null)
    setLiveTranscription(null)
    socket.emit('join_call', { room_id: roomId, spoken, listen })
  }, [])

  const leaveCall = useCallback(() => {
    if (currentRoom) {
      socket.emit('leave_call', { room_id: currentRoom })
      setCurrentRoom(null)
      setParticipants([])
      setMessages([])
      setLiveTranscription(null)
    }
  }, [currentRoom])

  const startStreaming = useCallback(() => {
    socket.emit('start_streaming')
  }, [])

  const stopStreaming = useCallback(() => {
    setIsTranslating(true)
    socket.emit('stop_streaming')
  }, [])

  const sendAudioChunk = useCallback((base64, chunkIndex) => {
    socket.emit('audio_chunk', { content: base64, chunk_index: chunkIndex })
  }, [])

  const sendTextMessage = useCallback((text) => {
    socket.emit('text_message', { text })
  }, [])

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        currentRoom,
        participants,
        messages,
        error,
        liveTranscription,
        speakingUsers,
        isTranslating,
        joinCall,
        leaveCall,
        startStreaming,
        stopStreaming,
        sendAudioChunk,
        sendTextMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
