import { useLocalStorage } from './useLocalStorage'

export function useCallHistory() {
  const [history, setHistory] = useLocalStorage('vct-call-history', [])

  const addCall = (roomId, language) => {
    const entry = {
      id: crypto.randomUUID(),
      roomId,
      language,
      startedAt: new Date().toISOString(),
      endedAt: null,
      messageCount: 0,
    }
    setHistory((prev) => [entry, ...prev])
    return entry.id
  }

  const endCall = (callId) => {
    setHistory((prev) =>
      prev.map((c) =>
        c.id === callId ? { ...c, endedAt: new Date().toISOString() } : c
      )
    )
  }

  const incrementMessages = (callId) => {
    setHistory((prev) =>
      prev.map((c) =>
        c.id === callId ? { ...c, messageCount: c.messageCount + 1 } : c
      )
    )
  }

  const clearHistory = () => setHistory([])

  return { history, addCall, endCall, incrementMessages, clearHistory }
}
