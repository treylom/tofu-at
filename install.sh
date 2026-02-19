#!/bin/bash
# teamify installer
# Copies command, skills, and .team-os infrastructure to the current project.

set -e

REPO="https://github.com/treylom/teamify"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect if running from cloned repo or piped from curl
if [ -f "$SCRIPT_DIR/commands/teamify.md" ]; then
  SRC="$SCRIPT_DIR"
else
  TEMP=$(mktemp -d)
  echo "Cloning teamify..."
  git clone --depth 1 "$REPO" "$TEMP/teamify" 2>/dev/null
  SRC="$TEMP/teamify"
  CLEANUP=true
fi

echo "Installing teamify..."

# Command
mkdir -p .claude/commands
cp "$SRC/commands/teamify.md" .claude/commands/
echo "  [OK] .claude/commands/teamify.md"

# Skills
mkdir -p .claude/skills
cp "$SRC/skills/"*.md .claude/skills/
echo "  [OK] .claude/skills/teamify-*.md (3 files)"

# .team-os infrastructure
if [ ! -d ".team-os" ]; then
  cp -r "$SRC/.team-os" .
  chmod +x .team-os/hooks/*.js 2>/dev/null || true
  echo "  [OK] .team-os/ (registry, hooks, artifacts)"
else
  # Preserve existing registry, update hooks and artifacts
  cp "$SRC/.team-os/hooks/"*.js .team-os/hooks/ 2>/dev/null || true
  chmod +x .team-os/hooks/*.js 2>/dev/null || true
  for f in TEAM_PLAN.md TEAM_BULLETIN.md TEAM_FINDINGS.md TEAM_PROGRESS.md MEMORY.md; do
    if [ ! -f ".team-os/artifacts/$f" ]; then
      cp "$SRC/.team-os/artifacts/$f" .team-os/artifacts/
    fi
  done
  echo "  [OK] .team-os/ (hooks updated, existing registry preserved)"
fi

# Cleanup
if [ "$CLEANUP" = true ]; then
  rm -rf "$TEMP"
fi

echo ""
echo "teamify installed successfully!"
echo "Usage: /teamify"
echo ""
echo "Requirements:"
echo "  - tmux (for Split Pane mode)"
echo "  - CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1"
echo "  - Recommended: claude --model=opus[1m]"
