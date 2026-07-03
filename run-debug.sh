#!/bin/bash
# Debug mode launcher for Lyria AI Studio
# Captures WebView crashes and enables detailed logging

set -e

echo "=== Lyria AI Studio Debug Mode ==="
echo ""

# Enable WebKit debugging
export WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222
export RUST_BACKTRACE=full
export RUST_LOG=debug,lyria_studio_lib=trace

# Kill any existing processes
pkill -f "lyria-ai-studio" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

echo "[1] Starting Vite dev server..."
cd "$(dirname "$0")"
bun run dev &
VITE_PID=$!
sleep 2

echo "[2] Building debug binary..."
cd src-tauri
cargo build 2>&1 | tee /tmp/cargo-build.log

echo ""
echo "[3] Starting app with crash monitoring..."
echo "    - Safari Web Inspector: Develop > [Mac] > localhost"
echo "    - Crash logs: /tmp/lyria-crash.log"
echo ""

# Run with crash capture
./target/debug/lyria-ai-studio 2>&1 | tee /tmp/lyria-crash.log &
APP_PID=$!

echo "App PID: $APP_PID"
echo "Vite PID: $VITE_PID"
echo ""
echo "Press Ctrl+C to stop..."

# Wait and capture any crash
wait $APP_PID
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "=== APP CRASHED (exit code: $EXIT_CODE) ==="
    echo "Crash log saved to: /tmp/lyria-crash.log"
    echo ""
    echo "Last 50 lines:"
    tail -50 /tmp/lyria-crash.log
fi

# Cleanup
kill $VITE_PID 2>/dev/null || true
