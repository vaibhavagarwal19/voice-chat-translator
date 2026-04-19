import { useState, useRef } from 'react'
import { Upload, Volume2 } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { useSettings } from '../../context/SettingsContext'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'
import { translateAudioFile } from '../../services/api'
import { playBase64Audio } from '../../services/audioUtils'

export default function FileUploadCard() {
  const { spokenLanguage, listenLanguage } = useSettings()
  const [srcLang, setSrcLang] = useState(spokenLanguage)
  const [tgtLang, setTgtLang] = useState(listenLanguage)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const handleTranslate = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await translateAudioFile(file, srcLang, tgtLang)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Upload className="w-5 h-5 text-purple-600" />
        <h2 className="text-lg font-semibold">Translate Audio File</h2>
      </div>

      <div className="space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        >
          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {file ? file.name : 'Click to upload audio file'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="From" options={SUPPORTED_LANGUAGES} value={srcLang} onChange={setSrcLang} />
          <Select label="To" options={SUPPORTED_LANGUAGES} value={tgtLang} onChange={setTgtLang} />
        </div>

        <Button
          onClick={handleTranslate}
          disabled={!file || loading}
          className="w-full"
          variant="primary"
        >
          {loading ? 'Translating...' : 'Translate'}
        </Button>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {result && (
          <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm">
              <span className="font-medium">Translated:</span> {result.translated_text}
            </p>
            {result.translated_audio && (
              <Button
                variant="ghost"
                onClick={() => playBase64Audio(result.translated_audio)}
                className="flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4" /> Play Audio
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
