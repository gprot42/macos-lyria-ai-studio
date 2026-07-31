export const MODEL_CONFIG = {
  lyria3clip: {
    label: "Lyria 3 Clip",
    shortLabel: "Clip · 30s",
    modelId: "lyria-3-clip-preview",
    provider: "Google",
    description:
      "Fast 30-second clips with vocals & lyrics — great for ideas and loops (Lyria 3 / 3.5 quality)",
    maxPromptLength: 1000,
    promptTip:
      "Describe genre, mood, instruments, vocal style, and BPM. Always outputs a 30-second clip.",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: false,
    fixedDuration: 30,
    maxDuration: 30,
    supportsLyrics: true,
    supportsImages: true,
    supportsInstrumental: true,
    supportsRealtimeControls: false,
    pricing: "freemium" as const,
    pricingNote: "Free (~10 tracks/day) · Paid $0.04/clip",
  },
  lyria3pro: {
    label: "Lyria 3 Pro",
    shortLabel: "Pro · up to 3 min",
    modelId: "lyria-3-pro-preview",
    provider: "Google",
    description:
      "Full songs up to ~3 minutes — verses, choruses, bridges, timed lyrics, tempo & duration control",
    maxPromptLength: 2000,
    promptTip:
      "Use [Verse]/[Chorus] tags or timestamps. Set length in the Length control (or write e.g. '2-minute song').",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: false,
    fixedDuration: null as number | null,
    maxDuration: 180,
    supportsLyrics: true,
    supportsImages: true,
    supportsInstrumental: true,
    supportsRealtimeControls: false,
    pricing: "paid" as const,
    pricingNote: "Paid only · ~10–50 tracks/day by tier · $0.08/full song",
  },
  realtime: {
    label: "Lyria RealTime",
    shortLabel: "RealTime · live",
    modelId: "lyria-realtime-exp",
    provider: "Google",
    description:
      "Continuous streaming — real-time interactive generation, steerable with text, BPM, density, key",
    maxPromptLength: 200,
    promptTip: "Keep prompts short and simple. Best: 'ambient electronic chill 90 bpm'",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: true,
    fixedDuration: null as number | null,
    maxDuration: null as number | null,
    supportsLyrics: false,
    supportsImages: false,
    supportsInstrumental: false,
    supportsRealtimeControls: true,
    pricing: "free" as const,
    pricingNote: "Free preview with quota limits · Gemini API key required",
  },
  musicgen: {
    label: "MusicGen",
    shortLabel: "MusicGen",
    modelId: "facebook/musicgen-medium",
    provider: "Meta (Hugging Face)",
    description: "Open source — requires self-hosting or HF Pro",
    maxPromptLength: 500,
    promptTip: "Describe genre, mood, instruments. Example: 'upbeat electronic dance music with synths'",
    requiresVertexAI: false,
    requiresApiKey: false,
    streaming: false,
    fixedDuration: null as number | null,
    maxDuration: 120,
    supportsLyrics: false,
    supportsImages: false,
    supportsInstrumental: false,
    supportsRealtimeControls: false,
    pricing: "paid" as const,
    pricingNote: "Requires Hugging Face Pro, Replicate API, or self-hosting with GPU",
  },
} as const

export type LyriaModelKey = "realtime" | "lyria3clip" | "lyria3pro"
export type ModelKey = keyof typeof MODEL_CONFIG

/** Default model for new users — Clip is freemium and best first experience. */
export const DEFAULT_MODEL: ModelKey = "lyria3clip"

export const MUSICGEN_MODELS = {
  small: {
    label: "MusicGen Small",
    modelId: "facebook/musicgen-small",
    description: "Fast, lower quality (~300M params)",
  },
  medium: {
    label: "MusicGen Medium",
    modelId: "facebook/musicgen-medium",
    description: "Balanced speed/quality (~1.5B params)",
  },
  large: {
    label: "MusicGen Large",
    modelId: "facebook/musicgen-large",
    description: "Best quality, slower (~3.3B params)",
  },
} as const

export type MusicGenModelSize = keyof typeof MUSICGEN_MODELS

export function isLyriaModel(model: ModelKey): model is LyriaModelKey {
  return model === "realtime" || model === "lyria3clip" || model === "lyria3pro"
}

export function requiresGeminiApiKey(model: ModelKey): boolean {
  return isLyriaModel(model) && MODEL_CONFIG[model].requiresApiKey
}

export function isBatchLyriaModel(model: ModelKey): model is "lyria3clip" | "lyria3pro" {
  return model === "lyria3clip" || model === "lyria3pro"
}

export function supportsLyricsEditor(model: ModelKey): boolean {
  return MODEL_CONFIG[model].supportsLyrics
}

export function supportsImagePrompts(model: ModelKey): boolean {
  return MODEL_CONFIG[model].supportsImages
}

export function supportsInstrumentalToggle(model: ModelKey): boolean {
  return MODEL_CONFIG[model].supportsInstrumental
}

export function supportsRealtimeControls(model: ModelKey): boolean {
  return MODEL_CONFIG[model].supportsRealtimeControls
}

export function migrateLyriaModel(saved: string): LyriaModelKey | null {
  const migrations: Record<string, LyriaModelKey> = {
    lyria2: "lyria3clip",
    lyria3: "lyria3pro",
    "lyria-3.5": "lyria3pro",
    lyria35: "lyria3pro",
    lyria3_5: "lyria3pro",
    realtime: "realtime",
    lyria3clip: "lyria3clip",
    lyria3pro: "lyria3pro",
  }
  return migrations[saved] ?? null
}

export function normalizeModelKey(model: string | undefined | null): ModelKey {
  if (!model) return DEFAULT_MODEL
  if (model in MODEL_CONFIG) return model as ModelKey
  const migrated = migrateLyriaModel(model)
  return migrated ?? DEFAULT_MODEL
}

export function getModelConfig(model: string) {
  return MODEL_CONFIG[normalizeModelKey(model)]
}

export function getTrackLengthForModel(model: ModelKey, currentLength: number): number {
  const config = MODEL_CONFIG[model]
  if (config.fixedDuration) return config.fixedDuration
  if (config.maxDuration && currentLength > config.maxDuration) return config.maxDuration
  // Sensible default when switching to Pro from realtime short clips
  if (model === "lyria3pro" && currentLength < 60) return 120
  return currentLength
}

export function formatDurationHint(seconds: number): string {
  if (seconds < 60) return `${seconds}-second`
  const minutes = seconds / 60
  if (Number.isInteger(minutes)) return `${minutes}-minute`
  return `${seconds}-second`
}

// Legacy export for backwards compatibility
export const LYRIA_MODEL_CONFIG = MODEL_CONFIG
