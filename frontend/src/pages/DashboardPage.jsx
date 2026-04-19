import JoinCallCard from '../components/dashboard/JoinCallCard'
import FileUploadCard from '../components/dashboard/FileUploadCard'
import ConnectionStatus from '../components/dashboard/ConnectionStatus'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Start a voice call or translate an audio file
        </p>
      </div>

      <ConnectionStatus />

      <div className="grid md:grid-cols-2 gap-6">
        <JoinCallCard />
        <FileUploadCard />
      </div>
    </div>
  )
}
