#!/bin/bash
# tofu-at installer v2.2.0
# Installs command, skills, .team-os infrastructure, and configures settings.
# Cross-platform: WSL, macOS, Linux (Debian/RHEL)
#
# Usage:
#   bash install.sh                  # from cloned repo
#   curl -fsSL <raw-url> | bash      # one-liner install

set -e

VERSION="2.2.0"
REPO="https://github.com/treylom/tofu-at"
TOTAL_STEPS=7

# ═══════════════════════════════════════════════════════════
# Phase 1: Utilities (colors, helpers)
# ═══════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}  [OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

step() {
  local n=$1; shift
  echo ""
  echo -e "${BOLD}${CYAN}[$n/$TOTAL_STEPS]${NC} ${BOLD}$*${NC}"
}

has_cmd() { command -v "$1" &>/dev/null; }

# ═══════════════════════════════════════════════════════════
# Phase 2: OS Detection
# ═══════════════════════════════════════════════════════════

detect_os() {
  OS="unknown"
  PKG_MGR=""

  if grep -qi microsoft /proc/version 2>/dev/null; then
    OS="wsl"
  elif [ "$(uname)" = "Darwin" ]; then
    OS="macos"
  elif [ -f /etc/debian_version ]; then
    OS="linux-debian"
  elif [ -f /etc/redhat-release ]; then
    OS="linux-rhel"
  else
    OS="linux-other"
  fi

  case "$OS" in
    wsl|linux-debian) PKG_MGR="apt" ;;
    macos)            PKG_MGR="brew" ;;
    linux-rhel)       PKG_MGR="dnf" ;;
    *)                PKG_MGR="" ;;
  esac
}

# ═══════════════════════════════════════════════════════════
# Phase 3: Header
# ═══════════════════════════════════════════════════════════

print_header() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║        Tofu-AT installer v${VERSION}        ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════
# Source detection: cloned repo vs curl pipe
# ═══════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
CLEANUP=false

resolve_source() {
  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/commands/tofu-at.md" ]; then
    SRC="$SCRIPT_DIR"
    info "Installing from local repo / 로컬 저장소에서 설치"
  else
    TEMP=$(mktemp -d)
    info "Cloning tofu-at... / tofu-at 다운로드 중..."
    if ! git clone --depth 1 "$REPO" "$TEMP/tofu-at" 2>/dev/null; then
      error "Failed to clone repository / 저장소 복제 실패"
      error "Check your internet connection and try again"
      exit 1
    fi
    SRC="$TEMP/tofu-at"
    CLEANUP=true
    success "Repository cloned / 저장소 복제 완료"
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 4: Prerequisites Check
# ═══════════════════════════════════════════════════════════

check_prerequisites() {
  step 1 "Checking prerequisites... / 사전요구사항 확인 중..."
  local missing=0

  # --- git ---
  if has_cmd git; then
    success "git $(git --version 2>/dev/null | head -1 | sed 's/git version //')"
  else
    error "git not found / git을 찾을 수 없습니다"
    if [ -n "$PKG_MGR" ]; then
      echo "    Install: sudo $PKG_MGR install -y git"
    fi
    missing=$((missing + 1))
  fi

  # --- Node.js ---
  if has_cmd node; then
    local node_ver
    node_ver=$(node --version 2>/dev/null)
    success "Node.js $node_ver"
  else
    warn "Node.js not found / Node.js를 찾을 수 없습니다"
    echo "    Recommended: install via nvm"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "    nvm install --lts"
    missing=$((missing + 1))
  fi

  # --- tmux ---
  if has_cmd tmux; then
    success "tmux $(tmux -V 2>/dev/null | sed 's/tmux //')"
  else
    warn "tmux not found / tmux를 찾을 수 없습니다"
    if [ -n "$PKG_MGR" ]; then
      echo ""
      echo -e "    ${YELLOW}Install tmux? / tmux를 설치할까요?${NC}"
      read -p "    (Y/n) " install_tmux
      if [[ ! "$install_tmux" =~ ^[Nn]$ ]]; then
        info "Installing tmux... / tmux 설치 중..."
        case "$PKG_MGR" in
          apt)  sudo apt update -qq && sudo apt install -y tmux ;;
          brew) brew install tmux ;;
          dnf)  sudo dnf install -y tmux ;;
        esac
        if has_cmd tmux; then
          success "tmux installed / tmux 설치 완료 ($(tmux -V 2>/dev/null))"
        else
          error "tmux installation failed / tmux 설치 실패"
          missing=$((missing + 1))
        fi
      else
        warn "tmux is required for Split Pane mode"
        missing=$((missing + 1))
      fi
    else
      echo "    Install tmux manually for your platform"
      missing=$((missing + 1))
    fi
  fi

  # --- Claude Code ---
  if has_cmd claude; then
    local claude_ver
    claude_ver=$(claude --version 2>/dev/null | head -1 || echo "unknown")
    success "Claude Code $claude_ver"
  else
    warn "Claude Code not found / Claude Code를 찾을 수 없습니다"
    echo "    Install: npm install -g @anthropic-ai/claude-code"
    echo "    Then: claude auth login"
    missing=$((missing + 1))
  fi

  if [ "$missing" -gt 0 ]; then
    echo ""
    warn "$missing prerequisite(s) missing / 사전요구사항 $missing개 누락"
    warn "tofu-at will install but may not work fully without them"
    echo ""
    read -p "  Continue anyway? / 계속 진행할까요? (Y/n) " cont
    if [[ "$cont" =~ ^[Nn]$ ]]; then
      info "Installation cancelled / 설치 취소됨"
      exit 0
    fi
  else
    echo ""
    success "All prerequisites met / 모든 사전요구사항 충족"
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 5: OS-specific Info
# ═══════════════════════════════════════════════════════════

