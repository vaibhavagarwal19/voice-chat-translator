import { Phone, MessageSquare } from 'lucide-react'
import Badge from '../ui/Badge'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'

export default function HistoryItem({ call }) {
  const startDate = new Date(call.startedAt)
  const endDate = call.endedAt ? new Date(call.endedAt) : null
  const duration = endDate
    ? Math.round((endDate - startDate) / 1000 / 60)
    : null

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="font-medium text-sm">{call.roomId}</p>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Language: {SUPPORTED_LANGUAGES[call.language] || call.language}</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {startDate.toLocaleDateString()}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {duration !== null && (
            <Badge variant="gray">{duration}m</Badge>
          )}
          <Badge variant="blue">
            <MessageSquare className="w-3 h-3 mr-1" />
            {call.messageCount}
          </Badge>
        </div>
      </div>
    </div>
  )
}
