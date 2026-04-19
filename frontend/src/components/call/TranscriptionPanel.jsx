import { useEffect, useRef } from 'react'
import { Volume2, MessageCircle, Sparkles } from 'lucide-react'
import { playBase64Audio } from '../../services/audioUtils'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'
import Avatar from './Avatar'

function MessageBubble({ msg }) {
  const align = msg.isSelf ? 'flex-row-reverse' : 'flex-row'
  const bubbleColor = msg.isSelf
    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md'
    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md shadow-sm border border-gray-100 dark:border-gray-700'
  const subColor = msg.isSelf
    ? 'text-blue-100 border-blue-400/40'
    : 'text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'

  const showOriginal = msg.originalText && msg.originalText !== msg.translatedText

  return (
    <div className={`flex ${align} items-end gap-2 message-fade-in`}>
      <Avatar sid={msg.from_sid} isSelf={msg.isSelf} size="sm" />

      <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div className={`rounded-2xl px-4 py-2.5 ${bubbleColor}`}>
          <p className="text-sm leading-relaxed">{msg.translatedText}</p>

          {showOriginal && (
            <div className={`mt-2 pt-2 border-t ${subColor}`}>
              <p className="text-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span className="opacity-80">
                  {SUPPORTED_LANGUAGES[msg.originalLang] || msg.originalLang}: {msg.originalText}
                </span>
              </p>
            </div>
          )}

          {msg.audio && (
            <button
              onClick={() => playBase64Audio(msg.audio)}
              className={`mt-2 flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 transition-colors ${
                msg.isSelf
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              Replay
            </button>
          )}
        </div>

        <span className="text-[11px] text-gray-400 mt-1 px-1">
          {msg.isSelf ? 'You' : `User ${msg.from_sid?.slice(0, 4) || 'other'}`} ·{' '}
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

function LiveTranscription({ liveTranscription }) {
  return (
    <div className="flex flex-row-reverse items-end gap-2 message-fade-in">
      <Avatar sid="self" isSelf size="sm" />

      <div className="flex flex-col items-end max-w-[75%]">
        <div className="rounded-2xl rounded-br-md px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 border-2 border-dashed border-blue-300 dark:border-blue-700">
          {liveTranscription?.text ? (
            <p className="text-sm text-gray-700 dark:text-gray-200 italic">
              {liveTranscription.text}
              <span className="inline-flex gap-0.5 ml-1.5 align-middle">
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic flex items-center gap-2">
              Listening
              <span className="inline-flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </p>
          )}
        </div>
        <span className="text-[11px] text-blue-500 mt-1 px-1 font-medium">Live</span>
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
      <div className="flex flex-col items-center justify-center h-full py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mb-4 shadow-lg">
          <MessageCircle className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1">
          Start the conversation
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Type a message or click the mic to start speaking. Everyone hears you in their language.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto pr-2 h-full">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}

      {(liveTranscription || isRecording) && (
        <LiveTranscription liveTranscription={liveTranscription} />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
