import { Mic, MicOff, PhoneOff } from 'lucide-react'
import Button from '../ui/Button'

export default function CallControls({ isRecording, onStartRecording, onStopRecording, onLeave }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {isRecording ? (
        <Button variant="danger" onClick={onStopRecording} className="flex items-center gap-2">
          <MicOff className="w-5 h-5" />
          Stop Recording
        </Button>
      ) : (
        <Button variant="success" onClick={onStartRecording} className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Start Recording
        </Button>
      )}
      <Button variant="danger" onClick={onLeave} className="flex items-center gap-2">
        <PhoneOff className="w-5 h-5" />
        Leave
      </Button>
    </div>
  )
}
