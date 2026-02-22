#!/bin/bash
# ensure-server.sh — Ensures Agent Office server is running
# Usage: bash ensure-server.sh [project_root]
# Called by: tofu-at spawn templates, knowledge-manager-at, etc.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${1:-$(pwd)}"
PORT="${AGENT_OFFICE_PORT:-3747}"

# 1. Health check
health=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/api/status" --connect-timeout 2 2>/dev/null || echo 'fail')

if [ "$health" = "200" ]; then
  echo "Agent Office already running on port ${PORT}"
  exit 0
fi

# 2. Kill stale process on port
lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true

# 3. Start server
export AGENT_OFFICE_ROOT="$PROJECT_ROOT"
nohup node "${SCRIPT_DIR}/server.js" > /tmp/agent-office.log 2>&1 &
SERVER_PID=$!

# 4. Wait for readiness (max 10 seconds)
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/api/status" --connect-timeout 1 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "Agent Office started (PID: ${SERVER_PID}) on port ${PORT}"
    exit 0
  fi
  sleep 1
done

echo "Agent Office failed to start. Check /tmp/agent-office.log"
exit 1
