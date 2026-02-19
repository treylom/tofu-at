#!/bin/bash
# tofu-at-codex installer
# Installs tofu-at (base) + Codex hybrid mode (tofu-at-codex command + setup script).
# Run this AFTER tofu-at base is installed, or it will install both.

set -e

REPO="https://github.com/treylom/tofu-at"
BRANCH="feature/codex"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ──
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[!!]${NC} $1"; }
info() { echo -e "  ${CYAN}[i]${NC} $1"; }

echo -e "${BOLD}tofu-at-codex installer${NC}"
echo ""

# ── Detect source ──
if [ -f "$SCRIPT_DIR/commands/tofu-at-codex.md" ]; then
  SRC="$SCRIPT_DIR"
else
  TEMP=$(mktemp -d)
  echo "Cloning tofu-at (${BRANCH} branch)..."
  git clone --depth 1 -b "$BRANCH" "$REPO" "$TEMP/tofu-at" 2>/dev/null
  SRC="$TEMP/tofu-at"
  CLEANUP=true
fi

# ── Step 1: Install base tofu-at if missing ──
if [ ! -f ".claude/commands/tofu-at.md" ]; then
  warn "Base tofu-at not found. Installing base first..."
  bash "$SRC/install.sh"
  echo ""
fi

# ── Step 2: Install tofu-at-codex command ──
mkdir -p .claude/commands
cp "$SRC/commands/tofu-at-codex.md" .claude/commands/
ok ".claude/commands/tofu-at-codex.md"

# ── Step 3: Install setup script ──
mkdir -p .claude/scripts
cp "$SRC/scripts/setup-tofu-at-codex.sh" .claude/scripts/
chmod +x .claude/scripts/setup-tofu-at-codex.sh
ok ".claude/scripts/setup-tofu-at-codex.sh"

# ── Cleanup ──
if [ "$CLEANUP" = true ]; then
  rm -rf "$TEMP"
fi

echo ""
echo -e "${BOLD}tofu-at-codex installed successfully!${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "  1. Run dependency check:"
echo -e "     ${CYAN}bash .claude/scripts/setup-tofu-at-codex.sh${NC}"
echo ""
echo -e "  2. Auto-install missing dependencies:"
echo -e "     ${CYAN}AUTO_INSTALL=1 bash .claude/scripts/setup-tofu-at-codex.sh${NC}"
echo ""
echo -e "  3. Start using (in tmux session):"
echo -e "     ${CYAN}claude${NC}  →  ${CYAN}/tofu-at-codex${NC}"
echo ""
echo "Requirements:"
echo "  - All tofu-at requirements (tmux, Claude Code, Agent Teams)"
echo "  - Codex CLI:     npm install -g @openai/codex"
echo "  - CLIProxyAPI:   git clone https://github.com/router-for-me/CLIProxyAPI.git ~/CLIProxyAPI"
echo "  - OAuth token:   cd ~/CLIProxyAPI && ./cli-proxy-api (TUI auth)"
echo ""
