import { useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import CallControls from '../components/call/CallControls'
import TranscriptionPanel from '../components/call/TranscriptionPanel'
import TextChat from '../components/call/TextChat'
import ParticipantList from '../components/call/ParticipantList'
import { useSocket } from '../context/SocketContext'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
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
    leaveCall,
    startStreaming,
    stopStreaming,
    sendAudioChunk,
    error,
  } = useSocket()
  const { spokenLanguage, listenLanguage } = useSettings()

  const onChunk = useCallback((base64, chunkIndex) => {
    sendAudioChunk(base64, chunkIndex)
  }, [sendAudioChunk])

  const onStart = useCallback(() => {
    startStreaming()
  }, [startStreaming])

  const onStop = useCallback(() => {
    stopStreaming()
  }, [stopStreaming])

  const { isRecording, startRecording, stopRecording } = useAudioRecorder(onChunk, onStart, onStop)

  // Auto-play incoming translated audio
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.audio) {
      playBase64Audio(last.audio)
    }
  }, [messages])

  const handleLeave = () => {
    if (isRecording) stopRecording()
    leaveCall()
    navigate('/')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Room: {roomId}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {spokenLanguage.toUpperCase()} &rarr; {listenLanguage.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {speakingUsers.size > 0 && (
            <Badge variant="yellow">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-1.5 inline-block" />
              Someone speaking
            </Badge>
          )}
          {isRecording && (
            <Badge variant="red">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1.5 inline-block" />
              Recording
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="text-lg font-semibold mb-4">Conversation</h2>
            <TranscriptionPanel
              messages={messages}
              liveTranscription={liveTranscription}
              isRecording={isRecording}
            />
          </Card>

          <Card>
            <TextChat />
          </Card>

          <CallControls
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
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
