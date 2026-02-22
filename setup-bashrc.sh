#!/bin/bash
# setup-bashrc.sh - Install ai/ain/cleanup/ai-sync shell functions
# Usage:
#   bash setup-bashrc.sh ~/my-project                    # default (auto-push OFF)
#   bash setup-bashrc.sh ~/my-project --with-auto-push   # enable auto git sync on exit
#   bash setup-bashrc.sh ~/my-project --shell=zsh        # target zsh instead of bash

set -e

# ─── Colors ─────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── Parse Arguments ────────────────────────────────────
PROJECT_DIR=""
AUTO_PUSH=false
TARGET_SHELL=""

for arg in "$@"; do
  case "$arg" in
    --with-auto-push) AUTO_PUSH=true ;;
    --shell=bash)     TARGET_SHELL="bash" ;;
    --shell=zsh)      TARGET_SHELL="zsh" ;;
    --help|-h)
      echo "Usage: bash setup-bashrc.sh <project-dir> [options]"
      echo ""
      echo "Options:"
      echo "  --with-auto-push   Enable auto git sync on Claude exit"
      echo "  --shell=bash|zsh   Target shell (auto-detected if omitted)"
      echo "  --help, -h         Show this help"
      exit 0
      ;;
    *)
      if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="$arg"
      else
        error "Unknown argument: $arg"
        exit 1
      fi
      ;;
  esac
done

# ─── Validate Project Directory ─────────────────────────
if [ -z "$PROJECT_DIR" ]; then
  error "Project directory required / 프로젝트 경로가 필요합니다"
  echo "  Usage: bash setup-bashrc.sh ~/my-project"
  exit 1
fi

# Resolve to absolute path
PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" || {
  error "Directory not found: $PROJECT_DIR / 디렉토리를 찾을 수 없습니다"
  exit 1
}

# ─── Detect Shell ───────────────────────────────────────
if [ -z "$TARGET_SHELL" ]; then
  if [ -n "$ZSH_VERSION" ] || [ "$(basename "$SHELL")" = "zsh" ]; then
    TARGET_SHELL="zsh"
  else
    TARGET_SHELL="bash"
  fi
fi

if [ "$TARGET_SHELL" = "zsh" ]; then
  RC_FILE="$HOME/.zshrc"
else
  RC_FILE="$HOME/.bashrc"
fi

info "Target shell: $TARGET_SHELL ($RC_FILE)"
info "Project dir: $PROJECT_DIR"
info "Auto-push: $AUTO_PUSH"

# ─── Marker Constants ──────────────────────────────────
MARKER_START="# >>> tofu-at >>>"
MARKER_END="# <<< tofu-at <<<"

# ─── Check for Existing Installation ───────────────────
if grep -q "$MARKER_START" "$RC_FILE" 2>/dev/null; then
  warn "tofu-at functions already installed in $RC_FILE"
  warn "Removing old installation... / 기존 설치를 제거합니다..."
  # Remove old block (sed between markers, inclusive)
  sed -i "/$MARKER_START/,/$MARKER_END/d" "$RC_FILE"
  success "Old installation removed / 기존 설치 제거 완료"
fi

# ─── Build Exit Command ────────────────────────────────
if [ "$AUTO_PUSH" = true ]; then
  EXIT_CMD="cd $PROJECT_DIR && git add -A && git commit -m 'auto-sync: \$(date +%Y-%m-%d\\ %H:%M)' 2>/dev/null && git pull origin master --rebase 2>/dev/null && git push origin master 2>/dev/null; exec bash"
else
  EXIT_CMD="exec bash"
fi

# ─── Generate Function Block ───────────────────────────
FUNC_BLOCK="$MARKER_START
# tofu-at shell functions - installed $(date +%Y-%m-%d)
# Project: $PROJECT_DIR
# Auto-push: $AUTO_PUSH

