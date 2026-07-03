import { invoke } from "@tauri-apps/api/core"

let chunkCount = 0
let queueSize = 0
let memoryInterval: number | null = null

export function setDebugStats(chunks: number, queue: number) {
  chunkCount = chunks
  queueSize = queue
}

async function logToRust(level: string, message: string) {
  try {
    await invoke("js_log", { level, message })
  } catch (e) {
    // Fallback to console if Tauri not available
    console.log(`[${level}]`, message)
  }
}

async function reportMemory() {
  try {
    // @ts-ignore - performance.memory is Chrome-specific
    const memory = (performance as any).memory
    if (memory) {
      await invoke("js_memory_report", {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        chunkCount,
        queueSize
      })
    }
  } catch (e) {
    // Memory API not available
  }
}

export function startMemoryMonitoring(intervalMs: number = 2000) {
  if (memoryInterval) {
    clearInterval(memoryInterval)
  }
  memoryInterval = window.setInterval(reportMemory, intervalMs)
  logToRust("info", "Memory monitoring started")
}

export function stopMemoryMonitoring() {
  if (memoryInterval) {
    clearInterval(memoryInterval)
    memoryInterval = null
  }
}

export function setupGlobalErrorHandlers() {
  // Catch unhandled errors
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMsg = `UNHANDLED ERROR: ${message} at ${source}:${lineno}:${colno}`
    logToRust("error", errorMsg)
    if (error?.stack) {
      logToRust("error", `Stack: ${error.stack}`)
    }
    return false
  }

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const errorMsg = `UNHANDLED REJECTION: ${event.reason}`
    logToRust("error", errorMsg)
    if (event.reason?.stack) {
      logToRust("error", `Stack: ${event.reason.stack}`)
    }
  }

  logToRust("info", "Global error handlers installed")
}

// Debug logger that goes to Rust terminal
export const debugLog = {
  info: (msg: string) => logToRust("info", msg),
  warn: (msg: string) => logToRust("warn", msg),
  error: (msg: string) => logToRust("error", msg),
  debug: (msg: string) => logToRust("debug", msg),
  
  // Log with memory snapshot
  async checkpoint(label: string) {
    await logToRust("info", `=== CHECKPOINT: ${label} ===`)
    await reportMemory()
  }
}
