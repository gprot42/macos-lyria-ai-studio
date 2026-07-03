import { LyriaClient, getLyriaClient, buildConfigFromStore, type LyriaModelType } from "./lyria-client"
import { MusicGenClient } from "./musicgen-client"
import { useAppStore, type VocalTrack } from "@/stores/app-store"
import { PlaybackTester, type PlaybackTestResult } from "./playback-test"
import { debugLog, setDebugStats } from "./debug-logger"
import { 
  audioInit, 
  audioWriteChunk,
  audioWriteChunkBase64,
  audioStartPlayback, 
  audioStopPlayback, 
  audioGetStatus, 
  audioClear,
  audioExport,
  audioGetSamples,
  convertStereoToInt16,
  type AudioStatus 
} from "./native-audio"
import {
  startRustGeneration,
  stopRustGeneration,
  getRustGenerationStatus,
  isRustGenerating,
  type GenerationStatus
} from "./rust-lyria"

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private lyriaClient: LyriaClient | null = null
  private musicgenClient: MusicGenClient | null = null
  private playbackTester: PlaybackTester | null = null
  private audioQueue: AudioBuffer[] = []
  private isPlaying = false
  private isPaused = false
  private isStopped = true
  private nextPlayTime = 0
  private generatedDuration = 0
  private playbackStartTime = 0
  private lastPlayedTime = 0
  private lastScheduledEndTime = 0
  private isRebuffering = false
  private scheduledBuffers: AudioBufferSourceNode[] = []
  private vocalNodes: Map<string, { source: AudioBufferSourceNode | null; gain: GainNode; pan: StereoPannerNode }> = new Map()
  private recordedChunks: Float32Array[] = []
  private isRecording = false
  private playbackSource: AudioBufferSourceNode | null = null
  private isPlayingBack = false
  private animationFrame: number | null = null
  private onStatusChange: ((status: string) => void) | null = null
  private onError: ((error: string) => void) | null = null
  private onFirstAudioChunk: (() => void) | null = null
  private hasReceivedFirstChunk = false
  private chunkCount = 0
  private cleanupInterval: number | null = null
  
  // Native audio mode for long tracks
  private useNativeAudio = false
  private nativeChunkCount = 0
  private nativeStatusInterval: number | null = null
  private nativeTrackLength = 0  // Cache to avoid repeated store access
  
  // Rust-native generation mode (completely bypasses JavaScript)
  private useRustGeneration = false
  private rustStatusInterval: number | null = null

  async initialize(): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: 48000 })
    this.masterGain = this.audioContext.createGain()
    this.analyser = this.audioContext.createAnalyser()
    
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8

    this.masterGain.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    
    // Initialize native audio streamer
    try {
      await audioInit()
      console.log("[Audio] Native audio streamer initialized")
    } catch (e) {
      console.warn("[Audio] Native audio init failed, will use Web Audio only:", e)
    }
  }

  setOnStatusChange(callback: (status: string) => void) {
    this.onStatusChange = callback
  }

  setOnError(callback: (error: string) => void) {
    this.onError = callback
  }

  setOnFirstAudioChunk(callback: () => void) {
    this.onFirstAudioChunk = callback
  }

  async connect(apiKey: string = ""): Promise<void> {
    if (!this.audioContext) {
      await this.initialize()
    }

    const selectedModel = useAppStore.getState().selectedModel

    if (selectedModel === "musicgen") {
      this.musicgenClient = new MusicGenClient({
        onStatus: (status) => {
          console.log("Status:", status)
          this.onStatusChange?.(status)
          useAppStore.getState().setConnectionStatus(status)
        },
        onError: (error) => {
          console.error("Error:", error)
          this.onError?.(error)
          useAppStore.getState().setConnectionError(error)
        },
        onAudioData: async (audioData) => {
          await this.handleMusicGenAudio(audioData)
        },
        onComplete: () => {
          this.isPlaying = false
          useAppStore.getState().setIsGenerating(false)
          useAppStore.getState().setIsPlaying(false)
          useAppStore.getState().setHasCapturedAudio(true)
        },
      })
      useAppStore.getState().setConnectionStatus("MusicGen ready")
      return
    }

    if (!apiKey) {
      throw new Error("API key is required for Lyria models")
    }

    const modelType = useAppStore.getState().lyriaModel
    this.lyriaClient = getLyriaClient(apiKey, modelType)
    this.lyriaClient.setOnAudioChunk(this.handleAudioChunk.bind(this))
    this.lyriaClient.setOnStatusChange((status) => {
      console.log("Status:", status)
      this.onStatusChange?.(status)
      useAppStore.getState().setConnectionStatus(status)
    })
    this.lyriaClient.setOnError((error) => {
      console.error("Error:", error)
      
      // If we have audio buffered/playing, don't show hard error - just note the disconnect
      if (this.isPlaying && this.generatedDuration > 0) {
        console.log(`[Audio] Connection lost after ${this.generatedDuration.toFixed(0)}s - continuing with buffered audio`)
        
        // Mark generation complete since connection dropped but we have audio
        useAppStore.getState().setIsGenerating(false)
        useAppStore.getState().setHasCapturedAudio(true)
        
        if (this.generatedDuration >= useAppStore.getState().trackLength * 0.8) {
          // Got most of the track - just finish up
          this.onStatusChange?.("Connection closed - finishing playback")
          useAppStore.getState().setConnectionStatus("Finishing playback...")
        } else {
          // Got partial track - offer to save what we have
          this.onStatusChange?.(`Connection dropped at ${this.generatedDuration.toFixed(0)}s - save what you have or retry`)
          useAppStore.getState().setConnectionStatus(`Got ${this.generatedDuration.toFixed(0)}s - ready to save`)
        }
        // Don't set connection error - let playback continue
      } else if (error.includes("Connection closed") || error.includes("Socket")) {
        // API disconnected - suggest retry
        this.onError?.("API connection dropped (server-side). Try again - the API has rate limits.")
        useAppStore.getState().setConnectionError("API connection dropped. Try again in a few seconds.")
      } else {
        this.onError?.(error)
        useAppStore.getState().setConnectionError(error)
      }
    })
    
    useAppStore.getState().setIsConnecting(true)
    try {
      await this.lyriaClient.connect()
      useAppStore.getState().setConnectionStatus("Connected to Lyria")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed"
      useAppStore.getState().setConnectionError(msg)
      throw err
    } finally {
      useAppStore.getState().setIsConnecting(false)
    }
  }

  private async handleMusicGenAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.masterGain) return

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0))
      
      const floatData = audioBuffer.getChannelData(0)
      this.recordedChunks.push(new Float32Array(floatData))

      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.analyser!)
      source.connect(this.masterGain)
      source.start()

      this.startAnalyzerLoop()

      source.onended = () => {
        this.stopAnalyzerLoop()
      }
    } catch (err) {
      console.error("Failed to decode MusicGen audio:", err)
      this.onError?.("Failed to decode audio from MusicGen")
    }
  }

  private chunkCounter = 0

  private async handleAudioChunk(chunk: ArrayBuffer): Promise<void> {
    this.chunkCounter++
    
    // Log to Rust terminal for debugging (survives white screen)
    debugLog.info(`Chunk #${this.chunkCounter} received, size: ${chunk.byteLength}, queue: ${this.audioQueue.length}`)
    setDebugStats(this.chunkCounter, this.audioQueue.length)
    
    // Ignore chunks if we've been stopped
    if (this.isStopped) {
      debugLog.info(`Chunk #${this.chunkCounter} ignored - engine stopped`)
      return
    }
    
    // ALWAYS write to Rust storage for saving (memory-efficient)
    // This happens regardless of native audio mode
    try {
      const int16Data = new Int16Array(chunk)
      await audioWriteChunk(int16Data)
      this.nativeChunkCount++
    } catch (e) {
      console.warn("[Audio] Failed to write chunk to native storage:", e)
    }
    
    // Get current settings
    const preGenerateMode = useAppStore.getState().preGenerateMode
    const trackLength = useAppStore.getState().trackLength
    
    // PRE-GENERATE MODE: Don't create AudioBuffers at all - save memory
    // Just write to Rust storage and wait for completion
    if (preGenerateMode && trackLength >= 60) {
      // Calculate expected chunks for target duration (~2 sec per chunk)
      const expectedChunks = Math.ceil(trackLength / 2)
      const percent = Math.round((this.nativeChunkCount / expectedChunks) * 100)
      
      if (!this.hasReceivedFirstChunk) {
        this.hasReceivedFirstChunk = true
        console.log("[Audio] Pre-generate mode: saving to disk only")
        this.onStatusChange?.("Pre-generating: 0%")
      }
      
      // Update progress every 5 chunks or at 100%
      if (this.nativeChunkCount % 5 === 0 || this.nativeChunkCount >= expectedChunks) {
        console.log(`[Audio] Pre-generate progress: ${this.nativeChunkCount}/${expectedChunks} (${percent}%)`)
        this.onStatusChange?.(`Pre-generating: ${Math.min(percent, 99)}%`)
      }
      
      // Track generated duration without creating AudioBuffer
      this.generatedDuration = this.nativeChunkCount * 2 // ~2 sec per chunk
      
      // Check if we've received enough audio for the target duration
      if (this.nativeChunkCount >= expectedChunks) {
        console.log("[Audio] Pre-generate complete! Starting native playback...")
        this.onStatusChange?.("Pre-generate complete - Starting playback...")
        useAppStore.getState().setHasCapturedAudio(true)
        
        // Start native audio playback from saved file
        try {
          await audioStartPlayback()
          this.onFirstAudioChunk?.()
          this.onStatusChange?.("Playing from saved audio...")
        } catch (e) {
          console.error("[Audio] Failed to start native playback:", e)
          this.onStatusChange?.("Playback failed - try Save As")
        }
      }
      
      return // Don't process further in pre-generate mode
    }
    
    // NATIVE AUDIO MODE: Write chunks to disk, let Rust handle playback
    if (this.useNativeAudio) {
      await this.handleNativeAudioChunk(chunk)
      return
    }
    
    // WEB AUDIO MODE: Original implementation for short tracks
    if (!this.audioContext || !this.masterGain) {
      return
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    try {
      const int16Data = new Int16Array(chunk)
      const numChannels = 2
      const samplesPerChannel = int16Data.length / numChannels
      
      const audioBuffer = this.audioContext.createBuffer(numChannels, samplesPerChannel, 48000)
      
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel)
        for (let i = 0; i < samplesPerChannel; i++) {
          channelData[i] = int16Data[i * numChannels + channel] / 32768
        }
      }

      // CRITICAL: Minimize memory usage to prevent white screen crashes
      // DON'T store recordedChunks during generation - too much memory
      // Audio is saved to Rust storage instead for saving
      
      this.generatedDuration += audioBuffer.duration
      this.audioQueue.push(audioBuffer)
      
      // AGGRESSIVE memory limit - keep only what's needed for smooth playback
      // 10 chunks = 20 seconds of buffer, should be enough for scheduling
      const MAX_QUEUE_SIZE = 10
      while (this.audioQueue.length > MAX_QUEUE_SIZE) {
        const oldBuffer = this.audioQueue.shift()
      }
      
      // Mark that we have audio (for save button)
      useAppStore.getState().setHasCapturedAudio(true)
      
      if (!this.hasReceivedFirstChunk) {
        this.hasReceivedFirstChunk = true
        console.log("[Audio] First chunk received!")
        this.onStatusChange?.("Buffering audio...")
      }

      // Simplified buffer logic for streaming mode (short tracks)
      const BUFFER_SIZE = Math.min(5, Math.ceil(trackLength / 8))
      
      if (!this.isPlayingFromQueue) {
        // Log buffering progress
        if (this.audioQueue.length % 5 === 0 || this.audioQueue.length >= BUFFER_SIZE) {
          console.log(`[Audio] Buffering: ${this.audioQueue.length}/${BUFFER_SIZE}`)
        }
        if (this.audioQueue.length >= BUFFER_SIZE) {
          console.log("[Audio] Buffer full, starting playback")
          this.onStatusChange?.("Playing...")
          this.onFirstAudioChunk?.()
          this.startContinuousPlayback()
        }
      } else {
        // During playback, schedule new chunks immediately
        this.scheduleNextChunks()
      }
    } catch (err) {
      console.error("Error processing audio chunk:", err)
    }
  }
  
  // Native audio handler for long tracks - writes to disk instead of memory
  private async handleNativeAudioChunk(chunk: ArrayBuffer): Promise<void> {
    console.log(`[Audio] handleNativeAudioChunk called, size: ${chunk.byteLength}`)
    
    try {
      // Create Int16Array view without copying (more memory efficient)
      const int16Data = new Int16Array(chunk)
      const sampleCount = int16Data.length
      const chunkDuration = sampleCount / 2 / 48000 // stereo, 48kHz
      
      console.log(`[Audio] Writing native chunk ${this.nativeChunkCount}, ${sampleCount} samples`)
      
      // Write chunk to disk via Rust using base64 (memory efficient)
      const startTime = performance.now()
      try {
        await audioWriteChunk(int16Data)
      } catch (writeErr) {
        console.error("[Audio] audioWriteChunk failed:", writeErr)
      }
      const elapsed = performance.now() - startTime
      console.log(`[Audio] Chunk written in ${elapsed.toFixed(0)}ms`)
      
      // Clear reference to help GC
      // Note: int16Data is a view, so clearing it doesn't affect the underlying buffer
      
      this.nativeChunkCount++
      this.generatedDuration += chunkDuration
      
      if (!this.hasReceivedFirstChunk) {
        this.hasReceivedFirstChunk = true
        console.log("[Audio] First native chunk received!")
        this.onStatusChange?.("Buffering (native mode)...")
      }
      
      const trackLength = useAppStore.getState().trackLength
      const NATIVE_BUFFER_CHUNKS = 15 // ~30 seconds buffer before playback
      
      // Log progress every chunk for debugging
      const percent = Math.round((this.generatedDuration / trackLength) * 100)
      console.log(`[Audio] Native: ${this.nativeChunkCount} chunks, ${this.generatedDuration.toFixed(1)}s (${percent}%)`)
      this.onStatusChange?.(`Generating: ${percent}%`)
      
      // Start native playback once we have enough buffer
      if (this.nativeChunkCount === NATIVE_BUFFER_CHUNKS && !this.isPlayingFromQueue) {
        console.log("[Audio] Native buffer ready, starting playback")
        this.isPlayingFromQueue = true
        this.onFirstAudioChunk?.()
        this.onStatusChange?.("Playing (native audio)...")
        useAppStore.getState().setHasCapturedAudio(true)
        
        try {
          await audioStartPlayback()
          this.startNativeStatusPolling()
        } catch (e) {
          console.error("[Audio] Failed to start native playback:", e)
          this.onError?.("Native playback failed: " + e)
        }
      }
    } catch (err) {
      console.error("[Audio] Error processing native audio chunk:", err)
    }
  }
  
  // Direct base64 handler - bypasses ALL JavaScript audio processing for maximum efficiency
  private handleAudioChunkBase64(base64Data: string): void {
    if (this.isStopped) {
      return
    }
    
    const estimatedDuration = (base64Data.length * 0.75) / 4 / 48000
    
    // Fire and forget - don't await to release the string reference immediately
    audioWriteChunkBase64(base64Data).catch(() => {})
    
    this.nativeChunkCount++
    this.generatedDuration += estimatedDuration
    
    if (!this.hasReceivedFirstChunk) {
      this.hasReceivedFirstChunk = true
      this.onStatusChange?.("Generating...")
    }
    
    const NATIVE_BUFFER_CHUNKS = 15
    
    // Update status only every 10 chunks to minimize React re-renders
    if (this.nativeChunkCount % 10 === 0) {
      const percent = Math.round((this.generatedDuration / this.nativeTrackLength) * 100)
      this.onStatusChange?.(`Generating: ${percent}%`)
    }
    
    // Start playback once we have enough buffer
    if (this.nativeChunkCount >= NATIVE_BUFFER_CHUNKS && !this.isPlayingFromQueue) {
      this.isPlayingFromQueue = true
      this.onFirstAudioChunk?.()
      this.onStatusChange?.("Playing...")
      useAppStore.getState().setHasCapturedAudio(true)
      
      // Delay playback start to ensure chunks are written
      setTimeout(() => {
        audioStartPlayback().then(() => {
          this.startNativeStatusPolling()
        }).catch(() => {})
      }, 500)
    }
  }
  
  private startNativeStatusPolling(): void {
    if (this.nativeStatusInterval) {
      clearInterval(this.nativeStatusInterval)
    }
    
    this.nativeStatusInterval = window.setInterval(async () => {
      try {
        const status = await audioGetStatus()
        
        // Update playback position for UI
        if (status.isPlaying) {
          this.lastPlayedTime = status.position
        }
        
        // Check if playback finished
        if (!status.isPlaying && this.isPlayingFromQueue) {
          console.log("[Audio] Native playback finished")
          this.stopNativeStatusPolling()
          this.onStatusChange?.("Playback complete")
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 250) // Poll every 250ms
  }
  
  private stopNativeStatusPolling(): void {
    if (this.nativeStatusInterval) {
      clearInterval(this.nativeStatusInterval)
      this.nativeStatusInterval = null
    }
  }
  
  // Rust generation status polling
  private startRustStatusPolling(): void {
    if (this.rustStatusInterval) {
      clearInterval(this.rustStatusInterval)
    }
    
    this.rustStatusInterval = window.setInterval(async () => {
      try {
        const status = await getRustGenerationStatus()
        console.log("[Rust Status]", status.state, status.chunks_received, "chunks,", status.duration_seconds.toFixed(1) + "s")
        
        // Update duration for UI
        this.generatedDuration = status.duration_seconds
        this.lastPlayedTime = status.duration_seconds
        
        // Update status with progress
        let statusText = ""
        if (status.state === "connecting") {
          statusText = "Connecting to Lyria API..."
        } else if (status.state === "connected") {
          statusText = "Connected - waiting for setup..."
        } else if (status.state === "buffering") {
          const percent = Math.round((status.chunks_received / 15) * 100)
          statusText = `Buffering: ${status.chunks_received}/15 chunks (${Math.min(percent, 100)}%)`
        } else if (status.state === "generating" || status.state === "playing") {
          const percent = Math.round((status.duration_seconds / this.nativeTrackLength) * 100)
          const remaining = Math.max(0, this.nativeTrackLength - status.duration_seconds)
          statusText = `Generating: ${status.duration_seconds.toFixed(0)}s / ${this.nativeTrackLength}s (${percent}%) - ${remaining.toFixed(0)}s remaining`
        } else if (status.state === "completed") {
          this.stopRustStatusPolling()
          statusText = "Generation complete - ready to save"
          useAppStore.getState().setHasCapturedAudio(true)
          useAppStore.getState().setIsGenerating(false)
        } else if (status.state === "error") {
          this.stopRustStatusPolling()
          statusText = `Error: ${status.error || "Generation failed"}`
          this.onError?.(status.error || "Generation failed")
          useAppStore.getState().setIsGenerating(false)
        } else {
          statusText = `Status: ${status.state}`
        }
        
        this.onStatusChange?.(statusText)
        useAppStore.getState().setConnectionStatus(statusText)
      } catch (e) {
        console.error("[Rust Status] Polling error:", e)
      }
    }, 500)
  }
  
  private stopRustStatusPolling(): void {
    if (this.rustStatusInterval) {
      clearInterval(this.rustStatusInterval)
      this.rustStatusInterval = null
    }
  }

  private isPlayingFromQueue = false

  private startContinuousPlayback(): void {
    if (!this.audioContext || !this.masterGain || this.isPlayingFromQueue) return
    
    this.isPlayingFromQueue = true
    this.isPlaying = true
    
    // If resuming after a pause/buffer, restore timeline
    if (this.lastPlayedTime > 0) {
      this.playbackStartTime = this.audioContext.currentTime - this.lastPlayedTime
    } else if (this.playbackStartTime === 0) {
      this.playbackStartTime = this.audioContext.currentTime
    }
    
    this.nextPlayTime = this.audioContext.currentTime
    
    this.startAnalyzerLoop()
    this.scheduleNextChunks()
    
    // Start periodic cleanup to prevent memory buildup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cleanupInterval = window.setInterval(() => {
      this.performMemoryCleanup()
    }, 5000) // Run every 5 seconds
  }
  
  private performMemoryCleanup(): void {
    if (!this.audioContext) return
    
    const now = this.audioContext.currentTime
    
    // Clean up finished scheduled buffers
    const beforeCount = this.scheduledBuffers.length
    this.scheduledBuffers = this.scheduledBuffers.filter(source => {
      try {
        const endTime = (source as any)._endTime || 0
        if (now > endTime + 0.5) {
          try { source.disconnect() } catch {}
          return false
        }
        return true
      } catch {
        return false
      }
    })
    
    // Only log if we cleaned something and it's significant
    const cleaned = beforeCount - this.scheduledBuffers.length
    if (cleaned > 5) {
      console.log(`[Audio] Cleanup: removed ${cleaned} finished buffers`)
    }
  }

  private scheduleNextChunks(): void {
    if (!this.audioContext || !this.masterGain || !this.isPlayingFromQueue || this.isStopped) return
    
    const currentTime = this.audioContext.currentTime
    const trackLength = useAppStore.getState().trackLength
    
    // Stop scheduling if we already have enough audio for the target duration
    // Account for what's already scheduled plus what's in queue
    const scheduledDuration = this.lastScheduledEndTime > 0 
      ? this.lastScheduledEndTime - this.playbackStartTime 
      : 0
    
    if (trackLength > 0 && scheduledDuration >= trackLength + 4) {
      // Already have enough scheduled, don't schedule more
      return
    }
    
    // Cleanup finished buffers - more aggressive for long tracks
    const MAX_SCHEDULED_BUFFERS = 10  // Reduced from 20
    const now = this.audioContext.currentTime
    
    // Force cleanup of old buffers
    this.scheduledBuffers = this.scheduledBuffers.filter(source => {
      try {
        const endTime = (source as any)._endTime || 0
        if (now > endTime + 0.5) {  // Cleanup sooner (was +1)
          try { source.disconnect() } catch {}
          return false
        }
        return true
      } catch {
        return false
      }
    })
    
    if (this.scheduledBuffers.length >= MAX_SCHEDULED_BUFFERS) {
      return
    }
    
    while (this.audioQueue.length > 0 && !this.isStopped) {
      // Check again if we have enough scheduled
      const currentScheduledDuration = this.lastScheduledEndTime > 0 
        ? this.lastScheduledEndTime - this.playbackStartTime 
        : 0
      if (trackLength > 0 && currentScheduledDuration >= trackLength + 4) {
        break
      }
      
      const buffer = this.audioQueue.shift()!
      
      // If we've fallen behind, jump forward in schedule
      if (this.nextPlayTime < currentTime) {
        const gap = currentTime - this.nextPlayTime
        // Only log significant gaps (> 2s) to reduce console pressure
        if (gap > 2) {
          console.log(`[Audio] GAP: ${gap.toFixed(1)}s`)
        }
        this.nextPlayTime = currentTime
      }
      
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.masterGain)
      source.start(this.nextPlayTime)
      
      const endTime = this.nextPlayTime + buffer.duration
      ;(source as any)._endTime = endTime
      
      // Only log every 20th chunk to reduce memory pressure
      this.chunkCount = (this.chunkCount || 0) + 1
      if (this.chunkCount % 20 === 1) {
        console.log(`[Audio] Scheduled chunk ${this.chunkCount}: ${this.nextPlayTime.toFixed(1)}s`)
      }
      
      this.nextPlayTime += buffer.duration
      this.lastScheduledEndTime = this.nextPlayTime
      this.scheduledBuffers.push(source)
      
      source.onended = () => {
        const idx = this.scheduledBuffers.indexOf(source)
        if (idx > -1) {
          try { source.disconnect() } catch {}
          this.scheduledBuffers.splice(idx, 1)
        }
      }
      
      if (this.scheduledBuffers.length >= MAX_SCHEDULED_BUFFERS) break
    }
  }

  private drainQueue(): void {
    this.scheduleNextChunks()
  }

  private playNextInQueue(): void {}
  private schedulePlayback(): void {}

  async start(): Promise<void> {
    const selectedModel = useAppStore.getState().selectedModel
    const trackLength = useAppStore.getState().trackLength
    
    console.log("[Audio] start() called - model:", selectedModel, "trackLength:", trackLength)
    
    if (!this.audioContext) {
      console.log("[Audio] No audio context, returning")
      return
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    for (const source of this.scheduledBuffers) {
      try {
        source.stop()
      } catch {}
    }
    this.scheduledBuffers = []
    this.audioQueue = []
    this.recordedChunks = []
    this.hasReceivedFirstChunk = false
    this.isPlayingFromQueue = false
    this.generatedDuration = 0
    this.playbackStartTime = 0
    this.lastPlayedTime = 0
    this.lastScheduledEndTime = 0
    this.isRebuffering = false
    
    // Rust generation disabled - limited to 2 minutes which works with JavaScript
    this.useRustGeneration = false
    
    // Native audio disabled - use standard Web Audio API for all tracks up to 2 minutes
    this.useNativeAudio = false
    this.nativeChunkCount = 0
    this.nativeTrackLength = trackLength
    
    // Clear Rust native storage for fresh recording
    try {
      await audioClear()
    } catch (e) {
      console.warn("[Audio] Failed to clear native storage:", e)
    }
    
    // Clear any native audio handler - use standard chunk processing
    if (this.lyriaClient) {
      this.lyriaClient.setOnAudioChunkBase64(null)
    }

    this.isPlaying = true
    this.isPaused = false
    this.isStopped = false
    this.nextPlayTime = this.audioContext.currentTime
    this.chunkCounter = 0
    useAppStore.getState().setHasCapturedAudio(false)

    debugLog.checkpoint(`Starting ${trackLength}s track generation`)

    if (selectedModel === "musicgen") {
      if (!this.musicgenClient) {
        debugLog.error("MusicGen client not available")
        return
      }

      const state = useAppStore.getState()
      const prompt = state.prompts.map(p => p.text).join(", ")
      
      debugLog.info(`MusicGen: prompt="${prompt.substring(0, 50)}...", duration=${state.trackLength}s`)
      
      await this.musicgenClient.generate({
        prompt,
        duration: state.trackLength,
        modelSize: state.musicgenModelSize,
        huggingFaceToken: state.huggingFaceToken || undefined,
      })
    } else {
      if (!this.lyriaClient) {
        debugLog.error("Lyria client not available")
        return
      }
      
      const config = buildConfigFromStore()
      debugLog.info(`Lyria: starting generation with config`)
      await this.lyriaClient.startGeneration(config)
    }
  }

  async pause(): Promise<void> {
    if (!this.lyriaClient) return
    
    this.isPaused = true
    await this.lyriaClient.pause()
    this.onStatusChange?.("Paused")
  }

  async resume(): Promise<void> {
    if (!this.lyriaClient || !this.audioContext) return
    
    this.isPaused = false
    this.nextPlayTime = this.audioContext.currentTime
    await this.lyriaClient.resume()
    this.schedulePlayback()
  }

  async stopGeneration(): Promise<void> {
    // Stop API generation and prevent new chunks from being scheduled
    // But let already-scheduled audio buffers continue playing
    this.isStopped = true  // Prevent new chunks from being scheduled
    
    // Stop Rust generation if active
    if (this.useRustGeneration) {
      this.stopRustStatusPolling()
      try {
        await stopRustGeneration()
      } catch (e) {}
    }
    
    if (this.lyriaClient) {
      this.lyriaClient.stopGeneration()
    }
    if (this.musicgenClient) {
      this.musicgenClient.stop()
    }
    this.onStatusChange?.("Finishing playback...")
  }

  async stop(): Promise<void> {
    this.isPlaying = false
    this.isPaused = false
    this.isStopped = true  // Prevent new chunks from triggering playback
    this.isPlayingFromQueue = false
    this.isRebuffering = false
    this.lastScheduledEndTime = 0  // Reset so analyzer loop knows to stop
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // Stop Rust generation if active
    if (this.useRustGeneration) {
      this.stopRustStatusPolling()
      try {
        await stopRustGeneration()
      } catch (e) {}
    }
    
    // Stop native audio if active
    if (this.useNativeAudio) {
      this.stopNativeStatusPolling()
      try {
        await audioStopPlayback()
      } catch (e) {
        console.warn("[Audio] Failed to stop native playback:", e)
      }
    }
    
    await this.stopGeneration()

    // Stop scheduled audio
    for (const source of this.scheduledBuffers) {
      try {
        source.stop()
        source.disconnect()
      } catch {}
    }
    this.scheduledBuffers = []
    this.audioQueue = []

    this.stopAnalyzerLoop()
  }

  // Force stop - cleanup but let scheduled audio finish naturally
  async forceStop(): Promise<void> {
    // Set stopped flag FIRST to prevent any new processing
    this.isStopped = true
    // DON'T set isPlaying = false yet - keep analyzer running for scheduled audio
    this.isPaused = false
    this.isPlayingFromQueue = false
    this.isRebuffering = false
    this.hasReceivedFirstChunk = false
    this.chunkCount = 0
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // Stop native audio if active
    if (this.useNativeAudio) {
      this.stopNativeStatusPolling()
      try {
        await audioStopPlayback()
      } catch (e) {
        console.warn("[Audio] Failed to stop native playback:", e)
      }
    }
    
    // Stop API generation
    if (this.lyriaClient) {
      this.lyriaClient.stopGeneration()
    }
    if (this.musicgenClient) {
      this.musicgenClient.stop()
    }
    
    // DON'T stop scheduled audio sources - let them finish naturally
    // Only clear references after they would have finished
    // The onended callbacks will clean them up
    
    // Clear queues (unscheduled audio)
    this.audioQueue = []
    
    // Stop analyzer and cleanup AFTER scheduled audio finishes
    const timeUntilEnd = this.lastScheduledEndTime > 0 && this.audioContext
      ? Math.max(0, this.lastScheduledEndTime - this.audioContext.currentTime + 1)
      : 3
    
    setTimeout(() => {
      if (this.isStopped) {
        this.isPlaying = false  // NOW stop the analyzer
        this.stopAnalyzerLoop()
        this.scheduledBuffers = []
        this.lastScheduledEndTime = 0
        useAppStore.getState().setAnalyzerData(null)
        useAppStore.getState().setWaveformData(null)
      }
    }, timeUntilEnd * 1000)
    
    // Don't emit "Stopped" here - useAudioEngine manages status flow
  }

  async updateConfig(): Promise<void> {
    if (!this.lyriaClient || !this.isPlaying) return
    const config = buildConfigFromStore()
    await this.lyriaClient.startGeneration(config)
  }

  startRecording(): void {
    this.recordedChunks = []
    this.isRecording = true
  }

  stopRecording(): Float32Array {
    this.isRecording = false
    return this.getCapturedAudio()
  }

  getCapturedAudio(): Float32Array {
    // In pre-generate mode, convert from audioQueue if recordedChunks is empty
    const preGenMode = useAppStore.getState().preGenerateMode
    if (preGenMode && this.recordedChunks.length === 0 && this.audioQueue.length > 0) {
      console.log("[Audio] Converting audioQueue to recorded format for saving...")
      // Convert audioQueue to mono Float32Array
      for (const audioBuffer of this.audioQueue) {
        const samplesPerChannel = audioBuffer.length
        const monoData = new Float32Array(samplesPerChannel)
        const leftChannel = audioBuffer.getChannelData(0)
        const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel
        for (let i = 0; i < samplesPerChannel; i++) {
          monoData[i] = (leftChannel[i] + rightChannel[i]) / 2
        }
        this.recordedChunks.push(monoData)
      }
      useAppStore.getState().setHasCapturedAudio(true)
      console.log(`[Audio] Converted ${this.audioQueue.length} chunks for saving`)
    }
    
    const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    
    for (const chunk of this.recordedChunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return result
  }

  clearCapturedAudio(): void {
    this.recordedChunks = []
    this.nativeChunkCount = 0
    // Also clear native storage
    audioClear().catch(e => console.warn("[Audio] Failed to clear native storage:", e))
    useAppStore.getState().setHasCapturedAudio(false)
  }

  hasCapturedAudio(): boolean {
    return this.recordedChunks.length > 0 || this.nativeChunkCount > 0
  }

  hasNativeAudio(): boolean {
    return this.nativeChunkCount > 0
  }

  getNativeChunkCount(): number {
    return this.nativeChunkCount
  }

  async exportNativeAudio(outputPath: string): Promise<void> {
    await audioExport(outputPath)
  }

  async playbackCapturedAudio(): Promise<void> {
    // If we have native audio chunks, fetch them and play through Web Audio for visualizer
    if (this.nativeChunkCount > 0) {
      console.log(`[Audio] Fetching native audio (${this.nativeChunkCount} chunks) for Web Audio playback`)
      
      if (!this.audioContext || !this.masterGain) {
        await this.initialize()
      }
      
      if (this.audioContext?.state === "suspended") {
        await this.audioContext.resume()
      }
      
      try {
        useAppStore.getState().setConnectionStatus("Loading audio...")
        
        // Fetch audio samples from Rust
        const int16Samples = await audioGetSamples()
        console.log(`[Audio] Got ${int16Samples.length} samples from Rust`)
        
        // Convert to stereo AudioBuffer
        const numChannels = 2
        const samplesPerChannel = int16Samples.length / numChannels
        const audioBuffer = this.audioContext!.createBuffer(numChannels, samplesPerChannel, 48000)
        
        for (let channel = 0; channel < numChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel)
          for (let i = 0; i < samplesPerChannel; i++) {
            channelData[i] = int16Samples[i * numChannels + channel] / 32768
          }
        }
        
        // Play through Web Audio with analyzer
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer
        if (this.analyser) {
          source.connect(this.analyser)
        }
        source.connect(this.masterGain!)
        source.start()
        
        this.playbackSource = source
        this.isPlayingBack = true
        this.playbackStartTime = this.audioContext!.currentTime
        this.lastScheduledEndTime = this.audioContext!.currentTime + audioBuffer.duration
        
        useAppStore.getState().setElapsedTime(0)
        useAppStore.getState().setConnectionStatus("Playing preview...")
        this.startAnalyzerLoop()
        
        // Update elapsed time during preview playback
        const duration = audioBuffer.duration
        const updateInterval = setInterval(() => {
          if (!this.isPlayingBack || !this.audioContext) {
            clearInterval(updateInterval)
            return
          }
          const elapsed = this.audioContext.currentTime - this.playbackStartTime
          useAppStore.getState().setElapsedTime(Math.min(elapsed, duration))
        }, 100)
        
        source.onended = () => {
          clearInterval(updateInterval)
          this.isPlayingBack = false
          this.playbackSource = null
          this.playbackStartTime = 0
          this.lastScheduledEndTime = 0
          this.stopAnalyzerLoop()
          useAppStore.getState().setElapsedTime(0)
          useAppStore.getState().setConnectionStatus("Preview complete")
        }
        
        return
      } catch (e) {
        console.error("[Audio] Failed to load native audio for preview:", e)
        useAppStore.getState().setConnectionStatus("Preview failed")
        // Fall through to try JS playback if native fails
      }
    }
    
    // Fall back to JavaScript-based playback using recordedChunks
    if (!this.audioContext || !this.masterGain || this.recordedChunks.length === 0) {
      console.log("[Audio] No audio data available for preview")
      return
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume()
    }

    const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const audioBuffer = this.audioContext.createBuffer(1, totalLength, 48000)
    const channelData = audioBuffer.getChannelData(0)
    
    let offset = 0
    for (const chunk of this.recordedChunks) {
      channelData.set(chunk, offset)
      offset += chunk.length
    }

    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    if (this.analyser) {
      source.connect(this.analyser)
    }
    source.connect(this.masterGain)
    source.start()
    
    this.playbackSource = source
    this.isPlayingBack = true
    this.playbackStartTime = this.audioContext.currentTime
    this.lastScheduledEndTime = this.audioContext.currentTime + audioBuffer.duration
    this.startAnalyzerLoop()
    
    // Reset elapsed time in store
    useAppStore.getState().setElapsedTime(0)
    
    // Update elapsed time during preview playback
    const duration = audioBuffer.duration
    const updateInterval = setInterval(() => {
      if (!this.isPlayingBack || !this.audioContext) {
        clearInterval(updateInterval)
        return
      }
      const elapsed = this.audioContext.currentTime - this.playbackStartTime
      useAppStore.getState().setElapsedTime(Math.min(elapsed, duration))
    }, 100)
    
    source.onended = () => {
      clearInterval(updateInterval)
      this.isPlayingBack = false
      this.playbackSource = null
      this.playbackStartTime = 0
      this.lastScheduledEndTime = 0
      this.stopAnalyzerLoop()
      useAppStore.getState().setElapsedTime(0)
    }
  }

  stopPlayback(): void {
    // Stop native playback if active
    if (this.nativeChunkCount > 0) {
      audioStopPlayback().catch(() => {})
      this.stopNativeStatusPolling()
    }
    
    // Stop JS playback if active
    if (this.playbackSource) {
      try {
        this.playbackSource.stop()
      } catch {}
      this.playbackSource = null
    }
    this.isPlayingBack = false
    this.playbackStartTime = 0
    this.lastScheduledEndTime = 0
    this.stopAnalyzerLoop()
    useAppStore.getState().setElapsedTime(0)
  }

  getIsPlayingBack(): boolean {
    return this.isPlayingBack
  }

  async loadVocalTrack(track: VocalTrack): Promise<void> {
    if (!this.audioContext || !this.masterGain || !track.file) return

    const arrayBuffer = await track.file.arrayBuffer()
    await this.audioContext.decodeAudioData(arrayBuffer)

    const gain = this.audioContext.createGain()
    const pan = this.audioContext.createStereoPanner()

    gain.gain.value = track.volume
    pan.pan.value = track.pan

    gain.connect(pan)
    pan.connect(this.masterGain)

    this.vocalNodes.set(track.id, { source: null, gain, pan })
  }

  playVocalTrack(trackId: string): void {
    const nodes = this.vocalNodes.get(trackId)
    if (!nodes || !this.audioContext) return

    const track = useAppStore.getState().vocalTracks.find((t) => t.id === trackId)
    if (!track?.file) return

    track.file.arrayBuffer().then((arrayBuffer) => {
      this.audioContext!.decodeAudioData(arrayBuffer).then((audioBuffer) => {
        const source = this.audioContext!.createBufferSource()
        source.buffer = audioBuffer
        source.connect(nodes.gain)
        source.start()
        nodes.source = source
      })
    })
  }

  stopVocalTrack(trackId: string): void {
    const nodes = this.vocalNodes.get(trackId)
    if (nodes?.source) {
      try {
        nodes.source.stop()
      } catch {}
      nodes.source = null
    }
  }

  updateVocalTrack(trackId: string, volume: number, pan: number): void {
    const nodes = this.vocalNodes.get(trackId)
    if (nodes) {
      nodes.gain.gain.value = volume
      nodes.pan.pan.value = pan
    }
  }

  private startAnalyzerLoop(): void {
    if (!this.analyser) return

    // Reuse these arrays - NEVER create new ones during the loop
    const analyzerData = new Float32Array(this.analyser.frequencyBinCount)
    const waveformData = new Float32Array(this.analyser.fftSize)
    let lastLoopTime = 0
    const LOOP_INTERVAL = 100 // Run at 10fps to save memory
    const startTime = Date.now()
    const MAX_VISUALIZER_DURATION = 120000 // Disable visualizer after 2 minutes

    const loop = () => {
      // Throttle the entire loop
      const now = performance.now()
      if (now - lastLoopTime < LOOP_INTERVAL) {
        this.animationFrame = requestAnimationFrame(loop)
        return
      }
      lastLoopTime = now
      
      // In pre-generate mode, disable visualizer during buffering to save memory
      const preGenMode = useAppStore.getState().preGenerateMode
      if (preGenMode && !this.isPlayingFromQueue) {
        // Don't update visualizer while buffering - save memory
        this.animationFrame = requestAnimationFrame(loop)
        return
      }
      
      // Continue analyzer as long as there's audio scheduled to play
      const gracePeriod = 5
      const hasScheduledAudio = this.audioContext && this.lastScheduledEndTime > 0 && 
        this.audioContext.currentTime < this.lastScheduledEndTime + gracePeriod
      
      // Only exit if stopped AND no scheduled audio remaining
      if (this.isStopped && !this.isPlayingBack && !hasScheduledAudio) {
        return
      }
      
      if ((!this.isPlaying && !this.isPlayingBack && !hasScheduledAudio) || !this.analyser) {
        return
      }

      // Disable visualizer updates after 2 minutes to save memory
      const elapsed = Date.now() - startTime
      if (elapsed < MAX_VISUALIZER_DURATION) {
        this.analyser.getFloatFrequencyData(analyzerData)
        this.analyser.getFloatTimeDomainData(waveformData)

        // Update store directly with reused arrays
        const store = useAppStore.getState()
        store.setAnalyzerData(analyzerData)
        store.setWaveformData(waveformData)
      } else if (elapsed < MAX_VISUALIZER_DURATION + 1000) {
        // Clear visualizer data once after timeout
        const store = useAppStore.getState()
        store.setAnalyzerData(null)
        store.setWaveformData(null)
        console.log("[Audio] Visualizer disabled to save memory (2 min limit)")
      }

      this.animationFrame = requestAnimationFrame(loop)
    }

    loop()
  }

  private stopAnalyzerLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    useAppStore.getState().setAnalyzerData(null)
    useAppStore.getState().setWaveformData(null)
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  isConnected(): boolean {
    const selectedModel = useAppStore.getState().selectedModel
    if (selectedModel === "musicgen") {
      return this.musicgenClient !== null
    }
    return this.lyriaClient?.isConnected() ?? false
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getIsPaused(): boolean {
    return this.isPaused
  }

  getGeneratedDuration(): number {
    return this.generatedDuration
  }

  getPlaybackTime(): number {
    if (!this.audioContext) return 0
    if (this.playbackStartTime === 0) return 0
    
    const trackLength = useAppStore.getState().trackLength
    const rawTime = Math.max(0, this.audioContext.currentTime - this.playbackStartTime)
    
    // Cap at track length to prevent going over
    if (trackLength > 0) {
      return Math.min(rawTime, trackLength)
    }
    return rawTime
  }

  async isPlaybackCompleteAsync(): Promise<boolean> {
    // In native/pre-generate mode, check Rust playback status
    const preGenMode = useAppStore.getState().preGenerateMode
    if (preGenMode && this.nativeChunkCount > 0) {
      try {
        const status = await audioGetStatus()
        // Not complete if Rust is still playing
        return !status.isPlaying
      } catch {
        // If we can't get status, assume complete
        return true
      }
    }
    
    // For Web Audio mode (short tracks)
    if (!this.audioContext) return true
    if (this.lastScheduledEndTime === 0) return true
    // Playback is complete when current time has passed all scheduled audio
    // Add 2s buffer to ensure audio has fully finished (accounts for gaps)
    return this.audioContext.currentTime >= this.lastScheduledEndTime + 2.0
  }
  
  isPlaybackComplete(): boolean {
    // Synchronous version for backward compatibility
    // Note: Does not accurately reflect native playback state
    const preGenMode = useAppStore.getState().preGenerateMode
    if (preGenMode && this.nativeChunkCount > 0) {
      // In pre-generate mode, can't check synchronously - return false to keep polling
      return false
    }
    
    if (!this.audioContext) return true
    if (this.lastScheduledEndTime === 0) return true
    return this.audioContext.currentTime >= this.lastScheduledEndTime + 2.0
  }

  isGenerationStopped(): boolean {
    return this.isStopped
  }

  async disconnect(): Promise<void> {
    await this.stop()
    this.lyriaClient?.disconnect()
    this.audioContext?.close()
    this.audioContext = null
    this.masterGain = null
    this.analyser = null
  }

  // Playback quality testing
  startPlaybackTest(onUpdate?: (status: string) => void): void {
    if (!this.audioContext || !this.masterGain) {
      onUpdate?.("Cannot start test - no audio context")
      return
    }

    this.playbackTester = new PlaybackTester({
      silenceThreshold: 0.005,
      gapThreshold: 0.2,
      onUpdate
    })

    this.playbackTester.start(this.audioContext, this.masterGain)
    console.log("[Test] Playback quality test started")
  }

  stopPlaybackTest(): PlaybackTestResult | null {
    if (!this.playbackTester) {
      return null
    }

    const result = this.playbackTester.stop()
    console.log("[Test] Playback test result:", result)
    this.playbackTester = null
    return result
  }

  getPlaybackTestStatus(): { running: boolean; elapsed: number; gapCount: number } | null {
    return this.playbackTester?.getStatus() ?? null
  }
}

let engineInstance: AudioEngine | null = null

export function getAudioEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine()
  }
  return engineInstance
}