# --- Internal: setup project before Claude launch ---
_ai_setup() {
  cd \"$PROJECT_DIR\"
  git stash 2>/dev/null
  git pull origin master --rebase 2>/dev/null
  git stash pop 2>/dev/null
  python3 -c \"
import json, subprocess, os
settings_path = os.path.join('$PROJECT_DIR', '.claude', 'settings.local.json')
try:
    with open(settings_path) as f:
        d = json.load(f)
except:
    d = {}
d['teammateMode'] = 'tmux'
d.setdefault('env', {})['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] = '1'
# Fix hooks format: wrap bare handlers in {hooks: [...]}
if 'hooks' in d:
    for ev in d['hooks']:
        fixed = []
        for m in d['hooks'][ev]:
            if 'hooks' not in m:
                fixed.append({'hooks': [m]})
            else:
                fixed.append(m)
        d['hooks'][ev] = fixed
with open(settings_path, 'w') as f:
    json.dump(d, f, indent=2)
\" 2>/dev/null
}

# --- Internal: git sync ---
_ai_sync() {
  cd \"$PROJECT_DIR\" && git add -A && git commit -m \"auto-sync: \$(date +%Y-%m-%d\ %H:%M)\" 2>/dev/null && git pull origin master --rebase 2>/dev/null && git push origin master 2>/dev/null
}

# --- ai: Launch Claude Code in a tmux session ---
# Usage: ai         → normal mode
#        ai pass    → dangerously-skip-permissions mode
ai() {
  local claude_cmd=\"claude --model=opus[1m]\"
  if [ \"\$1\" = \"pass\" ]; then
    claude_cmd=\"claude --model=opus[1m] --dangerously-skip-permissions\"
  fi
  _ai_setup
  tmux new-session -s claude \"bash -c 'cd $PROJECT_DIR && \$claude_cmd; $EXIT_CMD'\"
}

# --- ain: Launch named Claude Code session/window ---
# Usage: ain              → auto-named session (claude-HHMM)
#        ain pass         → with skip-permissions, auto-named
#        ain pass myname  → with skip-permissions, named 'myname'
#        ain myname       → named 'myname'
ain() {
  local claude_cmd=\"claude --model=opus[1m]\"
  if [ \"\$1\" = \"pass\" ]; then
    claude_cmd=\"claude --model=opus[1m] --dangerously-skip-permissions\"
    shift
  fi
  local name=\"\${1:-claude-\$(date +%H%M)}\"
  _ai_setup
  local cmd=\"bash -c 'cd $PROJECT_DIR && \$claude_cmd; $EXIT_CMD'\"
  if [ -n \"\$TMUX\" ]; then
    tmux new-window -n \"\$name\" \"\$cmd\"
  else
    tmux new-session -s \"\$name\" \"\$cmd\"
  fi
}

# --- cleanup: Manage/kill tmux sessions ---
# Usage: cleanup          → list + kill all (with confirmation)
#        cleanup myname   → kill specific session
cleanup() {
  if [ -z \"\$1\" ]; then
    local count=\$(tmux list-sessions 2>/dev/null | wc -l)
    if [ \"\$count\" -eq 0 ]; then
      echo \"No tmux sessions / tmux 세션 없음\"
      return 0
    fi
    echo \"=== Active tmux sessions (\${count}) / 활성 tmux 세션 ===\"
    tmux list-sessions
    echo \"\"
    read -p \"Kill all sessions? / 전체 종료? (y/N) \" confirm
    if [[ \"\$confirm\" =~ ^[Yy]\$ ]]; then
      tmux kill-server
      echo \"All tmux sessions killed / 전체 tmux 세션 종료 완료\"
    else
      echo \"Cancelled / 취소됨\"
    fi
  else
    if tmux has-session -t \"\$1\" 2>/dev/null; then
      tmux kill-session -t \"\$1\"
      echo \"Session '\$1' killed / 세션 '\$1' 종료 완료\"
    else
      echo \"Session '\$1' not found / 세션 '\$1' 없음\"
    fi
  fi
}

# --- ai-sync: Manual git sync alias ---
alias ai-sync='_ai_sync'

$MARKER_END"

# ─── Write to RC File ──────────────────────────────────
echo "" >> "$RC_FILE"
echo "$FUNC_BLOCK" >> "$RC_FILE"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  tofu-at shell functions installed!${NC}"
echo -e "${GREEN}  셸 함수 설치 완료!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${CYAN}Shell:${NC}       $TARGET_SHELL ($RC_FILE)"
echo -e "  ${CYAN}Project:${NC}     $PROJECT_DIR"
echo -e "  ${CYAN}Auto-push:${NC}   $AUTO_PUSH"
echo ""
echo -e "  ${CYAN}Commands available / 사용 가능한 명령어:${NC}"
echo "    ai          → Launch Claude Code in tmux"
echo "    ai pass     → Launch with skip-permissions"
echo "    ain [name]  → Named tmux session/window"
echo "    cleanup     → Manage tmux sessions"
echo "    ai-sync     → Manual git sync"
echo ""
echo -e "  ${YELLOW}Reload shell to activate / 셸 재시작 필요:${NC}"
echo "    source $RC_FILE"
echo ""

if [ "$AUTO_PUSH" = false ]; then
  echo -e "  ${CYAN}(Tip)${NC} Enable auto git sync on exit / 종료 시 자동 git 동기화:"
  echo "    bash setup-bashrc.sh $PROJECT_DIR --with-auto-push"
  echo ""
fi
