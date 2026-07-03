import {
  Play,
  Square,
  Download,
  Clock,
  Timer,
  Info,
  Volume2,
  FlaskConical,
  KeyRound,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { useAppStore } from "@/stores/app-store"
import { getAudioEngine } from "@/lib/audio-engine"
import { useAudioEngine } from "@/hooks/useAudioEngine"
import { saveAudioFile, encodeWavDirect } from "@/lib/audio-export"
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile } from "@tauri-apps/plugin-fs"
import { audioExport, audioExportFormat } from "@/lib/native-audio"
import { formatTime, cn } from "@/lib/utils"
import { getModelConfig, requiresGeminiApiKey, normalizeModelKey } from "@/lib/constants"
import { useState, useEffect, useRef } from "react"
import { debugLog } from "@/lib/debug-logger"

const TRACK_LENGTHS_REALTIME = [
  { value: "15", label: "15 sec" },
  { value: "30", label: "30 sec" },
  { value: "60", label: "1 min" },
  { value: "120", label: "2 min" },
]

const TRACK_LENGTHS_PRO = [
  { value: "60", label: "1 min" },
  { value: "120", label: "2 min" },
  { value: "180", label: "3 min (max)" },
]

const AUDIO_FORMATS = [
  { value: "wav", label: "WAV (16-bit)" },
  { value: "flac", label: "FLAC (24-bit)" },
  { value: "mp3-320", label: "MP3 (320kbps)" },
  { value: "mp3-128", label: "MP3 (128kbps)" },
]

