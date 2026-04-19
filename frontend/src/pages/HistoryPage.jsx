import HistoryList from '../components/history/HistoryList'

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Call History</h1>
        <p className="text-gray-500 dark:text-gray-400">
          View your past translation calls
        </p>
      </div>

      <div className="max-w-2xl">
        <HistoryList />
      </div>
    </div>
  )
}
