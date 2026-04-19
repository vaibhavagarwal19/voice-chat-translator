import { createContext, useContext, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

const SettingsContext = createContext()

export function SettingsProvider({ children }) {
  const [darkMode, setDarkMode] = useLocalStorage('vct-dark-mode',
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [spokenLanguage, setSpokenLanguage] = useLocalStorage('vct-spoken-lang', 'en')
  const [listenLanguage, setListenLanguage] = useLocalStorage('vct-listen-lang', 'fr')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const toggleDarkMode = () => setDarkMode((prev) => !prev)

  return (
    <SettingsContext.Provider
      value={{
        darkMode,
        toggleDarkMode,
        spokenLanguage,
        setSpokenLanguage,
        listenLanguage,
        setListenLanguage,
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
