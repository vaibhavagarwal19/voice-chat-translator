import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import socket from '../services/socket'

const SocketContext = createContext()

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)

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

    socket.on('translated_audio', (data) => {
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

    socket.on('error', (data) => {
      setError(data.message || 'An error occurred')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('joined')
      socket.off('user_joined')
      socket.off('user_left')
      socket.off('translated_text')
      socket.off('translated_audio')
      socket.off('error')
      socket.disconnect()
    }
  }, [])

  const joinCall = useCallback((roomId, spoken, listen) => {
    setMessages([])
    setError(null)
    socket.emit('join_call', { room_id: roomId, spoken, listen })
  }, [])

  const leaveCall = useCallback(() => {
    if (currentRoom) {
      socket.emit('leave_call', { room_id: currentRoom })
      setCurrentRoom(null)
      setParticipants([])
      setMessages([])
    }
  }, [currentRoom])

  const sendAudioChunk = useCallback((base64) => {
    socket.emit('audio_chunk', { content: base64 })
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
        joinCall,
        leaveCall,
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
