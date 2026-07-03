import { useRef, useEffect } from "react"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"

interface VisualizerProps {
  className?: string
}

export function Visualizer({ className }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(Date.now())
  const isActive = useAppStore((state) => state.isGenerating || state.isPlaying || state.isPlayingBack)
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const connectionError = useAppStore((state) => state.connectionError)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    let lastDrawTime = 0
    const targetFPS = 20 // Reduced to 20fps for better performance
    const frameInterval = 1000 / targetFPS
    let frameCount = 0

    const draw = (timestamp: number) => {
      try {
        // Throttle to target FPS
        if (timestamp - lastDrawTime < frameInterval) {
          animationRef.current = requestAnimationFrame(draw)
          return
        }
        lastDrawTime = timestamp
        frameCount++

        const state = useAppStore.getState()
        const analyzerData = state.analyzerData
        const waveformData = state.waveformData
        const currentlyActive = state.isGenerating || state.isPlaying || state.isPlayingBack
        const status = state.connectionStatus || ""
        const isBuffering = status.includes("Buffering") || status.includes("Generating") || status.includes("Starting")

        const rect = canvas.getBoundingClientRect()
        ctx.clearRect(0, 0, rect.width, rect.height)

        const isDark = document.documentElement.getAttribute("data-theme") !== "light"
        
        // Simple solid background instead of gradient (reduces allocations)
        ctx.fillStyle = isDark ? "rgb(18, 18, 28)" : "rgb(248, 248, 252)"
        ctx.fillRect(0, 0, rect.width, rect.height)

        if (waveformData && currentlyActive && !isBuffering) {
          ctx.beginPath()
          ctx.strokeStyle = isDark ? "rgba(147, 112, 219, 0.4)" : "rgba(147, 112, 219, 0.6)"
          ctx.lineWidth = 1

          const sliceWidth = rect.width / waveformData.length
          let x = 0

          for (let i = 0; i < waveformData.length; i++) {
            const v = waveformData[i]
            const y = ((v + 1) / 2) * rect.height

            if (i === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
            x += sliceWidth
          }

          ctx.stroke()
        }

        if (analyzerData && currentlyActive && !isBuffering) {
          const barCount = 64
          const barWidth = (rect.width / barCount) * 0.7
          const gap = (rect.width / barCount) * 0.3
          
          // Use solid color instead of gradient per bar (major memory optimization)
          ctx.fillStyle = isDark ? "rgba(139, 92, 246, 0.8)" : "rgba(124, 58, 237, 0.8)"

          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * analyzerData.length)
            const value = analyzerData[dataIndex]
            const normalizedValue = (value + 140) / 140
            const barHeight = Math.max(2, normalizedValue * rect.height * 0.8)

            const x = i * (barWidth + gap) + gap / 2
            ctx.beginPath()
            ctx.roundRect(x, rect.height - barHeight, barWidth, barHeight, 2)
            ctx.fill()
          }
        } else if ((isBuffering || status.includes("preview")) && currentlyActive) {
          // Animated visualization - pulsing/waving bars for buffering or native preview
          const barCount = 64
          const barWidth = (rect.width / barCount) * 0.7
          const gap = (rect.width / barCount) * 0.3
          const time = (Date.now() - startTimeRef.current) / 1000
          
          // Use green for buffering, purple for preview
          const isPreview = status.includes("preview")
          ctx.fillStyle = isPreview 
            ? (isDark ? "rgba(147, 112, 219, 0.7)" : "rgba(124, 58, 237, 0.7)")
            : (isDark ? "rgba(34, 197, 94, 0.7)" : "rgba(22, 163, 74, 0.7)")

          for (let i = 0; i < barCount; i++) {
            // Create a wave effect that moves across the bars
            const wave1 = Math.sin(time * 2 + i * 0.15) * 0.5 + 0.5
            const wave2 = Math.sin(time * 3 + i * 0.1 + Math.PI) * 0.3 + 0.5
            const wave3 = Math.sin(time * 1.5 + i * 0.2) * 0.2 + 0.5
            const combined = (wave1 + wave2 + wave3) / 3
            
            // Make preview bars taller and more dynamic
            const heightMultiplier = isPreview ? 0.7 : 0.5
            const barHeight = Math.max(4, combined * rect.height * heightMultiplier)

            const x = i * (barWidth + gap) + gap / 2
            ctx.beginPath()
            ctx.roundRect(x, rect.height - barHeight, barWidth, barHeight, 2)
            ctx.fill()
          }
        } else if (!currentlyActive) {
          const barCount = 64
          const barWidth = (rect.width / barCount) * 0.7
          const gap = (rect.width / barCount) * 0.3

          for (let i = 0; i < barCount; i++) {
            const barHeight = 3 + Math.sin(i * 0.2) * 2

            ctx.fillStyle = isDark ? "rgba(100, 100, 120, 0.3)" : "rgba(150, 150, 170, 0.3)"
            const x = i * (barWidth + gap) + gap / 2
            ctx.beginPath()
            ctx.roundRect(x, rect.height - barHeight, barWidth, barHeight, 1)
            ctx.fill()
          }
        }

        animationRef.current = requestAnimationFrame(draw)
      } catch (e) {
        console.error("Visualizer error:", e)
        // Don't request next frame if error occurred to prevent loop
      }
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const isGenerating = connectionStatus?.includes("Generating")
  const isBuffering = connectionStatus?.includes("Buffering")
  const isTrying = connectionStatus?.includes("Trying") || connectionStatus?.includes("Attempting")
  const isConnecting = connectionStatus?.includes("Connecting") || connectionStatus?.includes("Starting")
  const isConnected = connectionStatus?.includes("Connected") || connectionStatus?.includes("Ready")
  const hasError = connectionError && connectionError.length > 0

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {hasError ? (
          <div className="flex flex-col items-center gap-2 px-6 py-4 bg-red-500/20 backdrop-blur-md rounded-xl border border-red-500/50 max-w-md mx-4 shadow-lg shadow-red-500/20 pointer-events-auto select-text cursor-text">
            <span className="text-lg font-bold text-red-400">Error</span>
            <span className="text-sm text-red-300 text-center whitespace-pre-line">
              {connectionError}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(connectionError || "")}
              className="mt-1 px-3 py-1 text-xs text-red-300 bg-red-500/20 hover:bg-red-500/40 rounded border border-red-500/30 transition-colors cursor-pointer"
            >
              Copy error
            </button>
          </div>
        ) : isBuffering ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/25 backdrop-blur-md rounded-full border border-emerald-400/50 shadow-lg shadow-emerald-500/20">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
            <span className="text-xl font-bold text-emerald-300 tracking-wide drop-shadow-lg">
              {connectionStatus}
            </span>
          </div>
        ) : isGenerating ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/25 to-pink-500/25 backdrop-blur-md rounded-full border border-purple-400/50 shadow-lg shadow-purple-500/20">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse shadow-lg shadow-purple-400/50" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent tracking-wide">
              Generating music...
            </span>
          </div>
        ) : isTrying ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-500/20 backdrop-blur-md rounded-full border border-amber-400/50 shadow-lg shadow-amber-500/20">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-lg shadow-amber-400/50" />
            <span className="text-base font-semibold text-amber-300 tracking-wide">
              {connectionStatus}
            </span>
          </div>
        ) : isConnecting ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-cyan-500/20 backdrop-blur-md rounded-full border border-cyan-400/50 shadow-lg shadow-cyan-500/20">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
            <span className="text-base font-semibold text-cyan-300 tracking-wide">
              {connectionStatus}
            </span>
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-500/15 backdrop-blur-md rounded-full border border-emerald-400/40">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span className="text-sm font-medium text-emerald-300">
              {connectionStatus}
            </span>
          </div>
        ) : connectionStatus?.includes("preview") ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/25 to-pink-500/25 backdrop-blur-md rounded-full border border-purple-400/50 shadow-lg shadow-purple-500/20">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse shadow-lg shadow-purple-400/50" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent tracking-wide">
              Playing Preview
            </span>
          </div>
        ) : connectionStatus && !connectionStatus.includes("Playing") ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-500/20 backdrop-blur-md rounded-full border border-slate-400/30">
            <span className="text-sm font-medium text-slate-300">{connectionStatus}</span>
          </div>
        ) : isActive ? (
          <div className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/25 to-pink-500/25 backdrop-blur-md rounded-full border border-purple-400/50 shadow-lg shadow-purple-500/20">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse shadow-lg shadow-purple-400/50" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent tracking-wide">
              Processing...
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-sm font-medium">Ready to generate</span>
        )}
      </div>
    </div>
  )
}
