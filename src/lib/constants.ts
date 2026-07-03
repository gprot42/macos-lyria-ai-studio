export const MODEL_CONFIG = {
  realtime: {
    label: "Lyria RealTime",
    modelId: "lyria-realtime-exp",
    provider: "Google",
    description: "Continuous streaming — real-time interactive generation, steerable with text, BPM, density, key",
    maxPromptLength: 200,
    promptTip: "Keep prompts short and simple. Best: 'ambient electronic chill 90 bpm'",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: true,
    fixedDuration: null as number | null,
    maxDuration: null as number | null,
    pricing: "free" as const,
    pricingNote: "Free preview with quota limits · Gemini API key required",
  },
  lyria3clip: {
    label: "Lyria 3 Clip (30 second clip)",
    modelId: "lyria-3-clip-preview",
    provider: "Google",
    description: "Fixed 30-second clips — high-fidelity audio, vocals + lyrics, image prompts",
    maxPromptLength: 1000,
    promptTip: "Describe genre, mood, instruments, and structure. Always outputs a 30-second clip.",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: false,
    fixedDuration: 30,
    maxDuration: 30,
    pricing: "freemium" as const,
    pricingNote: "Free (~10 tracks/day) · Paid $0.04/clip",
  },
  lyria3pro: {
    label: "Lyria 3 Pro",
    modelId: "lyria-3-pro-preview",
    provider: "Google",
    description: "Full songs up to ~3 minutes — verses, choruses, bridges, timed lyrics, high coherence",
    maxPromptLength: 2000,
    promptTip: "Use [Verse]/[Chorus] tags or timestamps. Specify duration, e.g. 'create a 2-minute song'.",
    requiresVertexAI: false,
    requiresApiKey: true,
    streaming: false,
    fixedDuration: null as number | null,
    maxDuration: 180,
    pricing: "paid" as const,
    pricingNote: "Paid only · ~10–50 tracks/day by tier · $0.08/full song",
  },
  musicgen: {
    label: "MusicGen",
    provider: "Meta (Hugging Face)",
    description: "Open source — requires self-hosting or HF Pro",
    maxPromptLength: 500,
    promptTip: "Describe genre, mood, instruments. Example: 'upbeat electronic dance music with synths'",
    requiresVertexAI: false,
    requiresApiKey: false,
    streaming: false,
    fixedDuration: null as number | null,
    maxDuration: 120,
    pricing: "paid" as const,
    pricingNote: "Requires Hugging Face Pro, Replicate API, or self-hosting with GPU",
  },
} as const

export type LyriaModelKey = "realtime" | "lyria3clip" | "lyria3pro"
export type ModelKey = keyof typeof MODEL_CONFIG

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

export function isBatchLyriaModel(model: ModelKey): boolean {
  return model === "lyria3clip" || model === "lyria3pro"
}

export function migrateLyriaModel(saved: string): LyriaModelKey | null {
  const migrations: Record<string, LyriaModelKey> = {
    lyria2: "lyria3clip",
    lyria3: "lyria3pro",
    realtime: "realtime",
    lyria3clip: "lyria3clip",
    lyria3pro: "lyria3pro",
  }
  return migrations[saved] ?? null
}

export function normalizeModelKey(model: string | undefined | null): ModelKey {
  if (!model) return "realtime"
  if (model in MODEL_CONFIG) return model as ModelKey
  const migrated = migrateLyriaModel(model)
  return migrated ?? "realtime"
}

export function getModelConfig(model: string) {
  return MODEL_CONFIG[normalizeModelKey(model)]
}

export function getTrackLengthForModel(model: ModelKey, currentLength: number): number {
  const config = MODEL_CONFIG[model]
  if (config.fixedDuration) return config.fixedDuration
  if (config.maxDuration && currentLength > config.maxDuration) return config.maxDuration
  return currentLength
}

// Legacy export for backwards compatibility
export const LYRIA_MODEL_CONFIG = MODEL_CONFIG