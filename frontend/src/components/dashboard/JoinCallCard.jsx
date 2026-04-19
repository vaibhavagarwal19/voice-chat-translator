import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
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
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Phone className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold">Join a Call</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Room ID
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Enter room name..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <Select
          label="My Language"
          options={SUPPORTED_LANGUAGES}
          value={language}
          onChange={setLanguage}
        />

        <p className="text-xs text-gray-500 dark:text-gray-400">
          You'll speak and see all messages in this language. Other people's messages will be auto-translated for you.
        </p>

        <Button
          onClick={handleJoin}
          disabled={!roomId.trim() || !isConnected}
          className="w-full"
        >
          Join Call
        </Button>
      </div>
    </Card>
  )
}