show_os_info() {
  step 2 "Detected environment / 환경 감지..."

  local os_label
  case "$OS" in
    wsl)          os_label="WSL (Windows Subsystem for Linux)" ;;
    macos)        os_label="macOS" ;;
    linux-debian) os_label="Linux (Debian/Ubuntu)" ;;
    linux-rhel)   os_label="Linux (RHEL/Fedora)" ;;
    *)            os_label="Linux (other)" ;;
  esac

  success "OS: $os_label"
  [ -n "$PKG_MGR" ] && success "Package manager: $PKG_MGR"
}

# ═══════════════════════════════════════════════════════════
# Phase 6: File Installation
# ═══════════════════════════════════════════════════════════

install_files() {
  step 3 "Installing tofu-at files... / tofu-at 파일 설치 중..."

  # Command
  mkdir -p .claude/commands
  cp "$SRC/commands/tofu-at.md" .claude/commands/
  success ".claude/commands/tofu-at.md"

  # Skills
  mkdir -p .claude/skills
  local skill_count=0
  for f in "$SRC/skills/"*.md; do
    [ -f "$f" ] || continue
    cp "$f" .claude/skills/
    skill_count=$((skill_count + 1))
  done
  success ".claude/skills/tofu-at-*.md ($skill_count files)"

  step 4 "Setting up .team-os infrastructure... / .team-os 인프라 설정 중..."

  if [ ! -d ".team-os" ]; then
    cp -r "$SRC/.team-os" .
    chmod +x .team-os/hooks/*.js 2>/dev/null || true
    success ".team-os/ (registry, hooks, artifacts) — fresh install"
  else
    # Preserve existing registry, update hooks and artifacts
    cp "$SRC/.team-os/hooks/"*.js .team-os/hooks/ 2>/dev/null || true
    chmod +x .team-os/hooks/*.js 2>/dev/null || true
    for f in TEAM_PLAN.md TEAM_BULLETIN.md TEAM_FINDINGS.md TEAM_PROGRESS.md MEMORY.md; do
      if [ ! -f ".team-os/artifacts/$f" ]; then
        cp "$SRC/.team-os/artifacts/$f" .team-os/artifacts/ 2>/dev/null || true
      fi
    done
    success ".team-os/ (hooks updated, existing registry preserved)"
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 6.5: Agent Office Dashboard Installation
# ═══════════════════════════════════════════════════════════

install_agent_office() {
  echo ""
  echo -e "${BOLD}${CYAN}[4.5/$TOTAL_STEPS]${NC} ${BOLD}Installing Agent Office dashboard... / Agent Office 대시보드 설치 중...${NC}"

  if [ -d "agent-office" ] && [ -f "agent-office/server.js" ]; then
    success "Agent Office already exists / Agent Office 이미 존재"
  else
    if [ -d "$SRC/agent-office" ]; then
      cp -r "$SRC/agent-office" ./agent-office
      # Remove node_modules from copy (will be reinstalled)
      rm -rf ./agent-office/node_modules 2>/dev/null || true
      success "Agent Office copied from repo / Agent Office 복사 완료"
    else
      warn "Agent Office not found in source / 소스에 Agent Office 없음"
      warn "Dashboard will not be available / 대시보드 사용 불가"
      return 0
    fi
  fi

  # npm install (if agent-office exists and has package.json)
  if [ -f "agent-office/package.json" ]; then
    if has_cmd node && has_cmd npm; then
      info "Installing Agent Office dependencies... / 의존성 설치 중..."
      if (cd agent-office && npm install --production 2>/dev/null); then
        success "Agent Office dependencies installed / 의존성 설치 완료"
      else
        warn "npm install failed / npm 설치 실패"
        warn "Run manually: cd agent-office && npm install"
      fi
    else
      warn "Node.js/npm not found / Node.js/npm 미설치"
      warn "Run after installing Node.js: cd agent-office && npm install"
    fi
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 7: settings.local.json Auto-Configuration
# ═══════════════════════════════════════════════════════════

configure_settings() {
  step 5 "Configuring settings.local.json... / 설정 파일 구성 중..."

  local SETTINGS_FILE=".claude/settings.local.json"
  mkdir -p .claude

  # Use Python3 to merge JSON (Node.js fallback)
  if has_cmd python3; then
    python3 << 'PYEOF'
import json, os, sys

settings_path = ".claude/settings.local.json"

# Read existing settings
try:
    with open(settings_path, "r") as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    settings = {}

# Ensure required fields
settings.setdefault("env", {})
settings["env"]["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"] = "1"
settings["teammateMode"] = "tmux"

# Ensure hooks
settings.setdefault("hooks", {})

# TeammateIdle hook
idle_hook = {
    "hooks": [{
        "type": "command",
        "command": "node .team-os/hooks/teammate-idle-gate.js"
    }]
}

# TaskCompleted hook
completed_hook = {
    "hooks": [{
        "type": "command",
        "command": "node .team-os/hooks/task-completed-gate.js"
    }]
}

# Only add hooks if not already present (avoid duplicates)
def has_hook(hook_list, cmd_substring):
    for matcher in hook_list:
        hooks = matcher.get("hooks", [])
        for h in hooks:
            if cmd_substring in h.get("command", ""):
                return True
    return False

if "TeammateIdle" not in settings["hooks"]:
    settings["hooks"]["TeammateIdle"] = [idle_hook]
elif not has_hook(settings["hooks"]["TeammateIdle"], "teammate-idle-gate"):
    settings["hooks"]["TeammateIdle"].append(idle_hook)

if "TaskCompleted" not in settings["hooks"]:
    settings["hooks"]["TaskCompleted"] = [completed_hook]
elif not has_hook(settings["hooks"]["TaskCompleted"], "task-completed-gate"):
    settings["hooks"]["TaskCompleted"].append(completed_hook)

# Fix hooks format: wrap bare handlers in {hooks: [...]}
for ev in settings["hooks"]:
    fixed = []
    for m in settings["hooks"][ev]:
        if "hooks" not in m:
            fixed.append({"hooks": [m]})
        else:
            fixed.append(m)
    settings["hooks"][ev] = fixed

# Write back
with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")

print("OK")
PYEOF

    if [ $? -eq 0 ]; then
      success "settings.local.json configured (via Python3)"
    else
      warn "Python3 JSON merge failed, trying Node.js..."
      configure_settings_node
    fi

  elif has_cmd node; then
    configure_settings_node
  else
    warn "Neither python3 nor node available for JSON editing"
    warn "Please manually add to $SETTINGS_FILE:"
    echo '    "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }'
    echo '    "teammateMode": "tmux"'
  fi
}

configure_settings_node() {
  node << 'NODEEOF'
const fs = require("fs");
const path = ".claude/settings.local.json";
let settings = {};
try { settings = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}

settings.env = settings.env || {};
settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
settings.teammateMode = "tmux";

settings.hooks = settings.hooks || {};

const idleHook = { hooks: [{ type: "command", command: "node .team-os/hooks/teammate-idle-gate.js" }] };
const completedHook = { hooks: [{ type: "command", command: "node .team-os/hooks/task-completed-gate.js" }] };

function hasHook(list, sub) {
  return list.some(m => (m.hooks || []).some(h => (h.command || "").includes(sub)));
}

if (!settings.hooks.TeammateIdle) settings.hooks.TeammateIdle = [idleHook];
else if (!hasHook(settings.hooks.TeammateIdle, "teammate-idle-gate")) settings.hooks.TeammateIdle.push(idleHook);

if (!settings.hooks.TaskCompleted) settings.hooks.TaskCompleted = [completedHook];
else if (!hasHook(settings.hooks.TaskCompleted, "task-completed-gate")) settings.hooks.TaskCompleted.push(completedHook);

// Fix hooks format
for (const ev of Object.keys(settings.hooks)) {
  settings.hooks[ev] = settings.hooks[ev].map(m => m.hooks ? m : { hooks: [m] });
}

fs.writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
console.log("OK");
NODEEOF

  if [ $? -eq 0 ]; then
    success "settings.local.json configured (via Node.js)"
  else
    error "Failed to configure settings.local.json"
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 8: Verification
# ═══════════════════════════════════════════════════════════

verify_installation() {
  step 6 "Verifying installation... / 설치 검증 중..."

  local errors=0

  # Check files exist
  for f in .claude/commands/tofu-at.md; do
    if [ -f "$f" ]; then
      success "$f exists"
    else
      error "$f missing!"
      errors=$((errors + 1))
    fi
  done

  # Check skills
  local skill_count
  skill_count=$(ls .claude/skills/tofu-at-*.md 2>/dev/null | wc -l)
  if [ "$skill_count" -ge 1 ]; then
    success ".claude/skills/tofu-at-*.md ($skill_count files)"
  else
    error "No tofu-at skill files found!"
    errors=$((errors + 1))
  fi

  # Check .team-os
  if [ -d ".team-os/hooks" ] && [ -d ".team-os/artifacts" ]; then
    success ".team-os/ directory structure"
  else
    error ".team-os/ directory incomplete!"
    errors=$((errors + 1))
  fi

  # Check Agent Office
  if [ -f "agent-office/server.js" ]; then
    success "agent-office/server.js exists"
  else
    warn "Agent Office not installed (dashboard unavailable)"
  fi

  # Check settings.local.json validity
  if [ -f ".claude/settings.local.json" ]; then
    if python3 -c "import json; json.load(open('.claude/settings.local.json'))" 2>/dev/null || \
       node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8'))" 2>/dev/null; then
      success "settings.local.json is valid JSON"
    else
      error "settings.local.json is invalid JSON!"
      errors=$((errors + 1))
    fi
  else
    warn "settings.local.json not found (may need manual configuration)"
  fi

  if [ "$errors" -gt 0 ]; then
    error "$errors verification error(s) / 검증 오류 $errors개"
  else
    success "All checks passed / 모든 검증 통과"
  fi
}

# ═══════════════════════════════════════════════════════════
# Phase 9: Completion Summary
# ═══════════════════════════════════════════════════════════

print_summary() {
  step 7 "Done! / 완료!"

  local os_short tmux_ver node_ver
  case "$OS" in
    wsl)          os_short="WSL" ;;
    macos)        os_short="macOS" ;;
    linux-debian) os_short="Debian/Ubuntu" ;;
    linux-rhel)   os_short="RHEL/Fedora" ;;
    *)            os_short="Linux" ;;
  esac
  tmux_ver=$(tmux -V 2>/dev/null | sed 's/tmux //' || echo "N/A")
  node_ver=$(node --version 2>/dev/null || echo "N/A")

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  Tofu-AT v${VERSION} installed! / 설치 완료!            ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}OS:${NC}    $os_short  |  ${CYAN}tmux:${NC} $tmux_ver  |  ${CYAN}Node:${NC} $node_ver"
  echo ""
  echo -e "  ${BOLD}Next steps / 다음 단계:${NC}"
  echo "    1. claude --model=opus[1m]"
  echo "    2. Type /tofu-at / /tofu-at 입력"
  echo ""
  echo -e "  ${CYAN}(Optional / 선택)${NC} ai/ain shortcuts / 단축키 설정:"

  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/setup-bashrc.sh" ]; then
    echo "    bash $SCRIPT_DIR/setup-bashrc.sh $(pwd)"
  else
    echo "    bash setup-bashrc.sh \$(pwd)"
  fi

  echo ""
  echo -e "  ${CYAN}Docs / 문서:${NC}"
  echo "    https://github.com/treylom/tofu-at"
  echo ""
}

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

main() {
  print_header
  detect_os
  resolve_source
  check_prerequisites
  show_os_info
  install_files
  install_agent_office
  configure_settings
  verify_installation
  print_summary

  # Cleanup temp directory
  if [ "$CLEANUP" = true ] && [ -n "$TEMP" ]; then
    rm -rf "$TEMP"
  fi
}

main "$@"
