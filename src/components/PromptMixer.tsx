import { Plus, X, Minus, HelpCircle, AlertTriangle, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Input"
import { Slider } from "@/components/ui/Slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { useAppStore } from "@/stores/app-store"
import { useAudioEngine } from "@/hooks/useAudioEngine"
import { cn } from "@/lib/utils"
import { getModelConfig, isBatchLyriaModel, normalizeModelKey } from "@/lib/constants"
import { generateRandomPrompt } from "@/lib/random-prompt"

export function PromptMixer() {
  const {
    prompts,
    negativePrompt,
    apiKey,
    selectedModel,
    addPrompt,
    updatePrompt,
    removePrompt,
    setNegativePrompt,
  } = useAppStore()

  const { updateConfig, isGenerating, play } = useAudioEngine()

  const model = normalizeModelKey(selectedModel)
  const modelConfig = getModelConfig(selectedModel)
  const totalWeight = prompts.reduce((sum, p) => sum + p.weight, 0)
  const maxPromptLength = modelConfig.maxPromptLength
  const isBatch = isBatchLyriaModel(model)

  const handlePromptChange = (id: string, updates: { text?: string; weight?: number }) => {
    updatePrompt(id, updates)
    if (isGenerating) {
      updateConfig()
    }
  }

  const handleNegativeChange = (value: string) => {
    setNegativePrompt(value)
    if (isGenerating) {
      updateConfig()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && apiKey) {
      e.preventDefault()
      if (!isGenerating) {
        play()
      } else {
        updateConfig()
      }
    }
  }

  const handleRandomPrompt = () => {
    const randomPrompt = generateRandomPrompt(selectedModel)
    if (prompts.length > 0) {
      updatePrompt(prompts[0].id, { text: randomPrompt })
    }
    if (isGenerating) {
      updateConfig()
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="text-base font-semibold text-text cursor-help inline-flex items-center gap-1">
              Prompt
              <HelpCircle className="w-3 h-3 text-text-muted" />
            </h3>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {modelConfig.promptTip} Press Enter to generate.
          </TooltipContent>
        </Tooltip>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRandomPrompt}
                className="h-9 px-3 text-sm"
              >
                <Shuffle className="w-4 h-4 mr-1" />
                Random
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate a random music prompt tuned for {modelConfig.label}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={addPrompt}
                disabled={prompts.length >= 4}
                className="h-9 px-3 text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add another prompt to blend multiple styles (max 4)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <p className="text-xs text-text-muted mb-3 leading-relaxed">
        {modelConfig.promptTip}
        {isBatch && " Set BPM, length, lyrics, and images in Generation Controls."}
      </p>

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {prompts.map((prompt) => {
          const percentage = totalWeight > 0 
            ? Math.round((prompt.weight / totalWeight) * 100) 
            : 0

          return (
            <div
              key={prompt.id}
              className="p-3 bg-surface rounded-lg border border-border flex flex-col gap-2"
            >
              <div className="flex gap-2">
                <div className="flex-1 flex flex-col gap-1">
                  <Textarea
                    placeholder={
                      isBatch
                        ? "e.g. funk pop, electric guitar, female vocal, 95 bpm, emotional chorus..."
                        : "Describe style, mood, instruments, genre... (Enter to generate)"
                    }
                    value={prompt.text}
                    onChange={(e) =>
                      handlePromptChange(prompt.id, { text: e.target.value })
                    }
                    onKeyDown={handleKeyDown}
                    className={cn(
                      "bg-surface-elevated min-h-[80px] text-sm flex-1 resize-none",
                      prompt.text.length > maxPromptLength && "border-warning"
                    )}
                  />
                  <div className="flex justify-between items-center px-1">
                    <span className={cn(
                      "text-xs",
                      prompt.text.length > maxPromptLength 
                        ? "text-warning flex items-center gap-1" 
                        : "text-text-muted"
                    )}>
                      {prompt.text.length > maxPromptLength && (
                        <>
                          <AlertTriangle className="w-3 h-3" />
                          Prompt may be too long for {modelConfig.label}
                        </>
                      )}
                    </span>
                    <span className={cn(
                      "text-xs font-mono",
                      prompt.text.length > maxPromptLength ? "text-warning" : "text-text-muted"
                    )}>
                      {prompt.text.length}/{maxPromptLength}
                    </span>
                  </div>
                </div>
                {prompts.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removePrompt(prompt.id)}
                    className="shrink-0 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">Weight:</span>
                    <div className="flex-1">
                      <Slider
                        value={[prompt.weight]}
                        min={0}
                        max={1}
                        step={0.05}
                        onValueChange={([value]) =>
                          handlePromptChange(prompt.id, { weight: value })
                        }
                      />
                    </div>
                    <div
                      className={cn(
                        "text-sm font-mono font-medium tabular-nums min-w-[40px] text-right",
                        percentage > 50 ? "text-accent" : "text-text-muted"
                      )}
                    >
                      {percentage}%
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Relative influence of this prompt in the mix</TooltipContent>
              </Tooltip>
            </div>
          )
        })}

        <div className="mt-auto pt-3 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 mb-2 cursor-help">
                <Minus className="w-4 h-4 text-error" />
                <span className="text-sm text-text-muted">Exclude (negative prompt)</span>
                <HelpCircle className="w-3 h-3 text-text-muted" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Elements to avoid in generation - e.g., "vocals, distortion, drums"
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-col gap-1">
            <Textarea
              placeholder="vocals, heavy metal, distortion, noise..."
              value={negativePrompt}
              onChange={(e) => handleNegativeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "bg-surface min-h-[60px] text-sm resize-none",
                negativePrompt.length > maxPromptLength && "border-warning"
              )}
            />
            <div className="flex justify-end px-1">
              <span className={cn(
                "text-xs font-mono",
                negativePrompt.length > maxPromptLength ? "text-warning" : "text-text-muted"
              )}>
                {negativePrompt.length}/{maxPromptLength}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
