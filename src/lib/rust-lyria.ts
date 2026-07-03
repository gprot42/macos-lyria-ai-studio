import { invoke } from "@tauri-apps/api/core"

export interface GenerationStatus {
  state: string
  chunks_received: number
  total_samples: number
  duration_seconds: number
  error: string | null
}

export async function startRustGeneration(
  apiKey: string,
  prompt: string,
  durationSeconds: number
): Promise<void> {
  await invoke("lyria_start_generation", {
    apiKey,
    prompt,
    durationSeconds,
  })
}

export async function stopRustGeneration(): Promise<void> {
  await invoke("lyria_stop_generation")
}

export async function getRustGenerationStatus(): Promise<GenerationStatus> {
  return await invoke<GenerationStatus>("lyria_get_status")
}

export async function isRustGenerating(): Promise<boolean> {
  return await invoke<boolean>("lyria_is_generating")
}
