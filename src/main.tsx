import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { setupGlobalErrorHandlers, startMemoryMonitoring, debugLog } from "./lib/debug-logger"

// Setup error handlers BEFORE rendering - logs to Rust terminal
setupGlobalErrorHandlers()

// Start memory monitoring (logs to Rust terminal every 2 seconds)
startMemoryMonitoring(2000)

debugLog.info("Application starting...")

document.documentElement.setAttribute("data-theme", "tokyo-night")

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

try {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
  debugLog.info("Application rendered successfully")
} catch (error) {
  debugLog.error(`Failed to render app: ${error}`)
  console.error("Failed to render app:", error)
  root.innerHTML = `<div style="padding: 20px; background: #1a1b26; color: #f7768e; font-family: monospace;">
    <h1>Error Loading App</h1>
    <pre>${error}</pre>
  </div>`
}
