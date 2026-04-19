import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SettingsProvider } from './context/SettingsContext'
import { SocketProvider } from './context/SocketContext'

// Note: StrictMode disabled because it double-mounts effects which causes
// the WebSocket connection to disconnect/reconnect with a new SID, breaking
// in-progress calls. Re-enable for production builds where this isn't an issue.
createRoot(document.getElementById('root')).render(
  <SettingsProvider>
    <SocketProvider>
      <App />
    </SocketProvider>
  </SettingsProvider>,
)
