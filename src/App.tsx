import { useEffect } from "react"
import { Visualizer } from "@/components/Visualizer"
import { TransportControls } from "@/components/TransportControls"
import { PromptMixer } from "@/components/PromptMixer"
import { ParametricControls } from "@/components/ParametricControls"
import { VocalMixer } from "@/components/VocalMixer"
import { TrackLibrary } from "@/components/TrackLibrary"
import { SettingsPanel } from "@/components/SettingsPanel"
import { PresetManager } from "@/components/PresetManager"
import { ModelPicker } from "@/components/ModelPicker"
import { useSettings } from "@/hooks/useSettings"
import { useAppStore } from "@/stores/app-store"
import { getModelConfig, normalizeModelKey } from "@/lib/constants"
import { TooltipProvider } from "@/components/ui/Tooltip"
import { Loader2 } from "lucide-react"

export default function App() {
  const { loadSettings } = useSettings()
  const { selectedModel, setSelectedModel, setLyriaModel, isGenerating, connectionStatus, elapsedTime, trackLength } = useAppStore()
  const normalizedModel = normalizeModelKey(selectedModel)
  const modelConfig = getModelConfig(selectedModel)
  
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
      <header className="flex items-center justify-between px-4 py-2 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/icon.svg" alt="Lyria AI Studio" className="w-10 h-10 rounded-lg shrink-0" />
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-text leading-tight">Lyria AI Studio</h1>
            <p className="text-sm text-text-muted truncate max-w-[200px]" title={modelConfig.description}>
              {modelConfig.label}
            </p>
          </div>

          <ModelPicker />
          
          {(isGenerating || connectionStatus) && (
            <div className="ml-1 flex items-center gap-2 px-3 py-1.5 bg-surface-elevated rounded-lg border border-border min-w-0">
              {isGenerating && (
                <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
              )}
              <span className="text-sm font-medium text-text truncate">
                {connectionStatus || "Processing..."}
              </span>
              {isGenerating && completionPercent > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-accent/20 text-accent rounded text-sm font-bold shrink-0">
                  {completionPercent}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
