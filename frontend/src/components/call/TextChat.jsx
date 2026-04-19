import { useState } from 'react'
import { Send } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

export default function TextChat() {
  const { sendTextMessage } = useSocket()
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    sendTextMessage(text.trim())
    setText('')
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type a message to translate..."
        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim()}
        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  )
}
