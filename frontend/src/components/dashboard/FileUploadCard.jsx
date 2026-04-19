import { useState, useRef } from 'react'
import { Upload, Volume2, FileAudio, ArrowRight, Sparkles, X } from 'lucide-react'
import Card from '../ui/Card'
import Select from '../ui/Select'
import { useSettings } from '../../context/SettingsContext'
import { SUPPORTED_LANGUAGES } from '../../constants/languages'
import { translateAudioFile } from '../../services/api'
import { playBase64Audio } from '../../services/audioUtils'

export default function FileUploadCard() {
  const { language } = useSettings()
  const [srcLang, setSrcLang] = useState(language)
  const [tgtLang, setTgtLang] = useState(language === 'en' ? 'fr' : 'en')
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
      // Auto-play the translated audio
      if (data.translated_audio) {
        setTimeout(() => playBase64Audio(data.translated_audio), 200)
      }
    } catch (err) {
      setError(err.message || 'Translation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <Card className="overflow-hidden relative">
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full opacity-10 blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <FileAudio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Translate Audio File</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload audio to transcribe + translate
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              file
                ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 bg-gray-50 dark:bg-gray-700/30'
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-purple-500' : 'text-gray-400'}`} />
            {file ? (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB · click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Click to upload audio
                </p>
                <p className="text-xs text-gray-500 mt-0.5">MP3, WAV, M4A, WebM</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files[0] || null)
                setResult(null)
                setError(null)
              }}
            />
          </div>

          {/* Language selectors */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="From" options={SUPPORTED_LANGUAGES} value={srcLang} onChange={setSrcLang} />
            </div>
            <div className="pb-2.5">
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <Select label="To" options={SUPPORTED_LANGUAGES} value={tgtLang} onChange={setTgtLang} />
            </div>
          </div>

          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={!file || loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Translate
              </>
            )}
          </button>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Result</h3>
                <button
                  onClick={handleReset}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              </div>

              {result.original_text && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Original ({SUPPORTED_LANGUAGES[srcLang]})
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{result.original_text}</p>
                </div>
              )}

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-medium">
                  Translated ({SUPPORTED_LANGUAGES[tgtLang]})
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {result.translated_text}
                </p>
                {result.translated_audio && (
                  <button
                    onClick={() => playBase64Audio(result.translated_audio)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 text-xs font-medium shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Volume2 className="w-3 h-3" /> Play translated audio
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
