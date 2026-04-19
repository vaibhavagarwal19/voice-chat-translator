import { Clock, Trash2 } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import HistoryItem from './HistoryItem'
import { useCallHistory } from '../../hooks/useCallHistory'

export default function HistoryList() {
  const { history, clearHistory } = useCallHistory()

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Call History</h2>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" onClick={clearHistory} className="flex items-center gap-1 text-sm">
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-center py-8 text-gray-400 dark:text-gray-500">
          No call history yet. Join a call to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((call) => (
            <HistoryItem key={call.id} call={call} />
          ))}
        </div>
      )}
    </Card>
  )
}
