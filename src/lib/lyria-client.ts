import { GoogleGenAI, type LiveMusicSession, type LiveMusicServerMessage } from "@google/genai"
import { MODEL_CONFIG, type LyriaModelKey } from "./constants"
import { useAppStore } from "@/stores/app-store"
import { debugLog } from "./debug-logger"

export type LyriaModelType = LyriaModelKey

export interface LyriaConfig {
  bpm: number
  key: string
  scale: string
  density: number
  brightness: number
  guidance: number
  temperature: number
  prompts: Array<{ text: string; weight: number }>
  negativePrompt: string
  instrumentMutes: Record<string, boolean>
  trackLength?: number
}

interface InteractionLike {
  id: string
  status: string
  outputs?: Array<{ type: string; data?: string; text?: string }>
  steps?: Array<{
    type: string
    content?: Array<{ type: string; data?: string; text?: string }>
  }>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class LyriaClient {
  private apiKey: string
  private modelType: LyriaModelType
  private client: GoogleGenAI | null = null
  private session: LiveMusicSession | null = null
  private onAudioChunk: ((chunk: ArrayBuffer) => void) | null = null
  private onAudioChunkBase64: ((base64: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private isGenerating = false
  private currentConfig: LyriaConfig | null = null
  private isSessionReady = false
  private pendingConfig: LyriaConfig | null = null

  constructor(apiKey: string, modelType: LyriaModelType = "realtime") {
    this.apiKey = apiKey
    this.modelType = modelType
  }

  getModelType(): LyriaModelType {
    return this.modelType
  }

  private getModelLabel(): string {
    return MODEL_CONFIG[this.modelType].label
  }

  private getModelId(): string {
    return MODEL_CONFIG[this.modelType].modelId
  }

  async connect(): Promise<void> {
    if (this.modelType === "lyria3clip" || this.modelType === "lyria3pro") {
      this.client = new GoogleGenAI({ apiKey: this.apiKey })
      this.isSessionReady = true
      this.onStatusChange?.(`Connected to ${this.getModelLabel()}`)
      return
    }

    if (this.session) {
      console.log("[Lyria] Already connected, reusing session")
      this.isSessionReady = true
      this.onStatusChange?.(`Connected to ${this.getModelLabel()}`)
      return
    }

    this.onStatusChange?.("Connecting to Lyria API...")
    this.isSessionReady = false

    try {
      this.client = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: { apiVersion: "v1alpha" },
      })

      this.session = await this.client.live.music.connect({
        model: `models/${this.getModelId()}`,
        callbacks: {
          onmessage: (message: LiveMusicServerMessage) => {
            this.handleMessage(message)
          },
          onerror: (error: ErrorEvent) => {
            console.error("[Lyria] Connection error:", error)
            this.onError?.(`${this.getModelLabel()} connection error`)
          },
          onclose: (event: CloseEvent) => {
            this.isSessionReady = false
            if (event.code !== 1000) {
              this.onError?.(`Connection closed: ${event.reason || "Unknown error"}`)
            } else {
              this.onStatusChange?.("Disconnected")
            }
          },
        },
      })

      console.log("[Lyria] Session connected")
      this.onStatusChange?.(`Connected to ${this.getModelLabel()}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed"
      console.error("Failed to connect to Lyria:", err)
      this.onError?.(errorMsg)
      this.onStatusChange?.("Connection failed")
    }
  }

  private handleMessage(message: LiveMusicServerMessage) {
    if (message.setupComplete) {
      this.isSessionReady = true
      this.onStatusChange?.("API ready - generating...")

      if (this.pendingConfig) {
        const config = this.pendingConfig
        this.pendingConfig = null
        this.executeGeneration(config)
      }
    }

    if (message.filteredPrompt) {
      const reason = message.filteredPrompt.filteredReason || "Content policy"
      this.onError?.(`Prompt rejected: ${reason}`)
      this.onStatusChange?.("Prompt rejected")
    }

    const audioChunk = message.audioChunk
    const audioChunks = message.serverContent?.audioChunks

    if (audioChunk?.data) {
      debugLog.info(`[Lyria] Received audio chunk, base64 length: ${audioChunk.data.length}`)
      if (this.onAudioChunkBase64) {
        this.onAudioChunkBase64(audioChunk.data)
      } else if (this.onAudioChunk) {
        const buffer = this.base64ToArrayBuffer(audioChunk.data)
        this.onAudioChunk(buffer)
      }
    } else if (audioChunks && audioChunks.length > 0) {
      debugLog.info(`[Lyria] Received ${audioChunks.length} audio chunks in serverContent`)
      for (const chunk of audioChunks) {
        if (chunk.data) {
          if (this.onAudioChunkBase64) {
            this.onAudioChunkBase64(chunk.data)
          } else if (this.onAudioChunk) {
            const buffer = this.base64ToArrayBuffer(chunk.data)
            this.onAudioChunk(buffer)
          }
        }
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i)
    }
    return buffer
  }

  setOnAudioChunk(callback: (chunk: ArrayBuffer) => void) {
    this.onAudioChunk = callback
  }

  setOnAudioChunkBase64(callback: ((base64: string) => void) | null) {
    this.onAudioChunkBase64 = callback
  }

  setOnError(callback: (error: string) => void) {
    this.onError = callback
  }

  setOnStatusChange(callback: (status: string) => void) {
    this.onStatusChange = callback
  }

  async startGeneration(config: LyriaConfig) {
    this.currentConfig = config
    this.isGenerating = true

    if (this.modelType === "lyria3clip" || this.modelType === "lyria3pro") {
      await this.startInteractionsGeneration(config)
      return
    }

    if (!this.session) {
      this.onError?.(`No ${this.getModelLabel()} session. Check your API key and try reconnecting.`)
      this.onStatusChange?.("Not connected")
      return
    }

    if (!this.isSessionReady) {
      console.log("[Lyria] Session not flagged ready, but proceeding anyway for speed")
    }

    await this.executeGeneration(config)
  }

  private async executeGeneration(config: LyriaConfig) {
    if (!this.session) {
      return
    }

    try {
      this.onStatusChange?.("Starting generation...")
      await this.applyConfig(config)
      console.log("[Lyria] Calling play()...")
      this.session.play()
      console.log("[Lyria] play() called successfully")
      this.onStatusChange?.("Generating music...")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Generation failed"
      console.error("[Lyria] Generation error:", err)
      this.onError?.(errorMsg)
      this.isGenerating = false
    }
  }

  private buildInteractionsPrompt(config: LyriaConfig): string {
    const weightedPrompts = config.prompts
      .filter((p) => p.text.trim())
      .map((p) => ({
        text: p.text.trim(),
        weight: typeof p.weight === "number" ? p.weight : 1.0,
      }))

    let prompt = ""
    if (weightedPrompts.length === 1) {
      prompt = weightedPrompts[0].text
    } else if (weightedPrompts.length > 1) {
      prompt = weightedPrompts
        .map((p) => `${p.text} (weight ${p.weight.toFixed(1)})`)
        .join(". ")
    } else {
      prompt = "ambient electronic music"
    }

    const musicalHints: string[] = []
    if (config.bpm) musicalHints.push(`${Math.round(config.bpm)} BPM`)
    if (config.key && config.scale) {
      musicalHints.push(`in ${config.key} ${config.scale}`)
    }

    if (musicalHints.length > 0) {
      prompt = `${prompt}. ${musicalHints.join(", ")}.`
    }

    if (this.modelType === "lyria3clip") {
      prompt = `${prompt} Fixed 30-second clip.`
    } else if (this.modelType === "lyria3pro") {
      const trackLength = config.trackLength ?? useAppStore.getState().trackLength
      const minutes = Math.max(1, Math.round(trackLength / 60))
      prompt = `${prompt} Create a ${minutes}-minute full song with clear structure (verses, choruses, bridges).`
    }

    if (config.negativePrompt.trim()) {
      prompt = `${prompt} Avoid: ${config.negativePrompt.trim()}.`
    }

    return prompt
  }

  private extractAudioBase64(interaction: InteractionLike): string | null {
    if (interaction.outputs) {
      for (const output of interaction.outputs) {
        if (output.type === "audio" && output.data) {
          return output.data
        }
      }
    }

    if (interaction.steps) {
      for (const step of interaction.steps) {
        if (step.type === "model_output" && step.content) {
          for (const block of step.content) {
            if (block.type === "audio" && block.data) {
              return block.data
            }
          }
        }
      }
    }

    const legacy = interaction as InteractionLike & {
      output_audio?: { data?: string }
    }
    if (legacy.output_audio?.data) {
      return legacy.output_audio.data
    }

    return null
  }

  private extractLyrics(interaction: InteractionLike): string | null {
    const lyrics: string[] = []

    if (interaction.outputs) {
      for (const output of interaction.outputs) {
        if (output.type === "text" && output.text) {
          lyrics.push(output.text)
        }
      }
    }

    if (interaction.steps) {
      for (const step of interaction.steps) {
        if (step.type === "model_output" && step.content) {
          for (const block of step.content) {
            if (block.type === "text" && block.text) {
              lyrics.push(block.text)
            }
          }
        }
      }
    }

    const legacy = interaction as InteractionLike & { output_text?: string }
    if (legacy.output_text) {
      lyrics.push(legacy.output_text)
    }

    return lyrics.length > 0 ? lyrics.join("\n") : null
  }

  private async startInteractionsGeneration(config: LyriaConfig) {
    const modelLabel = this.getModelLabel()
    const modelId = this.getModelId()
    const logTag = `[${modelLabel}]`

    if (!this.client) {
      this.onError?.(`${modelLabel}: Client not initialized`)
      return
    }

    const prompt = this.buildInteractionsPrompt(config)
    console.log(`${logTag} Prompt:`, prompt)
    this.onStatusChange?.(
      this.modelType === "lyria3clip"
        ? `${modelLabel}: Generating 30-second clip...`
        : `${modelLabel}: Generating song (may take 1–2 min)...`
    )

    try {
      let interaction = (await this.client.interactions.create({
        model: modelId,
        input: prompt,
      })) as InteractionLike

      let pollCount = 0
      while (interaction.status === "in_progress" && this.isGenerating) {
        pollCount++
        this.onStatusChange?.(`${modelLabel}: Generating... (${pollCount * 2}s)`)
        await sleep(2000)
        interaction = (await this.client.interactions.get(interaction.id)) as InteractionLike
      }

      if (!this.isGenerating) {
        this.onStatusChange?.("Stopped")
        return
      }

      if (interaction.status === "failed" || interaction.status === "cancelled") {
        this.onError?.(`${modelLabel}: Generation ${interaction.status}`)
        this.onStatusChange?.("Generation failed")
        this.isGenerating = false
        return
      }

      const audioBase64 = this.extractAudioBase64(interaction)
      if (!audioBase64) {
        console.error(`${logTag} Unexpected response:`, interaction)
        this.onError?.(`${modelLabel}: No audio in API response`)
        this.onStatusChange?.("Generation failed")
        this.isGenerating = false
        return
      }

      const lyrics = this.extractLyrics(interaction)
      if (lyrics) {
        console.log(`${logTag} Lyrics/structure:\n`, lyrics)
      }

      this.onStatusChange?.(`${modelLabel}: Processing audio...`)
      await this.decodeAndStreamMp3(audioBase64)
      this.onStatusChange?.("Generation complete")
      this.isGenerating = false
    } catch (err) {
      console.error(`${logTag} Error:`, err)
      const errorMsg = err instanceof Error ? err.message : "Generation failed"
      this.onError?.(`${modelLabel}: ${errorMsg}`)
      this.onStatusChange?.("Generation failed")
      this.isGenerating = false
    }
  }

  private async resampleTo48k(buffer: AudioBuffer): Promise<AudioBuffer> {
    if (buffer.sampleRate === 48000) return buffer

    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.ceil(buffer.duration * 48000),
      48000
    )
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start()
    return offline.startRendering()
  }

  private audioBufferToInt16Stereo(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = 2
    const left = buffer.getChannelData(0)
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left
    const samples = buffer.length
    const interleaved = new Int16Array(samples * numChannels)

    for (let i = 0; i < samples; i++) {
      interleaved[i * 2] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)))
      interleaved[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)))
    }

    return interleaved.buffer
  }

  private async decodeAndStreamMp3(mp3Base64: string): Promise<void> {
    const mp3Bytes = this.base64ToArrayBuffer(mp3Base64)
    const decodeContext = new AudioContext()
    try {
      const decoded = await decodeContext.decodeAudioData(mp3Bytes.slice(0))
      const resampled = await this.resampleTo48k(decoded)
      const pcmBuffer = this.audioBufferToInt16Stereo(resampled)
      this.streamAudioBuffer(pcmBuffer)
    } finally {
      await decodeContext.close()
    }
  }

  private streamAudioBuffer(buffer: ArrayBuffer) {
    const chunkSize = 48000 * 2 * 2 * 0.2
    let offset = 0

    const sendChunk = () => {
      if (offset >= buffer.byteLength || !this.isGenerating) {
        return
      }

      const chunk = buffer.slice(offset, offset + chunkSize)
      this.onAudioChunk?.(chunk)
      offset += chunkSize

      if (offset < buffer.byteLength && this.isGenerating) {
        setTimeout(sendChunk, 180)
      }
    }

    sendChunk()
  }

  private async applyConfig(config: LyriaConfig) {
    if (!this.session) return

    try {
      const prompts = config.prompts || []

      const validPrompts = prompts
        .filter((p) => p && p.text && p.text.trim())
        .map((p) => ({
          text: p.text.trim(),
          weight: typeof p.weight === "number" ? p.weight : 1.0,
        }))

      if (validPrompts.length === 0) {
        validPrompts.push({
          text: "ambient electronic music",
          weight: 1.0,
        })
      }

      await this.session.setWeightedPrompts({
        weightedPrompts: validPrompts,
      })

      await this.session.setMusicGenerationConfig({
        musicGenerationConfig: {
          bpm: Math.round(config.bpm || 120),
        },
      })
    } catch (err) {
      console.error("[Lyria] Config error:", err)
      throw err
    }
  }

  async pause() {
    if (this.session) {
      this.session.pause()
    }
    this.isGenerating = false
    this.onStatusChange?.("Paused")
  }

  async resume() {
    if (this.session) {
      this.session.play()
      this.isGenerating = true
      this.onStatusChange?.("Generating music...")
    }
  }

  async stop() {
    this.isGenerating = false
    if (this.session) {
      this.session.pause()
    }
    this.onStatusChange?.("Stopped")
  }

  stopGeneration() {
    this.isGenerating = false
    if (this.session) {
      this.session.pause()
    }
    this.onStatusChange?.("Stopped")
  }

  async disconnect() {
    this.isGenerating = false
    if (this.session) {
      this.session.close()
      this.session = null
    }
    this.client = null
    this.onStatusChange?.("Disconnected")
  }

  isConnected(): boolean {
    if (this.modelType === "lyria3clip" || this.modelType === "lyria3pro") {
      return !!this.apiKey
    }
    return this.session !== null
  }
}

let clientInstance: LyriaClient | null = null

export function getLyriaClient(apiKey: string, modelType: LyriaModelType = "realtime"): LyriaClient {
  if (!clientInstance || clientInstance["apiKey"] !== apiKey || clientInstance.getModelType() !== modelType) {
    if (clientInstance) {
      clientInstance.disconnect()
    }
    clientInstance = new LyriaClient(apiKey, modelType)
  }
  return clientInstance
}

export function buildConfigFromStore(): LyriaConfig {
  const state = useAppStore.getState()
  return {
    bpm: state.bpm,
    key: state.key,
    scale: state.scale,
    density: state.density,
    brightness: state.brightness,
    guidance: state.guidance,
    temperature: state.temperature,
    prompts: state.prompts,
    negativePrompt: state.negativePrompt,
    instrumentMutes: state.instrumentMutes,
    trackLength: state.trackLength,
  }
}