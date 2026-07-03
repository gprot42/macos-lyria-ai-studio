/**
 * Automated playback quality test
 * Monitors audio playback for gaps, stutters, and interruptions
 */

export interface PlaybackTestResult {
  passed: boolean
  totalDuration: number
  gapCount: number
  gaps: { timestamp: number; duration: number }[]
  stutterCount: number
  errorMessage?: string
}

export class PlaybackTester {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private startTime = 0
  private lastAudioTime = 0
  private gaps: { timestamp: number; duration: number }[] = []
  private stutterCount = 0
  private isRunning = false
  private checkInterval: number | null = null
  private silenceThreshold = 0.01
  private gapThreshold = 0.3 // seconds of silence to count as gap
  private consecutiveSilentFrames = 0
  private onUpdate?: (status: string) => void
  private onComplete?: (result: PlaybackTestResult) => void

  constructor(options?: {
    silenceThreshold?: number
    gapThreshold?: number
    onUpdate?: (status: string) => void
    onComplete?: (result: PlaybackTestResult) => void
  }) {
    this.silenceThreshold = options?.silenceThreshold ?? 0.01
    this.gapThreshold = options?.gapThreshold ?? 0.3
    this.onUpdate = options?.onUpdate
    this.onComplete = options?.onComplete
  }

  async start(audioContext: AudioContext, sourceNode: AudioNode): Promise<void> {
    this.audioContext = audioContext
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = 256
    
    sourceNode.connect(this.analyser)
    
    this.startTime = audioContext.currentTime
    this.lastAudioTime = this.startTime
    this.gaps = []
    this.stutterCount = 0
    this.consecutiveSilentFrames = 0
    this.isRunning = true

    this.onUpdate?.("Playback test started")
    
    // Check audio levels at 60fps
    const dataArray = new Float32Array(this.analyser.frequencyBinCount)
    
    const checkAudio = () => {
      if (!this.isRunning || !this.analyser || !this.audioContext) return
      
      this.analyser.getFloatTimeDomainData(dataArray)
      
      // Calculate RMS (root mean square) for audio level
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      
      const currentTime = this.audioContext.currentTime
      const elapsed = currentTime - this.startTime
      
      if (rms < this.silenceThreshold) {
        this.consecutiveSilentFrames++
        const silenceDuration = this.consecutiveSilentFrames / 60 // ~60fps
        
        if (silenceDuration >= this.gapThreshold) {
          // We have a gap
          if (this.consecutiveSilentFrames === Math.ceil(this.gapThreshold * 60)) {
            // Just crossed threshold, record gap start
            const gapStart = elapsed - this.gapThreshold
            this.gaps.push({ timestamp: gapStart, duration: 0 })
            this.onUpdate?.(`Gap detected at ${gapStart.toFixed(1)}s`)
          }
          // Update gap duration
          if (this.gaps.length > 0) {
            this.gaps[this.gaps.length - 1].duration = silenceDuration
          }
        }
      } else {
        // Audio present
        if (this.consecutiveSilentFrames > 0) {
          const silenceDuration = this.consecutiveSilentFrames / 60
          if (silenceDuration >= this.gapThreshold && silenceDuration < this.gapThreshold * 2) {
            // Short gap ended - might be a stutter
            this.stutterCount++
            this.onUpdate?.(`Stutter detected at ${elapsed.toFixed(1)}s`)
          }
        }
        this.consecutiveSilentFrames = 0
        this.lastAudioTime = currentTime
      }
      
      if (this.isRunning) {
        requestAnimationFrame(checkAudio)
      }
    }
    
    checkAudio()
  }

  stop(): PlaybackTestResult {
    this.isRunning = false
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    
    const totalDuration = this.audioContext 
      ? this.audioContext.currentTime - this.startTime 
      : 0
    
    // Determine if test passed
    // Pass criteria: no gaps > 1 second, fewer than 3 stutters
    const longGaps = this.gaps.filter(g => g.duration > 1)
    const passed = longGaps.length === 0 && this.stutterCount < 3
    
    const result: PlaybackTestResult = {
      passed,
      totalDuration,
      gapCount: this.gaps.length,
      gaps: this.gaps,
      stutterCount: this.stutterCount,
      errorMessage: passed ? undefined : this.getErrorMessage(longGaps)
    }
    
    this.onUpdate?.(`Test ${passed ? 'PASSED' : 'FAILED'}: ${this.gaps.length} gaps, ${this.stutterCount} stutters`)
    this.onComplete?.(result)
    
    // Cleanup
    if (this.analyser) {
      try { this.analyser.disconnect() } catch {}
    }
    
    return result
  }

  private getErrorMessage(longGaps: { timestamp: number; duration: number }[]): string {
    const issues: string[] = []
    
    if (longGaps.length > 0) {
      issues.push(`${longGaps.length} long gap(s) > 1s`)
    }
    if (this.stutterCount >= 3) {
      issues.push(`${this.stutterCount} stutters detected`)
    }
    
    return issues.join(', ')
  }

  getStatus(): { running: boolean; elapsed: number; gapCount: number } {
    return {
      running: this.isRunning,
      elapsed: this.audioContext ? this.audioContext.currentTime - this.startTime : 0,
      gapCount: this.gaps.length
    }
  }
}

// Simple function to run a quick playback test
export async function runPlaybackTest(
  durationSeconds: number,
  onProgress?: (msg: string) => void
): Promise<PlaybackTestResult> {
  return new Promise((resolve) => {
    onProgress?.(`Starting ${durationSeconds}s playback test...`)
    
    // This would need to be integrated with the actual audio engine
    // For now, return a placeholder that can be hooked up later
    setTimeout(() => {
      resolve({
        passed: true,
        totalDuration: durationSeconds,
        gapCount: 0,
        gaps: [],
        stutterCount: 0
      })
    }, 1000)
  })
}

// Export for use in dev tools console
if (typeof window !== 'undefined') {
  (window as any).PlaybackTester = PlaybackTester
  ;(window as any).runPlaybackTest = runPlaybackTest
}
