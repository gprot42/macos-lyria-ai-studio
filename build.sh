#!/bin/bash
# Production build for Lyria AI Studio (Tauri desktop app)

set -e
cd "$(dirname "$0")"

usage() {
    cat <<'EOF'
Usage: ./build.sh [OPTIONS]

Build the Lyria AI Studio desktop app.

Options:
  --debug          Build a debug binary instead of release
  --frontend-only  Build only the Vite frontend (skip Tauri bundle)
  -h, --help       Show this help

Release artifacts:
  src-tauri/target/release/bundle/macos/*.app
  src-tauri/target/release/bundle/dmg/*.dmg
EOF
}

BUILD_DEBUG=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --debug)
            BUILD_DEBUG=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo ""
            usage
            exit 1
            ;;
    esac
done

if ! command -v bun &> /dev/null; then
    echo "ERROR: bun is required. Install from https://bun.sh/"
    exit 1
fi

if [[ ! -d node_modules ]]; then
    echo "Installing dependencies..."
    bun install
    echo ""
fi

if [[ "$FRONTEND_ONLY" == true ]]; then
    echo "Building frontend..."
    bun run build
    echo ""
    echo "Frontend build complete: dist/"
    exit 0
fi

if ! command -v cargo &> /dev/null; then
    echo "ERROR: Rust/Cargo is required. Install from https://www.rust-lang.org/"
    exit 1
fi

echo "=== Lyria AI Studio Build ==="
echo ""

if [[ "$BUILD_DEBUG" == true ]]; then
    echo "Building debug desktop app..."
    bun tauri build --debug
    echo ""
    echo "Debug build complete:"
    echo "  src-tauri/target/debug/lyria-ai-studio"
else
    echo "Building release desktop app..."
    bun tauri build
    echo ""
    echo "Release build complete:"
    echo "  src-tauri/target/release/bundle/macos/"
    echo "  src-tauri/target/release/bundle/dmg/"
fi