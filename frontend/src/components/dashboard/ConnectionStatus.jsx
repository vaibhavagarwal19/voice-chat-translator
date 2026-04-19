import { Wifi, WifiOff } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

export default function ConnectionStatus() {
  const { isConnected } = useSocket()

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
      isConnected
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    }`}>
      {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      <span className="text-sm font-medium">
        {isConnected ? 'Server connected' : 'Server disconnected'}
      </span>
    </div>
  )
}
