import { useRef, useState } from "react"
import { Plus, X, Upload, Play, Pause, Volume2, Clock } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Slider } from "@/components/ui/Slider"
import { Input } from "@/components/ui/Input"
import { useAppStore } from "@/stores/app-store"
import { getAudioEngine } from "@/lib/audio-engine"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const parseTime = (timeStr: string): number | null => {
  const match = timeStr.match(/^(\d+):(\d{1,2})$/)
  if (match) {
    const mins = parseInt(match[1], 10)
    const secs = parseInt(match[2], 10)
    if (secs < 60) {
      return mins * 60 + secs
    }
  }
  // Also allow just seconds
  const secsOnly = parseInt(timeStr, 10)
  if (!isNaN(secsOnly) && secsOnly >= 0) {
    return secsOnly
  }
  return null
}

export function VocalMixer() {
  const {
    vocalTracks,
    addVocalTrack,
    updateVocalTrack,
    removeVocalTrack,
  } = useAppStore()

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const playingTracks = useRef<Set<string>>(new Set())
  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({})

  const handleFileSelect = async (trackId: string, file: File) => {
    updateVocalTrack(trackId, { file, name: file.name })
    const engine = getAudioEngine()
    const track = vocalTracks.find((t) => t.id === trackId)
    if (track) {
      await engine.loadVocalTrack({ ...track, file })
    }
  }

  const handlePlayPause = (trackId: string) => {
    const engine = getAudioEngine()
    const isPlaying = playingTracks.current.has(trackId)

    if (isPlaying) {
      engine.stopVocalTrack(trackId)
      playingTracks.current.delete(trackId)
    } else {
      engine.playVocalTrack(trackId)
      playingTracks.current.add(trackId)
    }
  }

  const handleVolumeChange = (trackId: string, volume: number) => {
    updateVocalTrack(trackId, { volume })
    const track = vocalTracks.find((t) => t.id === trackId)
    if (track) {
      getAudioEngine().updateVocalTrack(trackId, volume, track.pan)
    }
  }

  const handlePanChange = (trackId: string, pan: number) => {
    updateVocalTrack(trackId, { pan })
    const track = vocalTracks.find((t) => t.id === trackId)
    if (track) {
      getAudioEngine().updateVocalTrack(trackId, track.volume, pan)
    }
  }

  const handleStartTimeChange = (trackId: string, value: string) => {
    setTimeInputs((prev) => ({ ...prev, [trackId]: value }))
    const seconds = parseTime(value)
    if (seconds !== null) {
      updateVocalTrack(trackId, { startTime: seconds })
    }
  }

  const getTimeInputValue = (track: { id: string; startTime: number }) => {
    if (timeInputs[track.id] !== undefined) {
      return timeInputs[track.id]
    }
    return formatTime(track.startTime)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Vocal Mixer</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={addVocalTrack}
          disabled={vocalTracks.length >= 3}
          className="h-8 px-2 text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {vocalTracks.length === 0 ? (
        <div className="p-6 border border-dashed border-border rounded-md text-center">
          <Volume2 className="w-8 h-8 mx-auto mb-2 text-text-muted" />
          <p className="text-sm text-text-muted mb-3">
            Mix vocals with AI music
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={addVocalTrack}
            className="h-8 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Track
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {vocalTracks.map((track) => (
            <div
              key={track.id}
              className="p-3 bg-surface rounded-md border border-border space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    fileInputRefs.current[track.id] = el
                  }}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(track.id, file)
                  }}
                />

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePlayPause(track.id)}
                  disabled={!track.file}
                  className="shrink-0 h-8 w-8"
                >
                  {playingTracks.current.has(track.id) ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  {track.file ? (
                    <span className="text-sm truncate block">{track.name}</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRefs.current[track.id]?.click()}
                      className="w-full h-8 text-sm"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Load Audio
                    </Button>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeVocalTrack(track.id)}
                  className="shrink-0 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Start time - always visible */}
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-xs text-text-muted">Insert at</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    When to insert this vocal in the track (mm:ss or seconds)
                  </TooltipContent>
                </Tooltip>
                <Input
                  value={getTimeInputValue(track)}
                  onChange={(e) => handleStartTimeChange(track.id, e.target.value)}
                  onBlur={() => {
                    setTimeInputs((prev) => {
                      const next = { ...prev }
                      delete next[track.id]
                      return next
                    })
                  }}
                  placeholder="0:00"
                  className="w-20 h-7 text-xs text-center px-1"
                />
                <span className="text-xs text-text-muted">mm:ss</span>
              </div>

              {track.file && (
                <div className="space-y-2">
                  <Slider
                    label="Volume"
                    showValue
                    value={[track.volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onValueChange={([v]) => handleVolumeChange(track.id, v)}
                  />
                  <Slider
                    label="Pan"
                    showValue
                    value={[track.pan]}
                    min={-1}
                    max={1}
                    step={0.01}
                    formatValue={(v) =>
                      v === 0 ? "C" : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`
                    }
                    onValueChange={([v]) => handlePanChange(track.id, v)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
