import { useEffect, useCallback, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Phone, PhoneOff, Users, X, Languages } from 'lucide-react'
import Badge from '../components/ui/Badge'
import TranscriptionPanel from '../components/call/TranscriptionPanel'
import ChatInputBar from '../components/call/ChatInputBar'
import ParticipantList from '../components/call/ParticipantList'
import Avatar from '../components/call/Avatar'
import { useSocket } from '../context/SocketContext'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVAD } from '../hooks/useVAD'
import { useCallHistory } from '../hooks/useCallHistory'
import { playBase64Audio } from '../services/audioUtils'
import { useSettings } from '../context/SettingsContext'
import { SUPPORTED_LANGUAGES } from '../constants/languages'

export default function CallPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const {
    participants,
    messages,
    liveTranscription,
    speakingUsers,
    isTranslating,
    leaveCall,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
  } = useSocket()
  const { language } = useSettings()
  const { addCall, endCall, incrementMessages } = useCallHistory()
  const [autoMode, setAutoMode] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const callIdRef = useRef(null)
  const lastMessageCountRef = useRef(0)

  // Record this call in history when entering the page
  useEffect(() => {
    if (roomId && language && !callIdRef.current) {
      callIdRef.current = addCall(roomId, language)
    }
  }, [roomId, language, addCall])

  // Increment message count as messages arrive
  useEffect(() => {
    if (callIdRef.current && messages.length > lastMessageCountRef.current) {
      const delta = messages.length - lastMessageCountRef.current
      for (let i = 0; i < delta; i++) {
        incrementMessages(callIdRef.current)
      }
      lastMessageCountRef.current = messages.length
    }
  }, [messages.length, incrementMessages])

  // Mark call as ended when leaving
  useEffect(() => {
    return () => {
      if (callIdRef.current) {
        endCall(callIdRef.current)
        callIdRef.current = null
      }
    }
  }, [endCall])

  const onChunk = useCallback((base64, chunkIndex) => {
    sendAudioChunk(base64, chunkIndex)
  }, [sendAudioChunk])

  const onSpeechStart = useCallback(() => startStreaming(), [startStreaming])
  const onSpeechEnd = useCallback((base64Wav) => {
    sendAudioChunk(base64Wav, 0)
    stopStreaming()
  }, [sendAudioChunk, stopStreaming])

  const { isRecording, startRecording, stopRecording } =
    useAudioRecorder(onChunk, startStreaming, stopStreaming)
  const vad = useVAD(onSpeechStart, onSpeechEnd)

  // Surface VAD errors as toast
  useEffect(() => {
    if (vad.error) toast.error(vad.error)
  }, [vad.error])

  // Auto-play incoming translated audio
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.audio && !last.isSelf) {
      playBase64Audio(last.audio)
    }
  }, [messages])

  const handleLeave = () => {
    if (isRecording) stopRecording()
    if (vad.isActive) vad.stop()
    leaveCall()
    navigate('/')
  }

  const toggleAutoMode = async () => {
    if (autoMode) {
      vad.stop()
      setAutoMode(false)
    } else {
      if (isRecording) stopRecording()
      await vad.start()
      setAutoMode(true)
    }
  }

  const isStreaming = isRecording || vad.isSpeaking

  return (
    <div className="fixed inset-0 top-[57px] flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Chat header */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-md">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">{roomId}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Languages className="w-3 h-3" />
              {SUPPORTED_LANGUAGES[language] || language}
              <span className="opacity-60">·</span>
              <span>{participants.length + 1} {participants.length === 0 ? 'person' : 'people'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {speakingUsers.size > 0 && (
            <Badge variant="yellow" className="hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse mr-1 inline-block" />
              Speaking
            </Badge>
          )}
          {isTranslating && (
            <Badge variant="blue" className="hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1 inline-block" />
              Translating
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="red" className="hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse mr-1 inline-block" />
              Recording
            </Badge>
          )}

          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
            title="Show participants"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            onClick={handleLeave}
            className="px-3 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto h-full">
            <TranscriptionPanel
              messages={messages}
              liveTranscription={liveTranscription}
              isRecording={isStreaming}
            />
          </div>
        </div>

        {/* Participants drawer */}
        {showParticipants && (
          <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                In Call
              </h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Self */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-3">
              <Avatar isSelf size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium">You</p>
                <p className="text-xs text-gray-500">{SUPPORTED_LANGUAGES[language] || language}</p>
              </div>
            </div>

            <ParticipantList participants={participants} speakingUsers={speakingUsers} />
          </div>
        )}
      </div>

      {/* Chat input bar at bottom */}
      <ChatInputBar
        isRecording={isRecording}
        autoMode={autoMode}
        vadLoading={vad.isLoading}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onToggleAuto={toggleAutoMode}
      />
    </div>
  )
}
