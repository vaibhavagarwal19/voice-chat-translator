import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Sparkles } from 'lucide-react'
import Card from '../ui/Card'
import Select from '../ui/Select'
import { useSettings } from '../../context/SettingsContext'
import { useSocket } from '../../context/SocketContext'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'

export default function JoinCallCard() {
  const navigate = useNavigate()
  const { language, setLanguage } = useSettings()
  const { joinCall, isConnected } = useSocket()
  const [roomId, setRoomId] = useState('')

  const handleJoin = () => {
    if (!roomId.trim()) return
    joinCall(roomId.trim(), language)
    navigate(`/call/${roomId.trim()}`)
  }

  return (
    <Card className="overflow-hidden relative">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-10 blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Join a Call</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Real-time multilingual chat
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. team-meeting"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <Select
            label="My Language"
            options={SUPPORTED_LANGUAGES}
            value={language}
            onChange={setLanguage}
          />

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              You'll speak and see all messages in <strong>{SUPPORTED_LANGUAGES[language]}</strong>.
              Others' messages auto-translate to your language.
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={!roomId.trim() || !isConnected}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            Join Call
          </button>
        </div>
      </div>
    </Card>
  )
}
