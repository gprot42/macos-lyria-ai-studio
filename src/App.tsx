import { useEffect } from "react"
import { Visualizer } from "@/components/Visualizer"
import { TransportControls } from "@/components/TransportControls"
import { PromptMixer } from "@/components/PromptMixer"
import { ParametricControls } from "@/components/ParametricControls"
import { VocalMixer } from "@/components/VocalMixer"
import { TrackLibrary } from "@/components/TrackLibrary"
import { SettingsPanel } from "@/components/SettingsPanel"
import { PresetManager } from "@/components/PresetManager"
import { useSettings } from "@/hooks/useSettings"
import { useAppStore } from "@/stores/app-store"
import { getModelConfig, normalizeModelKey } from "@/lib/constants"
import { TooltipProvider } from "@/components/ui/Tooltip"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { Loader2 } from "lucide-react"

export default function App() {
  const { loadSettings } = useSettings()
  const { selectedModel, setSelectedModel, setLyriaModel, isGenerating, connectionStatus, elapsedTime, trackLength } = useAppStore()
  const normalizedModel = normalizeModelKey(selectedModel)
  const modelConfig = getModelConfig(selectedModel)
  
  // Calculate completion percentage
  const completionPercent = trackLength > 0 && isGenerating 
    ? Math.min(100, Math.round((elapsedTime / trackLength) * 100))
    : 0

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (selectedModel !== normalizedModel) {
      setSelectedModel(normalizedModel)
      if (normalizedModel !== "musicgen") {
        setLyriaModel(normalizedModel)
      }
    }
  }, [selectedModel, normalizedModel, setSelectedModel, setLyriaModel])

  return (
    <TooltipProvider delayDuration={300}>
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="Lyria AI Studio" className="w-10 h-10 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold text-text leading-tight">Lyria AI Studio</h1>
            <p className="text-sm text-text-muted">AI Music Generation</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`ml-2 px-3 py-1.5 rounded-full text-sm font-medium cursor-default transition-colors ${
                normalizedModel === "realtime"
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : normalizedModel === "lyria3clip"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : normalizedModel === "lyria3pro"
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                  : "bg-green-500/20 text-green-400 border border-green-500/40"
              }`}>
                {modelConfig.label}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{modelConfig.description}</p>
              <p className="text-xs text-text-muted mt-1">Change in Settings</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Status indicator with completion percentage */}
          {(isGenerating || connectionStatus) && (
            <div className="ml-4 flex items-center gap-2 px-4 py-2 bg-surface-elevated rounded-lg border border-border">
              {isGenerating && (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              )}
              <span className="text-sm font-medium text-text">
                {connectionStatus || "Processing..."}
              </span>
              {isGenerating && completionPercent > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-accent/20 text-accent rounded text-sm font-bold">
                  {completionPercent}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <PresetManager />
          <SettingsPanel />
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-2 px-4 pb-3 min-h-0">
        <Visualizer className="h-[120px] shrink-0" />

        <TransportControls />

        <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
          <div className="col-span-4 flex flex-col gap-2 min-h-0">
            <section className="flex-1 p-4 bg-surface-elevated rounded-lg border border-border overflow-auto">
              <PromptMixer />
            </section>
          </div>

          <div className="col-span-5 min-h-0">
            <section className="h-full p-4 bg-surface-elevated rounded-lg border border-border overflow-auto">
              <h3 className="text-sm font-medium text-text mb-4">Generation Controls</h3>
              <ParametricControls />
            </section>
          </div>

          <div className="col-span-3 flex flex-col gap-2 min-h-0">
            <section className="flex-1 p-3 bg-surface-elevated rounded-lg border border-border overflow-auto">
              <TrackLibrary />
            </section>
            <section className="p-3 bg-surface-elevated rounded-lg border border-border">
              <VocalMixer />
            </section>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
