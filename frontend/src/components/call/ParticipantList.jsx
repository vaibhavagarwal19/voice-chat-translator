import { Mic } from 'lucide-react'
import Avatar from './Avatar'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'

export default function ParticipantList({ participants, speakingUsers = new Set() }) {
  if (participants.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">
        Waiting for others to join...
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {participants.map((p) => {
        const isSpeaking = speakingUsers.has(p.sid)
        return (
          <div
            key={p.sid}
            className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
              isSpeaking ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="relative">
              <Avatar sid={p.sid} size="sm" />
              {isSpeaking && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                  <Mic className="w-2 h-2 text-white" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User {p.sid?.slice(0, 4)}</p>
              <p className="text-xs text-gray-500">
                {SUPPORTED_LANGUAGES[p.language] || p.language}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
