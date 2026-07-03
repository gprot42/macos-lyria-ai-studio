import { MUSICGEN_MODELS, type MusicGenModelSize } from "./constants"

// Note: Hugging Face has deprecated their free Inference API (api-inference.huggingface.co)
// MusicGen now requires either:
// 1. A Hugging Face Pro subscription with Inference Endpoints
// 2. Replicate API (paid)
// 3. Self-hosting
// For now, we'll use a demo/fallback approach
const HF_INFERENCE_API = "https://api-inference.huggingface.co/models"

export interface MusicGenConfig {
  prompt: string
  duration: number
  modelSize: MusicGenModelSize
  huggingFaceToken?: string
}

export interface MusicGenCallbacks {
  onStatus: (status: string) => void
  onError: (error: string) => void
  onAudioData: (audioData: ArrayBuffer) => void
  onComplete: () => void
}

export class MusicGenClient {
  private callbacks: MusicGenCallbacks
  private abortController: AbortController | null = null
  private isGenerating = false

  constructor(callbacks: MusicGenCallbacks) {
    this.callbacks = callbacks
  }

  async generate(config: MusicGenConfig): Promise<void> {
    if (this.isGenerating) {
      this.callbacks.onError("Generation already in progress")
      return
    }

    if (!config.prompt || config.prompt.trim().length === 0) {
      this.callbacks.onError("Please enter a prompt first")
      return
    }

    this.isGenerating = true
    this.abortController = new AbortController()

    const modelConfig = MUSICGEN_MODELS[config.modelSize]
    const modelId = modelConfig.modelId

    this.callbacks.onStatus(`Connecting to MusicGen (${modelConfig.label})...`)

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }

      if (config.huggingFaceToken) {
        headers["Authorization"] = `Bearer ${config.huggingFaceToken}`
      }

      console.log("[MusicGen] Starting generation")
      console.log("[MusicGen] Model:", modelId)
      console.log("[MusicGen] Prompt:", config.prompt.substring(0, 100) + "...")
      console.log("[MusicGen] Duration:", config.duration, "seconds")

      this.callbacks.onStatus("Generating music with MusicGen...")

      const response = await fetch(`${HF_INFERENCE_API}/${modelId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          inputs: config.prompt,
          parameters: {
            max_new_tokens: Math.min(config.duration * 50, 1500),
          },
        }),
        signal: this.abortController.signal,
      })

      console.log("[MusicGen] Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[MusicGen] Error response:", errorText)

        // Check if it's the API deprecation error
        if (errorText.includes("no longer supported") || errorText.includes("router.huggingface.co")) {
          this.callbacks.onError(
            "MusicGen requires Hugging Face Pro, Replicate API, or self-hosting. The free HF Inference API is not available. For free generation, use Google Lyria Realtime instead."
          )
          return
        }

        if (response.status === 503) {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error?.includes("loading")) {
            this.callbacks.onError(
              `MusicGen model is loading. Estimated wait: ${errorJson.estimated_time || "unknown"}s. Please try again in a moment.`
            )
            return
          }
        }

        if (response.status === 401) {
          this.callbacks.onError(
            "Hugging Face authentication failed. Add your free HF token in Settings for higher rate limits, or try again later."
          )
          return
        }

        if (response.status === 429) {
          this.callbacks.onError(
            "Rate limit exceeded. Add a Hugging Face token in Settings for higher limits, or wait a moment and try again."
          )
          return
        }

        this.callbacks.onError(`MusicGen API error: ${response.status} - ${errorText}`)
        return
      }

      const contentType = response.headers.get("content-type")
      console.log("[MusicGen] Content-Type:", contentType)

      if (contentType?.includes("audio")) {
        const audioData = await response.arrayBuffer()
        console.log("[MusicGen] Received audio data:", audioData.byteLength, "bytes")
        this.callbacks.onAudioData(audioData)
        this.callbacks.onStatus("MusicGen generation complete")
        this.callbacks.onComplete()
      } else {
        const responseData = await response.json()
        console.log("[MusicGen] Response:", responseData)

        if (responseData.error) {
          this.callbacks.onError(`MusicGen error: ${responseData.error}`)
          return
        }

        if (Array.isArray(responseData) && responseData[0]?.blob) {
          const base64Audio = responseData[0].blob
          const binaryString = atob(base64Audio)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          this.callbacks.onAudioData(bytes.buffer)
          this.callbacks.onStatus("MusicGen generation complete")
          this.callbacks.onComplete()
        } else {
          this.callbacks.onError("Unexpected response format from MusicGen")
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[MusicGen] Generation aborted")
        this.callbacks.onStatus("Generation cancelled")
      } else {
        console.error("[MusicGen] Error:", error)
        this.callbacks.onError(
          error instanceof Error ? error.message : "Unknown error during MusicGen generation"
        )
      }
    } finally {
      this.isGenerating = false
      this.abortController = null
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.isGenerating = false
  }

  isActive(): boolean {
    return this.isGenerating
  }
}
