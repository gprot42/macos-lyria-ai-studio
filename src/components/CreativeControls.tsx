import { useRef } from "react"
import {
  HelpCircle,
  ImagePlus,
  Mic2,
  Music2,
  X,
  FileText,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Input"
import { Switch } from "@/components/ui/Switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"
import { useAppStore } from "@/stores/app-store"
import {
  supportsImagePrompts,
  supportsInstrumentalToggle,
  supportsLyricsEditor,
  getModelConfig,
  normalizeModelKey,
} from "@/lib/constants"
import { LYRICS_TEMPLATE } from "@/lib/random-prompt"
import { cn } from "@/lib/utils"
import type { ReferenceImage } from "@/lib/lyria-client"

function fileToReferenceImage(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(",") ? result.split(",")[1] : result
      resolve({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        mimeType: file.type || "image/jpeg",
        data: base64,
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function CreativeControls() {
  const {
    selectedModel,
    customLyrics,
    setCustomLyrics,
    generatedLyrics,
    setGeneratedLyrics,
    instrumentalOnly,
    setInstrumentalOnly,
    referenceImages,
    addReferenceImage,
    removeReferenceImage,
  } = useAppStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const model = normalizeModelKey(selectedModel)
  const config = getModelConfig(model)
  const showLyrics = supportsLyricsEditor(model)
  const showImages = supportsImagePrompts(model)
  const showInstrumental = supportsInstrumentalToggle(model)

  if (!showLyrics && !showImages && !showInstrumental) {
    return null
  }

  const handleImagePick = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = 10 - referenceImages.length
    const toAdd = Array.from(files).slice(0, remaining)
    for (const file of toAdd) {
      if (!file.type.startsWith("image/")) continue
      try {
        const img = await fileToReferenceImage(file)
        addReferenceImage(img)
      } catch (err) {
        console.error("Failed to read image:", err)
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text">Creative Controls</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-3.5 h-3.5 text-text-muted cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Lyria 3 / 3.5 features: custom lyrics, instrumental mode, and image-inspired tracks.
            Tempo and duration are set with the BPM slider and Length control.
          </TooltipContent>
        </Tooltip>
      </div>

      {showInstrumental && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface">
          <div className="flex items-start gap-2 min-w-0">
            {instrumentalOnly ? (
              <Music2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            ) : (
              <Mic2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-text">Instrumental only</p>
              <p className="text-xs text-text-muted">
                No vocals or lyrics — ideal for background music
              </p>
            </div>
          </div>
          <Switch
            checked={instrumentalOnly}
            onCheckedChange={setInstrumentalOnly}
            aria-label="Instrumental only"
          />
        </div>
      )}

      {showLyrics && !instrumentalOnly && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-sm text-text-muted">Custom lyrics (optional)</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setCustomLyrics(LYRICS_TEMPLATE)}
            >
              Insert template
            </Button>
          </div>
          <Textarea
            placeholder={`Optional — paste lyrics with [Verse] / [Chorus] tags.\nLeave empty to let ${config.label} write them.`}
            value={customLyrics}
            onChange={(e) => setCustomLyrics(e.target.value)}
            className="min-h-[120px] text-sm font-mono bg-surface"
          />
          {generatedLyrics && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-accent">Generated lyrics / structure</span>
                <button
                  type="button"
                  onClick={() => setGeneratedLyrics(null)}
                  className="text-text-muted hover:text-text"
                  aria-label="Dismiss generated lyrics"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <pre className="text-xs text-text whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                {generatedLyrics}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setCustomLyrics(generatedLyrics)
                  setGeneratedLyrics(null)
                }}
              >
                Use as custom lyrics
              </Button>
            </div>
          )}
        </div>
      )}

      {showImages && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-sm text-text-muted">
                Image inspiration ({referenceImages.length}/10)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={referenceImages.length >= 10}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Add image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleImagePick(e.target.files)
                e.target.value = ""
              }}
            />
          </div>
          {referenceImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "relative group rounded-lg border border-border overflow-hidden",
                    "w-16 h-16 bg-surface"
                  )}
                >
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(img.id)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${img.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              Optional — attach a photo and Lyria will compose to its mood and colors.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
