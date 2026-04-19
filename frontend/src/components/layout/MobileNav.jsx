import { Link, useLocation } from 'react-router-dom'
import { Home, Clock, Settings, Phone } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function MobileNav() {
  const location = useLocation()
  const { currentRoom } = useSocket()

  const allTabs = currentRoom
    ? [{ path: `/call/${currentRoom}`, icon: Phone, label: 'Call' }, ...tabs]
    : tabs

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
      <div className="flex justify-around py-2">
        {allTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = location.pathname === tab.path
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
