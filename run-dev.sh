#!/bin/bash
cd "$(dirname "$0")"

cleanup_stale_dev() {
    local stale_pids
    stale_pids=$(lsof -ti:5173 2>/dev/null)
    if [ -n "$stale_pids" ]; then
        echo "Port 5173 is in use; stopping stale dev processes..."
        echo "$stale_pids" | xargs kill -9 2>/dev/null
        pkill -f "tauri" 2>/dev/null
        pkill -f "lyria-ai-studio" 2>/dev/null
        sleep 1
        echo "Cleanup complete."
    fi
}

# Handle --restart flag (force cleanup even if port appears free)
if [ "$1" = "--restart" ] || [ "$1" = "-r" ]; then
    echo "Restarting: killing existing processes..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    pkill -f "tauri" 2>/dev/null
    pkill -f "lyria-ai-studio" 2>/dev/null
    sleep 1
    echo "Cleanup complete."
else
    cleanup_stale_dev
fi

# Enable Rust/Tauri logging
export RUST_LOG=debug
export RUST_BACKTRACE=1

echo "Starting Lyria AI Studio in dev mode..."
echo "Tauri logs will appear below."
echo "-----------------------------------"

bun tauri dev 2>&1
