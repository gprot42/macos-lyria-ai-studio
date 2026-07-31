import { useAppStore } from "@/stores/app-store"
import {
  MODEL_CONFIG,
  normalizeModelKey,
  type ModelKey,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"

const MODEL_ORDER: ModelKey[] = ["lyria3clip", "lyria3pro", "realtime", "musicgen"]

const ACTIVE_STYLES: Record<ModelKey, string> = {
  lyria3clip: "bg-amber-500 text-white border-amber-500 shadow-sm",
  lyria3pro: "bg-indigo-500 text-white border-indigo-500 shadow-sm",
  realtime: "bg-accent text-white border-accent shadow-sm",
  musicgen: "bg-green-500 text-white border-green-500 shadow-sm",
}

export function ModelPicker() {
  const { selectedModel, setSelectedModel, setLyriaModel, isGenerating } = useAppStore()
  const normalized = normalizeModelKey(selectedModel)

  const handleSelect = (model: ModelKey) => {
    if (isGenerating || model === normalized) return
    setSelectedModel(model)
    if (model === "realtime" || model === "lyria3clip" || model === "lyria3pro") {
      setLyriaModel(model)
    }
  }

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border bg-surface-elevated p-1"
      role="tablist"
      aria-label="AI model"
    >
      {MODEL_ORDER.map((key) => {
        const config = MODEL_CONFIG[key]
        const active = normalized === key
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                disabled={isGenerating}
                onClick={() => handleSelect(key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  active
                    ? ACTIVE_STYLES[key]
                    : "border-transparent text-text-muted hover:text-text hover:bg-surface-hover"
                )}
              >
                {config.shortLabel}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium">{config.label}</p>
              <p className="text-xs mt-1">{config.description}</p>
              {config.pricingNote && (
                <p className="text-xs text-text-muted mt-1">{config.pricingNote}</p>
              )}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
