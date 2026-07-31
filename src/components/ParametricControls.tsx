import { Slider } from "@/components/ui/Slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { useAppStore } from "@/stores/app-store"
import { useAudioEngine } from "@/hooks/useAudioEngine"
import { SCALES, NOTES, INSTRUMENT_GROUPS, cn } from "@/lib/utils"
import {
  normalizeModelKey,
  supportsRealtimeControls,
  isBatchLyriaModel,
} from "@/lib/constants"
import { CreativeControls } from "@/components/CreativeControls"
import { Volume2, VolumeX, HelpCircle } from "lucide-react"

const TOOLTIPS = {
  bpm: "Beats per minute — tempo of the track. Lyria 3.5 follows tempo more reliably when you set BPM here (also fine to write BPM in the prompt).",
  keyScale: "Musical key and scale — harmonic foundation woven into the generation prompt for Clip/Pro, or steerable live on RealTime.",
  density: "How many notes/events are generated. Low = sparse. High = busy. RealTime only.",
  brightness: "Tonal quality. Low = dark/warm. High = bright/sparkly. RealTime only.",
  guidance: "How strictly the AI follows your prompts. Low = creative. High = literal. RealTime only.",
  temperature: "Randomness. Low = stable. High = experimental. RealTime only.",
  instruments: "Mute or solo instrument groups during RealTime streaming.",
}

const BPM_PRESETS = [
  { value: 70, label: "70 ballad" },
  { value: 90, label: "90 chill" },
  { value: 110, label: "110 groove" },
  { value: 120, label: "120 pop" },
  { value: 140, label: "140 energy" },
]

const SCALE_RECOMMENDATIONS = [
  { key: "A", scale: "minor", label: "A Minor", genre: "Ambient, Chill, Lo-fi", recommended: true, description: "Ideal for ambient/chill music" },
  { key: "C", scale: "major", label: "C Major", genre: "Pop, Happy, Uplifting", recommended: false, description: "Bright and uplifting" },
  { key: "C", scale: "minor", label: "C Minor", genre: "Dramatic, Cinematic", recommended: false, description: "Dark and dramatic" },
  { key: "D", scale: "minor", label: "D Minor", genre: "Classical, Emotional", recommended: false, description: "Classical and emotional" },
  { key: "G", scale: "major", label: "G Major", genre: "Folk, Country, Pop", recommended: false, description: "Warm and natural" },
  { key: "E", scale: "minor", label: "E Minor", genre: "Rock, Indie", recommended: false, description: "Guitar-friendly rock key" },
  { key: "B", scale: "minor", label: "B Minor", genre: "Pop, Elegant", recommended: false, description: "Smooth pop / alternative" },
]