export function TransportControls() {
  const { 
    elapsedTime,
    setElapsedTime,
    apiKey,
    trackLength,
    setTrackLength,
    preGenerateMode,
    setPreGenerateMode,
    isGenerating,
    addSavedTrack,
    hasCapturedAudio,
    isPlayingBack,
    setIsPlayingBack,
    selectedModel,
    setSettingsOpen,
  } = useAppStore()
  const {
    isRecording,
    isConnecting,
    error,
    status,
    play,
    stop,
    getCapturedAudio,
    clearCapturedAudio,
    playbackCapturedAudio,
    stopPlayback,
    getIsPlayingBack,
  } = useAudioEngine()

  const normalizedModel = normalizeModelKey(selectedModel)
  const modelConfig = getModelConfig(selectedModel)
  const isFixedClip = normalizedModel === "lyria3clip"
  const trackLengthOptions = normalizedModel === "lyria3pro" ? TRACK_LENGTHS_PRO : TRACK_LENGTHS_REALTIME
  const maxTrackLength = modelConfig.maxDuration ?? 180

  const [isSaving, setIsSaving] = useState(false)
  const [saveFormat, setSaveFormat] = useState<"wav" | "flac" | "mp3-320" | "mp3-128">("wav")
  const [isCustomLength, setIsCustomLength] = useState(false)
  const [customLengthInput, setCustomLengthInput] = useState("")
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testGapCount, setTestGapCount] = useState(0)
  const [hasNativeAudio, setHasNativeAudio] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)
  
  // Update hasNativeAudio when generation state changes
  useEffect(() => {
    const engine = getAudioEngine()
    setHasNativeAudio(engine.hasNativeAudio())
  }, [isGenerating, hasCapturedAudio])

  // Lock track length for Lyria 3 Clip (always 30 seconds)
  useEffect(() => {
    if (normalizedModel === "lyria3clip" && trackLength !== 30) {
      setTrackLength(30)
    }
  }, [normalizedModel, trackLength, setTrackLength])

  // Auto-enable pre-generate mode for longer tracks (over 90 seconds)
  useEffect(() => {
    if (trackLength > 90 && !preGenerateMode) {
      setPreGenerateMode(true)
      console.log("[UI] Auto-enabled pre-generate mode for longer track")
    }
  }, [trackLength, preGenerateMode, setPreGenerateMode])

  // Auto-stop test when generation ends
  useEffect(() => {
    if (!isGenerating && isTestRunning) {
      // Auto-stop test after a delay to capture final playback
      const timer = setTimeout(() => {
        const engine = getAudioEngine()
        const result = engine.stopPlaybackTest()
        setIsTestRunning(false)
        if (result) {
          console.log("=== AUTO TEST RESULTS ===")
          console.log(`Status: ${result.passed ? "PASSED" : "FAILED"}`)
          console.log(`Gaps: ${result.gapCount}, Stutters: ${result.stutterCount}`)
        }
        setTestGapCount(0)
      }, 3000) // Wait 3s for final audio to finish
      return () => clearTimeout(timer)
    }
  }, [isGenerating, isTestRunning])

  const handleSaveAs = async () => {
    debugLog.info("[Save] handleSaveAs called")
    
    const engine = getAudioEngine()
    const hasNative = engine.hasNativeAudio()
    const nativeChunks = engine.getNativeChunkCount()
    
    debugLog.info(`[Save] hasNativeAudio: ${hasNative}, nativeChunks: ${nativeChunks}`)
    
    // Check if we have any audio to save
    if (!hasCapturedAudio && !hasNative) {
      debugLog.error("[Save] No audio to save")
      alert("No audio to save. Generate some music first.")
      return
    }

    setIsSaving(true)
    
    try {
      // Use native export if available (more reliable for long tracks)
      if (hasNative) {
        debugLog.info("[Save] Using native export (Rust-based)")
        
        // Determine file extension and dialog filter based on format
        const ext = saveFormat.startsWith("mp3") ? "mp3" : saveFormat === "flac" ? "flac" : "wav"
        const formatName = ext === "mp3" ? "MP3 Audio" : ext === "flac" ? "FLAC Audio" : "WAV Audio"
        const bitrate = saveFormat === "mp3-320" ? 320 : saveFormat === "mp3-128" ? 128 : 0
        const bitrateLabel = saveFormat === "mp3-320" ? "-320kbps" : saveFormat === "mp3-128" ? "-128kbps" : ""
        
        const defaultName = `lyria-${new Date().toISOString().slice(0, 10)}-${Date.now()}${bitrateLabel}.${ext}`
        
        const filePath = await save({
          title: `Save Track As ${ext.toUpperCase()}`,
          defaultPath: defaultName,
          filters: [{ name: formatName, extensions: [ext] }],
        })
        
        if (!filePath) {
          debugLog.info("[Save] Dialog cancelled")
          return
        }
        
        let finalPath = filePath
        if (!finalPath.endsWith(`.${ext}`)) {
          finalPath = `${filePath}.${ext}`
        }
        
        debugLog.info(`[Save] Exporting to: ${finalPath} (format: ${saveFormat}, bitrate: ${bitrate})`)
        
        // Use format-aware export for MP3/FLAC, legacy export for WAV
        if (saveFormat === "wav") {
          await audioExport(finalPath)
        } else {
          await audioExportFormat(finalPath, ext, bitrate)
        }
        debugLog.info("[Save] Native export complete!")
        
        const duration = nativeChunks * 2 // ~2 sec per chunk
        addSavedTrack({
          id: `${Date.now()}`,
          name: finalPath.split('/').pop()?.replace(/\.(wav|mp3|flac)$/, '') || 'track',
          path: finalPath,
          duration,
          createdAt: Date.now(),
        })
        
        // Don't clear audio - user may want to save in multiple formats
        alert(`Saved: ${finalPath.split('/').pop()}`)
        return
      }
      
      // Fallback: JS-based encoding (for short tracks or if native failed)
      debugLog.info("[Save] Using JS-based encoding")
      const audioData = getCapturedAudio()
      debugLog.info(`[Save] Audio data length: ${audioData?.length ?? 0}`)
      
      if (!audioData || audioData.length === 0) {
        debugLog.error("[Save] No audio data from JS")
        alert("No audio to save. Generate some music first.")
        return
      }
    
      const ext = saveFormat.startsWith("mp3") ? "mp3" : "wav"
      // Include bitrate in filename for MP3 formats
      const bitrateLabel = saveFormat === "mp3-320" ? "-320kbps" : saveFormat === "mp3-128" ? "-128kbps" : ""
      const defaultName = `lyria-${new Date().toISOString().slice(0, 10)}-${Date.now()}${bitrateLabel}.${ext}`
      
      debugLog.info(`[Save] Converting ${audioData.length} samples to ${saveFormat}...`)
      
      // Wrap encoding in a timeout to prevent hanging
      let blob: Blob
      const encodePromise = saveAudioFile(audioData, saveFormat)
      const encodeTimeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000) // 5 second timeout for encoding
      })
      
      const encodeResult = await Promise.race([encodePromise, encodeTimeout])
      
      let actualExt = ext
      if (encodeResult === null) {
        debugLog.warn("[Save] Encoding timed out, falling back to WAV")
        blob = encodeWavDirect(audioData)
        actualExt = "wav"
      } else {
        blob = encodeResult
      }
      
      // Update filename if we fell back to WAV
      const actualDefaultName = actualExt !== ext 
        ? `lyria-${new Date().toISOString().slice(0, 10)}-${Date.now()}.wav`
        : defaultName
      
      debugLog.info(`[Save] Blob created, size: ${blob.size}`)
      
      const filePath = await save({
        title: `Save Track As ${actualExt.toUpperCase()}`,
        defaultPath: actualDefaultName,
        filters: [{ name: `${actualExt.toUpperCase()} Audio`, extensions: [actualExt] }],
      })
      
      if (!filePath) {
        debugLog.info("[Save] Dialog cancelled")
        return
      }
      
      let finalPath = filePath
      if (!finalPath.endsWith(`.${actualExt}`)) {
        finalPath = `${filePath}.${actualExt}`
      }
      
      const buffer = await blob.arrayBuffer()
      debugLog.info(`[Save] Writing ${buffer.byteLength} bytes to: ${finalPath}`)
      await writeFile(finalPath, new Uint8Array(buffer))
      debugLog.info("[Save] File saved successfully!")

      const name = finalPath.split('/').pop()?.replace(/\.(mp3|wav|flac)$/, '') || 'track'
      const duration = audioData.length / 48000
      
      addSavedTrack({
        id: `${Date.now()}`,
        name,
        path: finalPath,
        duration,
        createdAt: Date.now(),
      })
      
      // Don't clear audio - user may want to save in multiple formats
      alert(`Saved: ${finalPath.split('/').pop()}`)
    } catch (err) {
      debugLog.error(`[Save] Failed: ${err instanceof Error ? err.message : String(err)}`)
      alert(`Failed to save file: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePlayPause = async () => {
    if (isGenerating) {
      await stop()
    } else {
      await play()
    }
  }

  const handlePlaybackToggle = async () => {
    if (isPlayingBack) {
      stopPlayback()
      setIsPlayingBack(false)
      setElapsedTime(0)
    } else {
      await playbackCapturedAudio()
      setIsPlayingBack(true)
      setElapsedTime(0)
      const checkPlayback = setInterval(() => {
        if (!getIsPlayingBack()) {
          setIsPlayingBack(false)
          clearInterval(checkPlayback)
        }
      }, 100)
    }
  }

  const handleTestToggle = () => {
    const engine = getAudioEngine()
    if (isTestRunning) {
      const result = engine.stopPlaybackTest()
      setIsTestRunning(false)
      if (result) {
        console.log("=== PLAYBACK TEST RESULTS ===")
        console.log(`Status: ${result.passed ? "PASSED" : "FAILED"}`)
        console.log(`Gaps: ${result.gapCount}, Stutters: ${result.stutterCount}`)
        alert(`Test ${result.passed ? "PASSED ✓" : "FAILED ✗"}\n\nGaps: ${result.gapCount}\nStutters: ${result.stutterCount}`)
      }
      setTestGapCount(0)
    } else {
      engine.startPlaybackTest((msg) => {
        console.log(`[Test] ${msg}`)
        if (msg.includes("Gap") || msg.includes("Stutter")) {
          setTestGapCount(prev => prev + 1)
        }
      })
      setIsTestRunning(true)
    }
  }

  const needsGeminiApiKey = requiresGeminiApiKey(normalizedModel) && !apiKey
  const canPlay = normalizedModel === "musicgen"
    ? true
    : requiresGeminiApiKey(normalizedModel)
    ? !!apiKey
    : false

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {needsGeminiApiKey && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-warning/10 border border-warning/40 rounded-xl">
          <div className="flex items-start gap-2.5 min-w-0">
            <KeyRound className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-text">
              <span className="font-medium text-warning">Gemini API key required.</span>{" "}
              {modelConfig.label} is free to use, but you need a key from Google AI Studio.
              Paste it in Settings and click <span className="font-medium">Save Changes</span> to enable Generate.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-warning/50 text-warning hover:bg-warning/10"
            onClick={() => setSettingsOpen(true)}
          >
            Open Settings
          </Button>
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-3 bg-surface-elevated rounded-xl border border-border">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handlePlayPause}
              disabled={!canPlay || isConnecting}
              variant="default"
              className={cn(
                "h-14 px-6 rounded-full text-base font-medium gap-2 transition-all",
                isGenerating
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30" 
                  : needsGeminiApiKey
                  ? "opacity-60"
                  : "bg-accent hover:bg-accent/90"
              )}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isGenerating ? (
                <Square className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {isConnecting ? "Connecting" : isGenerating ? "Stop" : "Generate"}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {needsGeminiApiKey
              ? "Add your Gemini API key in Settings and click Save Changes to start generating."
              : isGenerating
                ? "Stop music generation" 
                : "Start generating AI music based on your prompts"}
          </TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handlePlaybackToggle}
            disabled={(!hasCapturedAudio && !hasNativeAudio) || isGenerating}
            variant={isPlayingBack ? "accent" : "outline"}
            className="h-12 px-4 text-sm font-medium gap-2"
          >
            {isPlayingBack ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {isPlayingBack ? "Stop" : "Preview"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {!hasCapturedAudio && !hasNativeAudio
            ? "Generate some music first" 
            : isPlayingBack 
              ? "Stop playback"
              : "Preview the generated track before saving"}
        </TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select 
                value={saveFormat} 
                onValueChange={(v) => setSaveFormat(v as "wav" | "flac" | "mp3-320" | "mp3-128")}
              >
                <SelectTrigger className="w-36 h-12 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIO_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Select audio format for export
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleSaveAs}
              disabled={(!hasCapturedAudio && !hasNativeAudio) || isSaving}
              variant={(hasCapturedAudio || hasNativeAudio) && !isGenerating ? "accent" : "outline"}
              className={cn("h-12 px-4 text-sm font-medium gap-2", (hasCapturedAudio || hasNativeAudio) && !isGenerating && "animate-pulse")}
            >
              <Download className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!hasCapturedAudio && !hasNativeAudio
              ? "Generate some music first" 
              : "Save the generated audio to disk"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="h-10 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-text-muted" />
            <span className="text-sm text-text-muted">Length:</span>
            {isFixedClip ? (
              <span className="text-sm font-medium text-accent px-3 py-2 bg-accent/10 rounded-md border border-accent/30">
                30 sec (fixed clip)
              </span>
            ) : isCustomLength ? (
              <div className="flex items-center gap-1">
                <input
                  ref={customInputRef}
                  type="number"
                  min="5"
                  max={maxTrackLength}
                  value={customLengthInput}
                  onChange={(e) => setCustomLengthInput(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(customLengthInput)
                    if (val >= 5 && val <= maxTrackLength) {
                      setTrackLength(val)
                    } else {
                      setCustomLengthInput(trackLength.toString())
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(customLengthInput)
                      if (val >= 5 && val <= maxTrackLength) {
                        setTrackLength(val)
                      }
                      (e.target as HTMLInputElement).blur()
                    } else if (e.key === "Escape") {
                      setIsCustomLength(false)
                      setCustomLengthInput("")
                    }
                  }}
                  className="w-16 h-10 px-2 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="sec"
                  autoFocus
                />
                <span className="text-sm text-text-muted">sec</span>
                <button
                  onClick={() => {
                    setIsCustomLength(false)
                    setCustomLengthInput("")
                  }}
                  className="p-1 text-text-muted hover:text-text"
                >
                  ✕
                </button>
              </div>
            ) : (
              <Select 
                value={trackLengthOptions.some(l => l.value === trackLength.toString()) ? trackLength.toString() : "custom"}
                onValueChange={(v) => {
                  if (v === "custom") {
                    setIsCustomLength(true)
                    setCustomLengthInput(trackLength > 0 ? trackLength.toString() : "")
                    setTimeout(() => customInputRef.current?.focus(), 0)
                  } else {
                    setTrackLength(parseInt(v))
                  }
                }}
              >
                <SelectTrigger className="w-28 h-10 text-sm">
                  <SelectValue>
                    {trackLengthOptions.find(l => l.value === trackLength.toString())?.label || `${trackLength} sec`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {trackLengthOptions.map((length) => (
                    <SelectItem key={length.value} value={length.value}>
                      {length.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>
            {isFixedClip
              ? "Lyria 3 Clip always generates a fixed 30-second clip."
              : normalizedModel === "lyria3pro"
              ? "Lyria 3 Pro supports songs up to ~3 minutes. Duration is also influenced by your prompt."
              : "Set track duration (5–120 sec). Longer realtime tracks may have gaps after ~1 min due to API speed."}
          </p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preGenerateMode}
              onChange={(e) => setPreGenerateMode(e.target.checked)}
              disabled={isGenerating}
              className="w-4 h-4 rounded border-border bg-surface accent-accent cursor-pointer disabled:opacity-50"
            />
            <span className={cn(
              "text-sm",
              preGenerateMode ? "text-accent" : "text-text-muted"
            )}>
              Pre-generate
            </span>
          </label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>Buffer entire track before playing. Longer wait (~{Math.ceil(trackLength * 3 / 60)} min) but gap-free playback.</p>
        </TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleTestToggle}
              variant={isTestRunning ? "default" : "outline"}
              size="sm"
              disabled={!isGenerating && !isTestRunning}
              className={cn(
                "h-8 px-3 gap-1.5 min-w-[130px]",
                isTestRunning 
                  ? testGapCount > 0 
                    ? "bg-red-500 hover:bg-red-600 text-white" 
                    : "bg-green-500 hover:bg-green-600 text-white"
                  : !isGenerating 
                    ? "opacity-50"
                    : "border-amber-500 text-amber-500 hover:bg-amber-500/10"
              )}
            >
              <FlaskConical className="w-4 h-4" />
              {isTestRunning 
                ? testGapCount > 0 
                  ? `Detected ${testGapCount} gap${testGapCount > 1 ? 's' : ''}` 
                  : "Smooth playback"
                : isGenerating
                  ? "Monitor Playback"
                  : "Quality Monitor"}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[280px]">
            {!isGenerating && !isTestRunning ? (
              <div className="space-y-1">
                <p className="font-medium">Playback Quality Monitor</p>
                <p className="text-xs text-muted-foreground">Click Generate first, then use this to detect audio gaps or stutters during playback.</p>
              </div>
            ) : isTestRunning ? (
              <div className="space-y-1">
                <p className="font-medium">{testGapCount > 0 ? `${testGapCount} issue${testGapCount > 1 ? 's' : ''} detected` : 'No issues detected'}</p>
                <p className="text-xs text-muted-foreground">Monitoring will auto-stop when generation ends. Click to stop early and see results.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-medium">Click to start monitoring</p>
                <p className="text-xs text-muted-foreground">Detects audio gaps and stutters in real-time. Results shown when generation completes.</p>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 cursor-help">
              <Info className="w-4 h-4 text-text-muted hover:text-text transition-colors" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[300px]">
            <div className="space-y-2">
              <p className="font-medium">How to use Quality Monitor</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Click <span className="text-accent">Generate</span> to start music generation</li>
                <li>Click <span className="text-amber-500">Monitor Playback</span> to begin detecting issues</li>
                <li>Watch for gaps/stutters during playback</li>
                <li>Results shown automatically when complete</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Tip: Use <span className="font-medium">Pre-generate mode</span> for gap-free playback on longer tracks.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="h-10 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 text-text">
            <Clock className="w-5 h-5 text-text-muted" />
            <span className="font-mono text-lg tabular-nums font-medium min-w-[56px]">
              {formatTime(elapsedTime)}
            </span>
            {trackLength > 0 && (
              <span className="text-sm text-text-muted">
                / {formatTime(trackLength)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>Elapsed time / Total track length</TooltipContent>
      </Tooltip>

      {(hasCapturedAudio || hasNativeAudio) && !isGenerating && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg cursor-help ml-auto">
              <Info className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-500">Track ready - click "Save"</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Your generated audio is ready to save. Click Save to export it.</TooltipContent>
        </Tooltip>
      )}
      </div>
    </div>
  )
}
