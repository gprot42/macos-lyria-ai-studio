#!/bin/bash
# Ensure Bash 4+ for deploy-cloud-run.sh (macOS ships with Bash 3.2 by default).
# See DEPLOYMENT.md for manual setup. Not required for building the desktop app.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_SCRIPT="$ROOT/deploy-cloud-run.sh"

echo "============================================="
echo "  Bash 4+ setup (Cloud Run deployment only)"
echo "============================================="
echo ""

CURRENT_VERSION=$(bash --version | head -1)
echo "Current Bash: $CURRENT_VERSION"
echo ""

if [[ "${BASH_VERSINFO[0]}" -ge 4 ]]; then
    echo "You already have Bash 4+."
    echo "Run the deployment script with:"
    echo "  $DEPLOY_SCRIPT --help"
    exit 0
fi

echo "Bash 3.x detected (macOS default)."
echo "Installing Bash 4+ via Homebrew..."
echo ""

if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
fi

echo "Installing bash via Homebrew..."
brew install bash

echo ""
echo "============================================="
echo "  Installation complete"
echo "============================================="
echo ""
echo "Bash 4+ is now installed at:"

if [[ -f /opt/homebrew/bin/bash ]]; then
    BASH4_PATH="/opt/homebrew/bin/bash"
elif [[ -f /usr/local/bin/bash ]]; then
    BASH4_PATH="/usr/local/bin/bash"
else
    BASH4_PATH="$(brew --prefix)/bin/bash"
fi

echo "  $BASH4_PATH"
echo ""
"$BASH4_PATH" --version | head -1
echo ""

echo "Run the deployment script with:"
echo "  $BASH4_PATH $DEPLOY_SCRIPT --help"
echo ""
echo "Or add Homebrew's bin directory to your PATH (see DEPLOYMENT.md)."
echo ""

read -p "Update your shell PATH now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SHELL_RC="$HOME/.zshrc"
    if [[ ! -f "$SHELL_RC" ]]; then
        SHELL_RC="$HOME/.bash_profile"
    fi

    if ! grep -q "$(brew --prefix)/bin" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# Homebrew bin (added by scripts/ensure-bash4.sh)" >> "$SHELL_RC"
        echo "export PATH=\"$(brew --prefix)/bin:\$PATH\"" >> "$SHELL_RC"
        echo "Updated $SHELL_RC"
        echo ""
        echo "Run: source $SHELL_RC"
    else
        echo "PATH already includes Homebrew's bin directory."
    fi
fi

echo ""
echo "You can now run:"
echo "  $BASH4_PATH $DEPLOY_SCRIPT --help"