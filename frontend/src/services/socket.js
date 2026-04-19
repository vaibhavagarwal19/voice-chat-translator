import { io } from 'socket.io-client'

// In dev, the Vite proxy forwards /socket.io → backend on 5000.
// In production, set VITE_BACKEND_URL to your backend's deployed URL.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin

const socket = io(BACKEND_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
})

export default socket
