import { useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

export default function TextChat() {
  const { sendTextMessage } = useSocket()
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendTextMessage(trimmed)
    setText('')
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <MessageSquare className="w-4 h-4 text-blue-600" />
        Send a text message
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message — it'll be translated for everyone..."
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </div>
    </div>
  )
}
