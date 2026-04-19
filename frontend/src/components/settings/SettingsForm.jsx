import Select from '../ui/Select'
import Card from '../ui/Card'
import Button from '../ui/Button'
import ThemeToggle from './ThemeToggle'
import { useSettings } from '../../context/SettingsContext'
import { useCallHistory } from '../../hooks/useCallHistory'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'
import { Settings, Trash2 } from 'lucide-react'

export default function SettingsForm() {
  const { spokenLanguage, setSpokenLanguage, listenLanguage, setListenLanguage } = useSettings()
  const { clearHistory, history } = useCallHistory()

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>
        <ThemeToggle />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Default Languages</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          These will be pre-selected when you join a call.
        </p>
        <div className="space-y-4">
          <Select
            label="Default spoken language"
            options={SUPPORTED_LANGUAGES}
            value={spokenLanguage}
            onChange={setSpokenLanguage}
          />
          <Select
            label="Default listening language"
            options={SUPPORTED_LANGUAGES}
            value={listenLanguage}
            onChange={setListenLanguage}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Call History</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {history.length} call{history.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <Button
            variant="danger"
            onClick={clearHistory}
            disabled={history.length === 0}
            className="flex items-center gap-1 text-sm"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </Button>
        </div>
      </Card>
    </div>
  )
}
