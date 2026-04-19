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

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('joined', (data) => {
      setCurrentRoom(data.room_id)
      setParticipants([])
      setError(null)
    })

    socket.on('user_joined', (data) => {
      setParticipants((prev) => [...prev, data])
    })

    socket.on('user_left', (data) => {
      setParticipants((prev) => prev.filter((p) => p.sid !== data.sid))
    })

    // Live transcription updates (interim and final from sender)
    socket.on('transcription_update', (data) => {
      if (data.is_final) {
        // Final transcription — clear the live text
        setLiveTranscription(null)
        // Only add to messages if there's actual text (sender sees their own transcription)
        if (data.text) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: 'transcription',
              original: data.text,
              translated: null,
              from: data.from || 'self',
              timestamp: new Date().toISOString(),
            },
          ])
        }
      } else {
        // Interim — update live transcription display
        setLiveTranscription({
          text: data.text,
          from: data.from || 'other',
        })
      }
    })

    // Translated audio (final result for listener)
    socket.on('translated_audio', (data) => {
      setLiveTranscription(null)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'audio',
          original: data.original_text,
          translated: data.translated_text,
          audio: data.audio,
          from: data.from || 'other',
          timestamp: new Date().toISOString(),
        },
      ])
    })

    socket.on('translated_text', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: 'text',
          original: data.original_text,
          translated: data.translated_text,
          from: data.from || 'other',
          timestamp: new Date().toISOString(),
        },
      ])
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
      socket.off('translated_text')
      socket.off('translated_audio')
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
