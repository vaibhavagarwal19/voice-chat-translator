import { useEffect, useCallback, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, Zap } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import CallControls from '../components/call/CallControls'
import TranscriptionPanel from '../components/call/TranscriptionPanel'
import TextChat from '../components/call/TextChat'
import ParticipantList from '../components/call/ParticipantList'
import { useSocket } from '../context/SocketContext'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVAD } from '../hooks/useVAD'
import { playBase64Audio } from '../services/audioUtils'
import { useSettings } from '../context/SettingsContext'

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
    error,
  } = useSocket()
  const { language } = useSettings()
  const [autoMode, setAutoMode] = useState(false)

  // ---- Manual mode (button-driven recording) ----
  const onChunk = useCallback((base64, chunkIndex) => {
    sendAudioChunk(base64, chunkIndex)
  }, [sendAudioChunk])

  const { isRecording, startRecording, stopRecording } =
    useAudioRecorder(onChunk, startStreaming, stopStreaming)

  // ---- Auto mode (VAD-driven, hands-free) ----
  const onSpeechStart = useCallback(() => {
    startStreaming()
  }, [startStreaming])

  const onSpeechEnd = useCallback((base64Wav) => {
    // Send the entire utterance as one chunk, then trigger backend processing
    sendAudioChunk(base64Wav, 0)
    stopStreaming()
  }, [sendAudioChunk, stopStreaming])

  const vad = useVAD(onSpeechStart, onSpeechEnd)

  // Auto-play incoming translated audio
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.audio) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Room: {roomId}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your language: {language.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {autoMode && (
            <Badge variant="blue">
              <Zap className="w-3 h-3 mr-1" /> Auto VAD
            </Badge>
          )}
          {speakingUsers.size > 0 && (
            <Badge variant="yellow">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-1.5 inline-block" />
              Someone speaking
            </Badge>
          )}
          {isTranslating && (
            <Badge variant="blue">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1.5 inline-block" />
              Translating...
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="red">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1.5 inline-block" />
              {vad.isSpeaking ? 'Capturing' : 'Recording'}
            </Badge>
          )}
        </div>
      </div>

      {(error || vad.error) && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
          {error || vad.error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Conversation</h2>
            <TranscriptionPanel
              messages={messages}
              liveTranscription={liveTranscription}
              isRecording={isStreaming}
            />
          </Card>

          <Card>
            <TextChat />
          </Card>

          <CallControls
            isRecording={isRecording}
            autoMode={autoMode}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onToggleAuto={toggleAutoMode}
            onLeave={handleLeave}
          />
        </div>

        <div>
          <Card>
            <ParticipantList
              participants={participants}
              speakingUsers={speakingUsers}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
