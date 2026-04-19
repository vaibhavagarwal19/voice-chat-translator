import { Mic, MicOff, PhoneOff, Zap } from 'lucide-react'
import Button from '../ui/Button'

export default function CallControls({
  isRecording,
  autoMode,
  onStartRecording,
  onStopRecording,
  onToggleAuto,
  onLeave,
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {!autoMode && (
          isRecording ? (
            <Button variant="danger" onClick={onStopRecording} className="flex items-center gap-2">
              <MicOff className="w-5 h-5" />
              Stop Recording
            </Button>
          ) : (
            <Button variant="success" onClick={onStartRecording} className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Start Recording
            </Button>
          )
        )}

        <Button
          variant={autoMode ? 'primary' : 'secondary'}
          onClick={onToggleAuto}
          className="flex items-center gap-2"
        >
          <Zap className="w-5 h-5" />
          {autoMode ? 'Disable Auto Mode' : 'Enable Auto Mode'}
        </Button>

        <Button variant="danger" onClick={onLeave} className="flex items-center gap-2">
          <PhoneOff className="w-5 h-5" />
          Leave
        </Button>
      </div>

      {autoMode && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-md">
          Auto mode is on — your speech is detected and translated automatically. No need to press any button.
        </p>
      )}
    </div>
  )
}
