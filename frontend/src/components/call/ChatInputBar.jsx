import { useState } from 'react'
import { Send, Mic, Square, Zap, ZapOff } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

export default function ChatInputBar({
  isRecording,
  autoMode,
  vadLoading,
  onStartRecording,
  onStopRecording,
  onToggleAuto,
}) {
  const { sendTextMessage } = useSocket()
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendTextMessage(trimmed)
    setText('')
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      {autoMode && (
        <div className="flex items-center justify-center gap-1.5 mb-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
          <Zap className="w-3 h-3" />
          Auto Mode is on - just speak, we'll detect it
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Auto Mode toggle */}
        <button
          onClick={onToggleAuto}
          disabled={vadLoading}
          title={autoMode ? 'Disable Auto Mode' : 'Enable Auto Mode (hands-free)'}
          className={`p-2.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            autoMode
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {vadLoading ? (
            <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : autoMode ? (
            <Zap className="w-5 h-5" />
          ) : (
            <ZapOff className="w-5 h-5" />
          )}
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="w-full px-4 py-2.5 pr-12 rounded-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm transition-all"
          />
          {text.trim() && (
            <button
              onClick={handleSend}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Voice button (manual record) - hidden when auto mode is on */}
        {!autoMode && (
          isRecording ? (
            <button
              onClick={onStopRecording}
              className="p-3 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all relative"
            >
              <Square className="w-5 h-5 fill-current" />
              <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />
            </button>
          ) : (
            <button
              onClick={onStartRecording}
              className="p-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              <Mic className="w-5 h-5" />
            </button>
          )
        )}
      </div>
    </div>
  )
}
