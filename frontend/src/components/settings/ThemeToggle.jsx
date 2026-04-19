import { Sun, Moon } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'

export default function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useSettings()

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">Dark Mode</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Toggle between light and dark theme
        </p>
      </div>
      <button
        onClick={toggleDarkMode}
        className={`relative w-14 h-7 rounded-full transition-colors ${
          darkMode ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform flex items-center justify-center ${
            darkMode ? 'translate-x-7' : 'translate-x-0.5'
          }`}
        >
          {darkMode ? (
            <Moon className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-yellow-500" />
          )}
        </div>
      </button>
    </div>
  )
}
