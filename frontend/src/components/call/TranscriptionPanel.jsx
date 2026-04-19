import { useEffect, useRef } from 'react'
import { Volume2, Mic } from 'lucide-react'
import { playBase64Audio } from '../../services/audioUtils'

export default function TranscriptionPanel({ messages, liveTranscription, isRecording }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveTranscription])

  if (messages.length === 0 && !liveTranscription && !isRecording) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <p>Messages will appear here during the call...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2"
        >
          {msg.original && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">Original:</span> {msg.original}
            </p>
          )}
          {msg.translated && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Translated:</span>{' '}
              {msg.translated}
            </p>
          )}
          {msg.audio && (
            <button
              onClick={() => playBase64Audio(msg.audio)}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Volume2 className="w-3 h-3" /> Play audio
            </button>
          )}
          <p className="text-xs text-gray-400">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </p>
        </div>
      ))}

      {/* Live transcription indicator */}
      {(liveTranscription || isRecording) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              Live transcription
            </span>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
          {liveTranscription?.text ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">
              {liveTranscription.text}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">Listening...</p>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