// Export test types
export type { PlaybackTestResult } from "./playback-test"

// Expose test functions to window for console access
if (typeof window !== "undefined") {
  (window as any).startPlaybackTest = () => {
    const engine = getAudioEngine()
    engine.startPlaybackTest((msg) => console.log(`[PlaybackTest] ${msg}`))
    return "Playback test started. Use stopPlaybackTest() to get results."
  }
  
  (window as any).stopPlaybackTest = () => {
    const engine = getAudioEngine()
    const result = engine.stopPlaybackTest()
    if (result) {
      console.log("=== PLAYBACK TEST RESULTS ===")
      console.log(`Status: ${result.passed ? "PASSED ✓" : "FAILED ✗"}`)
      console.log(`Duration: ${result.totalDuration.toFixed(1)}s`)
      console.log(`Gaps detected: ${result.gapCount}`)
      console.log(`Stutters: ${result.stutterCount}`)
      if (result.gaps.length > 0) {
        console.log("Gap details:")
        result.gaps.forEach((g, i) => {
          console.log(`  ${i + 1}. At ${g.timestamp.toFixed(1)}s - ${g.duration.toFixed(2)}s duration`)
        })
      }
      return result
    }
    return "No test running"
  }
  
  (window as any).getTestStatus = () => {
    const engine = getAudioEngine()
    return engine.getPlaybackTestStatus() ?? "No test running"
  }
}
