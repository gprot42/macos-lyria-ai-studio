import { useCallback, useEffect, useRef, useState } from "react"
import { getAudioEngine, AudioEngine } from "@/lib/audio-engine"
import { useAppStore } from "@/stores/app-store"

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null)
  const engineInitialized = useRef(false)
  const [isPaused, setIsPaused] = useState(false)
  const generationIdRef = useRef(0)  // Incremented each generation to prevent stale interval callbacks
  
  const {
    isGenerating,
    isRecording,
    isConnecting,
    connectionStatus,
    connectionError,
    apiKey,
    setIsGenerating,
    setIsRecording,
    setIsConnecting,
    setConnectionStatus,
    setConnectionError,
    setElapsedTime,
  } = useAppStore()

  const elapsedIntervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const isMountedRef = useRef(false)

  useEffect(() => {
    if (!engineInitialized.current) {
      engineRef.current = getAudioEngine()
      engineRef.current.setOnStatusChange((s) => {
        useAppStore.getState().setConnectionStatus(s)
      })
      engineRef.current.setOnError((e) => {
        useAppStore.getState().setConnectionError(e)
      })
      engineRef.current.setOnFirstAudioChunk(() => {
        const store = useAppStore.getState()
        
        if (elapsedIntervalRef.current) {
          return
        }
        
        // Capture current generation ID to detect stale callbacks
        const currentGenId = generationIdRef.current
        
        startTimeRef.current = Date.now()
        store.setElapsedTime(0)
        store.setIsGenerating(true)
        store.setConnectionStatus("Generating & recording...")
        
        elapsedIntervalRef.current = window.setInterval(async () => {
          // Skip if generation ID changed (new generation started)
          if (generationIdRef.current !== currentGenId) {
            console.log("[useAudioEngine] Stale interval detected, skipping")
            return
          }
          
          if (!engineRef.current) return
          
          const currentStore = useAppStore.getState()
          const trackLen = currentStore.trackLength
          
          // Use real playback time from engine (handles buffering/gaps correctly)
          const elapsed = engineRef.current.getPlaybackTime() || 0
          const generated = engineRef.current.getGeneratedDuration() || 0
          
          // Batch update to reduce re-renders
          if (Math.abs(elapsed - currentStore.elapsedTime) > 0.2) {
            currentStore.setElapsedTime(Math.min(elapsed, trackLen))
          }
          
          // Check generated duration - stop API when enough is generated
          // But keep isGenerating=true so visualizer continues until playback finishes
          if (trackLen > 0 && generated >= trackLen && !engineRef.current.isGenerationStopped()) {
            console.log("[useAudioEngine] Target duration generated, stopping API only")
            await engineRef.current.stopGeneration()
            // DON'T set isGenerating=false here - keep visualizer running
            useAppStore.getState().setConnectionStatus("Finishing playback...")
          }
          
          // Check if playback should stop - ONLY when audio actually finishes
          // Don't stop just because elapsed >= trackLen (there may still be scheduled audio)
          // For pre-generate mode, use async check to poll Rust playback status
          const playbackComplete = await engineRef.current.isPlaybackCompleteAsync()
          const generationStopped = engineRef.current.isGenerationStopped()
          
          // Only consider stopping if generation is stopped AND playback is done
          // AND we've had some audio play (elapsed > 0 or generated > 0)
          const hasHadAudio = elapsed > 0 || generated > 0
          const shouldStop = generationStopped && playbackComplete && hasHadAudio
          
          if (shouldStop) {
            // Double-check we're still the current generation
            if (generationIdRef.current !== currentGenId) return
            
            console.log("[useAudioEngine] Playback complete, elapsed:", elapsed.toFixed(1))
            if (elapsedIntervalRef.current) {
              clearInterval(elapsedIntervalRef.current)
              elapsedIntervalRef.current = null
            }
            await engineRef.current.forceStop()
            useAppStore.getState().setIsGenerating(false)  // NOW set to false
            useAppStore.getState().setElapsedTime(trackLen)
            useAppStore.getState().setConnectionStatus("Complete")
          }
        }, 250) // Reduced from 100ms to 250ms for performance
      })
      engineInitialized.current = true
    }
    isMountedRef.current = true
    
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
      // Only disconnect on actual unmount, not StrictMode double-invoke
      // Check if we're actually navigating away
      setTimeout(() => {
        if (!isMountedRef.current) {
          engineRef.current?.disconnect()
        }
      }, 100)
      isMountedRef.current = false
    }
  }, [])

  const connect = useCallback(async () => {
    const selectedModel = useAppStore.getState().selectedModel
    
    // MusicGen doesn't require an API key
    if (selectedModel !== "musicgen" && !apiKey) {
      setConnectionError("API key is required for Lyria models")
      return
    }

    if (!engineRef.current) {
      setConnectionError("Audio engine not initialized")
      return
    }

    setIsConnecting(true)
    setConnectionError(null)
    setConnectionStatus("Connecting...")

    try {
      await engineRef.current.connect(apiKey || "")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed"
      setConnectionError(errorMsg)
    } finally {
      setIsConnecting(false)
    }
  }, [apiKey, setIsConnecting, setConnectionError, setConnectionStatus])

  const play = useCallback(async () => {
    // Increment generation ID to invalidate any stale interval callbacks
    generationIdRef.current++
    console.log("[useAudioEngine] Starting new generation, id:", generationIdRef.current)
    
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }

    // Connect if not already connected
    if (!engineRef.current?.isConnected()) {
      await connect()
    }

    setElapsedTime(0)
    setConnectionError(null)
    setIsPaused(false)
    
    try {
      await engineRef.current?.start()
      setIsGenerating(true)

      // For Lyria models, timer is started by onFirstAudioChunk callback
      // For MusicGen, start timer immediately since audio comes faster
      const selectedModel = useAppStore.getState().selectedModel
      if (selectedModel === "musicgen") {
        startTimeRef.current = Date.now()
        elapsedIntervalRef.current = window.setInterval(async () => {
          const store = useAppStore.getState()
          const elapsed = (Date.now() - startTimeRef.current) / 1000
          const trackLen = store.trackLength
          
          if (trackLen > 0 && elapsed >= trackLen) {
            useAppStore.getState().setElapsedTime(trackLen)
            if (elapsedIntervalRef.current) {
              clearInterval(elapsedIntervalRef.current)
              elapsedIntervalRef.current = null
            }
            console.log("[useAudioEngine] Track length reached, stopping generation")
            await engineRef.current?.stop()
            useAppStore.getState().setIsGenerating(false)
            useAppStore.getState().setConnectionStatus("Generation complete")
          } else {
            useAppStore.getState().setElapsedTime(elapsed)
          }
        }, 100)
      }
      // For Lyria: timer starts when first audio chunk arrives (via onFirstAudioChunk callback)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to start generation"
      setConnectionError(errorMsg)
    }
  }, [connect, setIsGenerating, setElapsedTime, setConnectionError])

  const pause = useCallback(async () => {
    try {
      await engineRef.current?.pause()
      setIsPaused(true)
      
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
    } catch (err) {
      console.error("Failed to pause:", err)
    }
  }, [])

  const resume = useCallback(async () => {
    try {
      await engineRef.current?.resume()
      setIsPaused(false)
      
      const pausedTime = useAppStore.getState().elapsedTime
      startTimeRef.current = Date.now() - pausedTime * 1000
      elapsedIntervalRef.current = window.setInterval(() => {
        const store = useAppStore.getState()
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const trackLen = store.trackLength
        
        if (trackLen > 0 && elapsed >= trackLen) {
          useAppStore.getState().setElapsedTime(trackLen)
          if (elapsedIntervalRef.current) {
            clearInterval(elapsedIntervalRef.current)
            elapsedIntervalRef.current = null
          }
        } else {
          useAppStore.getState().setElapsedTime(elapsed)
        }
      }, 100)
    } catch (err) {
      console.error("Failed to resume:", err)
    }
  }, [])

  const stop = useCallback(async () => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }

    try {
      await engineRef.current?.forceStop()
    } catch (err) {
      console.error("Failed to stop:", err)
    }
    
    setIsGenerating(false)
    setIsPaused(false)
    setConnectionStatus(null)
  }, [setIsGenerating, setConnectionStatus])

  const togglePlay = useCallback(async () => {
    if (isGenerating) {
      if (isPaused) {
        await resume()
      } else {
        await pause()
      }
    } else {
      await play()
    }
  }, [isGenerating, isPaused, play, pause, resume])

  const startRecording = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }

    engineRef.current?.startRecording()
    setIsRecording(true)
    setElapsedTime(0)
    
    startTimeRef.current = Date.now()
    elapsedIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      setElapsedTime(elapsed)
    }, 100)
  }, [setIsRecording, setElapsedTime])

  const stopRecording = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }

    const audioData = engineRef.current?.stopRecording()
    setIsRecording(false)
    return audioData
  }, [setIsRecording])

  const getCapturedAudio = useCallback(() => {
    return engineRef.current?.getCapturedAudio()
  }, [])

  const clearCapturedAudio = useCallback(() => {
    engineRef.current?.clearCapturedAudio()
  }, [])

  const playbackCapturedAudio = useCallback(async () => {
    await engineRef.current?.playbackCapturedAudio()
  }, [])

  const stopPlayback = useCallback(() => {
    engineRef.current?.stopPlayback()
  }, [])

  const getIsPlayingBack = useCallback(() => {
    return engineRef.current?.getIsPlayingBack() ?? false
  }, [])

  const updateConfig = useCallback(async () => {
    await engineRef.current?.updateConfig()
  }, [])

  return {
    isConnecting,
    isGenerating,
    isRecording,
    isPaused,
    error: connectionError,
    status: connectionStatus,
    connect,
    play,
    pause,
    resume,
    stop,
    togglePlay,
    startRecording,
    stopRecording,
    getCapturedAudio,
    clearCapturedAudio,
    playbackCapturedAudio,
    stopPlayback,
    getIsPlayingBack,
    updateConfig,
    engine: engineRef.current,
  }
}
