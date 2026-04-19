import { Users, Mic } from 'lucide-react'
import Badge from '../ui/Badge'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'

export default function ParticipantList({ participants, speakingUsers = new Set() }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Participants ({participants.length})
        </span>
      </div>
      {participants.length === 0 ? (
        <p className="text-xs text-gray-400">Waiting for others to join...</p>
      ) : (
        <div className="space-y-2">
          {participants.map((p, i) => {
            const isSpeaking = speakingUsers.has(p.sid)
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-gray-700 dark:text-gray-300">User {i + 1}</span>
                {isSpeaking && <Mic className="w-3 h-3 text-yellow-500 animate-pulse" />}
                <Badge variant="blue">{SUPPORTED_LANGUAGES[p.spoken] || p.spoken}</Badge>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
