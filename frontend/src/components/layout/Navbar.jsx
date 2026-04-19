import { Link, useLocation } from 'react-router-dom'
import { Languages, Sun, Moon } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import { useSocket } from '../../context/SocketContext'
import Badge from '../ui/Badge'

const navLinks = [
  { path: '/', label: 'Dashboard' },
  { path: '/history', label: 'History' },
  { path: '/settings', label: 'Settings' },
]

export default function Navbar() {
  const { darkMode, toggleDarkMode } = useSettings()
  const { isConnected } = useSocket()
  const location = useLocation()

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
            <Languages className="w-7 h-7 text-blue-600" />
            <span className="hidden sm:inline">VoiceTranslate</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'green' : 'red'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </nav>
  )
}
