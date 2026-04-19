import SettingsForm from '../components/settings/SettingsForm'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Customize your preferences
        </p>
      </div>

      <div className="max-w-2xl">
        <SettingsForm />
      </div>
    </div>
  )
}