export function ParametricControls() {
  const {
    bpm,
    key,
    scale,
    density,
    brightness,
    guidance,
    temperature,
    instrumentMutes,
    instrumentSolos,
    selectedModel,
    setBpm,
    setKey,
    setScale,
    setDensity,
    setBrightness,
    setGuidance,
    setTemperature,
    toggleInstrumentMute,
    toggleInstrumentSolo,
  } = useAppStore()

  const { updateConfig, isGenerating } = useAudioEngine()
  const model = normalizeModelKey(selectedModel)
  const showRealtime = supportsRealtimeControls(model)
  const showBatch = isBatchLyriaModel(model)

  const handleChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    if (isGenerating) {
      updateConfig()
    }
  }

  const hasSolo = Object.values(instrumentSolos).some(Boolean)

  return (
    <div className="space-y-5">
      {/* Tempo & key — primary controls for all Lyria models */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Slider
                  label="BPM (Tempo)"
                  showValue
                  value={[bpm]}
                  min={60}
                  max={200}
                  step={1}
                  formatValue={(v) => v.toString()}
                  onValueChange={([v]) => handleChange(setBpm)(v)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{TOOLTIPS.bpm}</TooltipContent>
          </Tooltip>
          <div className="flex flex-wrap gap-1">
            {BPM_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleChange(setBpm)(p.value)}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] border transition-colors",
                  bpm === p.value
                    ? "bg-accent text-white border-accent"
                    : "bg-surface border-border text-text-muted hover:text-text"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">Key / Scale</span>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {TOOLTIPS.keyScale}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-2">
            <Select value={key} onValueChange={handleChange(setKey)}>
              <SelectTrigger className="w-20 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTES.map((note) => (
                  <SelectItem key={note} value={note}>
                    {note}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={scale} onValueChange={handleChange(setScale)}>
              <SelectTrigger className="flex-1 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-3 space-y-2 border border-border">
        <div className="text-xs font-medium text-text-muted">Quick scale presets</div>
        <div className="grid grid-cols-3 gap-1.5">
          {SCALE_RECOMMENDATIONS.map((rec) => {
            const isActive = key === rec.key && scale === rec.scale
            return (
              <button
                key={rec.label}
                type="button"
                onClick={() => {
                  handleChange(setKey)(rec.key)
                  handleChange(setScale)(rec.scale)
                }}
                className={cn(
                  "px-2 py-1.5 rounded-md text-xs transition-colors text-center",
                  isActive
                    ? "bg-accent text-white"
                    : "bg-surface-elevated hover:bg-surface-hover text-text-muted hover:text-text",
                  rec.recommended && !isActive && "ring-1 ring-accent/50"
                )}
              >
                {rec.recommended && <span className="mr-0.5">★</span>}
                {rec.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Clip/Pro creative features */}
      {showBatch && (
        <div className="pt-1 border-t border-border">
          <CreativeControls />
        </div>
      )}

      {/* RealTime-only advanced controls */}
      {showRealtime && (
        <>
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Slider
                    label="Density (sparse → busy)"
                    showValue
                    value={[density]}
                    min={0}
                    max={1}
                    step={0.01}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onValueChange={([v]) => handleChange(setDensity)(v)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.density}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Slider
                    label="Brightness (dark → bright)"
                    showValue
                    value={[brightness]}
                    min={0}
                    max={1}
                    step={0.01}
                    formatValue={(v) => `${Math.round(v * 100)}%`}
                    onValueChange={([v]) => handleChange(setBrightness)(v)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.brightness}</TooltipContent>
            </Tooltip>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Slider
                    label="Guidance (creative → strict)"
                    showValue
                    value={[guidance]}
                    min={0}
                    max={6}
                    step={0.1}
                    formatValue={(v) => v.toFixed(1)}
                    onValueChange={([v]) => handleChange(setGuidance)(v)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.guidance}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Slider
                    label="Temperature (stable → varied)"
                    showValue
                    value={[temperature]}
                    min={0}
                    max={2}
                    step={0.05}
                    formatValue={(v) => v.toFixed(2)}
                    onValueChange={([v]) => handleChange(setTemperature)(v)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.temperature}</TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-sm text-text-muted cursor-help inline-flex items-center gap-1">
                  Instrument Groups
                  <HelpCircle className="w-3 h-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent>{TOOLTIPS.instruments}</TooltipContent>
            </Tooltip>
            <div className="grid grid-cols-5 gap-2">
              {INSTRUMENT_GROUPS.map((group) => {
                const isMuted = instrumentMutes[group.id]
                const isSoloed = instrumentSolos[group.id]
                const isActive = hasSolo ? isSoloed : !isMuted

                return (
                  <div key={group.id} className="flex flex-col gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? "default" : "ghost"}
                          onClick={() => {
                            toggleInstrumentMute(group.id)
                            if (isGenerating) updateConfig()
                          }}
                          className={cn(
                            "h-10 text-sm px-2",
                            !isActive && "opacity-50"
                          )}
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4 mr-1" />
                          ) : (
                            <Volume2 className="w-4 h-4 mr-1" />
                          )}
                          {group.label}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isMuted ? `Unmute ${group.label}` : `Mute ${group.label}`}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={isSoloed ? "accent" : "ghost"}
                          onClick={() => {
                            toggleInstrumentSolo(group.id)
                            if (isGenerating) updateConfig()
                          }}
                          className="h-8 text-sm"
                        >
                          Solo
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isSoloed ? `Unsolo ${group.label}` : `Solo ${group.label} (mute all others)`}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {model === "musicgen" && (
        <p className="text-xs text-text-muted">
          MusicGen uses your prompt and track length. Tempo/key above are included in the prompt text when present.
        </p>
      )}
    </div>
  )
}
