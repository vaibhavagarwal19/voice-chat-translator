import { createContext, useContext, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const SettingsContext = createContext()

export function SettingsProvider({ children }) {
  const [darkMode, setDarkMode] = useLocalStorage('vct-dark-mode',
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  // Single language per user - they speak in it AND see/hear everything in it
  const [language, setLanguage] = useLocalStorage('vct-language', 'en')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode((prev) => !prev)

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        language,
        setLanguage,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
