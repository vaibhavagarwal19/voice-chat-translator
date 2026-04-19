import { useEffect, useRef } from 'react'
import { Volume2, Mic, User } from 'lucide-react'
import { playBase64Audio } from '../../services/audioUtils'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'

function MessageBubble({ msg }) {
  const align = msg.isSelf ? 'items-end' : 'items-start'
  const bubbleColor = msg.isSelf
    ? 'bg-blue-500 text-white'
    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
  const subColor = msg.isSelf
    ? 'text-blue-100 border-blue-400'
    : 'text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'

  // Show original text only if it differs from the translated (i.e. translation happened)
  const showOriginal = msg.originalText && msg.originalText !== msg.translatedText

  return (
    <div className={`flex flex-col ${align} gap-1`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <User className="w-3 h-3" />
        <span>{msg.isSelf ? 'You' : `User ${msg.from_sid?.slice(0, 4) || 'other'}`}</span>
        <span>·</span>
        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${bubbleColor}`}>
        <p className="text-sm">{msg.translatedText}</p>

        {showOriginal && (
          <div className={`mt-1.5 pt-1.5 border-t ${subColor}`}>
            <p className="text-xs">
              Original ({SUPPORTED_LANGUAGES[msg.originalLang] || msg.originalLang}): {msg.originalText}
            </p>
          </div>
        )}

        {msg.audio && (
          <button
            onClick={() => playBase64Audio(msg.audio)}
            className={`mt-2 flex items-center gap-1 text-xs ${msg.isSelf ? 'text-blue-100 hover:text-white' : 'text-blue-600 dark:text-blue-400 hover:underline'}`}
          >
            <Volume2 className="w-3 h-3" /> Replay
          </button>
        )}
      </div>
    </div>
  )
}

export default function TranscriptionPanel({ messages, liveTranscription, isRecording }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveTranscription])

  if (messages.length === 0 && !liveTranscription && !isRecording) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <Mic className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Start recording or send a text message to begin</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}

      {(liveTranscription || isRecording) && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <Mic className="w-3 h-3 animate-pulse" />
            <span>You · live</span>
          </div>
          <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            {liveTranscription?.text ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                {liveTranscription.text}
                <span className="inline-flex gap-0.5 ml-1.5">
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic flex items-center gap-1.5">
                Listening
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
