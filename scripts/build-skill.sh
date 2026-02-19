#!/bin/bash
# Build teamify.skill ZIP for Claude.ai upload
# Skills-only package (no .team-os - auto-created on first run)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
OUT="$ROOT/teamify.skill"

echo "Building teamify.skill..."

cd "$ROOT"
zip -j "$OUT" \
  skills/teamify-workflow.md \
  skills/teamify-registry-schema.md \
  skills/teamify-spawn-templates.md \
  2>/dev/null

echo "Built: $OUT"
echo "Contents:"
unzip -l "$OUT"
echo ""
echo "Upload this file to Claude.ai to install teamify skills."
echo "Note: .team-os infrastructure is auto-created on first /teamify run."
