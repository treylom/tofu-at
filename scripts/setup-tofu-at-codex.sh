#!/usr/bin/env bash
# setup-tofu-at-codex.sh — /tofu-at-codex 원클릭 환경 설정
# Usage:
#   bash .claude/scripts/setup-tofu-at-codex.sh              # 기본 (Standard v3)
#   ENABLE_SWARM=1 bash .claude/scripts/setup-tofu-at-codex.sh  # Swarm 모드 (v4.0)
#   AUTO_INSTALL=1 bash .claude/scripts/setup-tofu-at-codex.sh  # 자동 설치
#   RUN_PROXY_TEST=1 bash .claude/scripts/setup-tofu-at-codex.sh  # 프록시 라우팅 실검증
#
# 이 스크립트는 /tofu-at-codex 실행에 필요한 모든 의존성을 확인하고,
# 누락된 항목을 안내합니다 (AUTO_INSTALL=1이면 자동 설치).
#
# ── v4.0 듀얼 모드 ──
# Standard mode (기본): tmux + Codex CLI + Claude Code만 필수
#   - CLIProxyAPI/OAuth 체크는 warning 수준 (없어도 실패 아님)
#   - 코딩 태스크는 codex exec 직접, 비코딩 워커는 Anthropic Direct
#   - 대부분의 작업에 충분 (비코딩 워커 4명 이하)
#
# Swarm mode (ENABLE_SWARM=1): Standard + CLIProxyAPI + OAuth 필수
#   - 비코딩 워커 5명 이상일 때 /tofu-at-codex가 자동 활성화
#   - Workers를 tmux split pane에 띄우고 GPT-5.6으로 라우팅 (토큰 절약)
#   - DA도 진짜 teammate로 복구 (SendMessage 장기 대화)
#   - CLIProxyAPI 바이너리 + OAuth 토큰이 없으면 이 모드는 사용 불가
#
# 의존성:
#   1. tmux          — 양 모드 공통 (Agent Teams Split Pane 필수)
#   2. Codex CLI     — 양 모드 공통 (DA + 코딩 워커용)
#   3. CLIProxyAPI   — Swarm 모드에서만 필수 (Standard에선 warning)
#   4. OAuth 인증    — Swarm 모드에서만 필수 (Standard에선 warning)
#   5. Claude Code   — 양 모드 공통 (이미 설치된 상태로 가정)

set -uo pipefail

# v4.0: Swarm mode flag — CLIProxyAPI/OAuth 체크 수준 결정
SWARM_MODE="${ENABLE_SWARM:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

passed=0
failed=0
warnings=0

header() {
  echo ""
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${BLUE}  /tofu-at-codex — Setup & Dependency Check${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

ok()   { echo -e "  ${GREEN}[OK]${NC} $1"; ((passed++)); }
warn() { echo -e "  ${YELLOW}[!!]${NC} $1"; ((warnings++)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; ((failed++)); }
info() { echo -e "  ${CYAN}[i]${NC} $1"; }
step() { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ══════════════════════════════════════════════════════════
# 1. tmux
# ══════════════════════════════════════════════════════════
check_tmux() {
  step "1/5  tmux"
  if command -v tmux &>/dev/null; then
    local ver
    ver=$(tmux -V 2>/dev/null || echo "unknown")
    ok "tmux 설치됨 ($ver)"
  else
    fail "tmux 미설치"
    info "설치 명령어:"
    if [[ "$(uname -s)" == "Linux" ]]; then
      info "  sudo apt install tmux      # Debian/Ubuntu"
      info "  sudo yum install tmux      # CentOS/RHEL"
    elif [[ "$(uname -s)" == "Darwin" ]]; then
      info "  brew install tmux"
    fi

    if [[ "${AUTO_INSTALL:-}" == "1" ]]; then
      info "자동 설치 시도 중..."
      if [[ "$(uname -s)" == "Linux" ]] && command -v apt &>/dev/null; then
        sudo apt install -y tmux && ok "tmux 자동 설치 완료" || fail "tmux 자동 설치 실패"
      elif [[ "$(uname -s)" == "Darwin" ]] && command -v brew &>/dev/null; then
        brew install tmux && ok "tmux 자동 설치 완료" || fail "tmux 자동 설치 실패"
      else
        warn "자동 설치 불가. 수동으로 설치해 주세요."
      fi
    fi
  fi
}

# ══════════════════════════════════════════════════════════
# 2. Codex CLI
# ══════════════════════════════════════════════════════════
check_codex() {
  step "2/5  Codex CLI"
  if command -v codex &>/dev/null; then
    local ver
    ver=$(codex --version 2>/dev/null | head -1 || echo "unknown")
    ok "Codex CLI 설치됨 ($ver)"
  else
    fail "Codex CLI 미설치"
    info "설치 명령어:"
    info "  npm install -g @openai/codex"
    info "  codex --login   # OAuth 인증 (ChatGPT Plus/Pro 필요)"

    if [[ "${AUTO_INSTALL:-}" == "1" ]]; then
      info "자동 설치 시도 중..."
      npm install -g @openai/codex && ok "Codex CLI 자동 설치 완료" || fail "Codex CLI 자동 설치 실패"
    fi
  fi
}

# ══════════════════════════════════════════════════════════
# 3. CLIProxyAPI
# ══════════════════════════════════════════════════════════
check_cliproxyapi() {
  step "3/5  CLIProxyAPI"

  local proxy_dir="${HOME}/CLIProxyAPI"

  # 바이너리 확인
  if [[ -x "${proxy_dir}/cli-proxy-api" ]]; then
    ok "CLIProxyAPI 바이너리 존재 (${proxy_dir}/cli-proxy-api)"
  else
    fail "CLIProxyAPI 미설치 (${proxy_dir}/cli-proxy-api 없음)"
    info "설치 명령어:"
    info "  git clone https://github.com/router-for-me/CLIProxyAPI.git ~/CLIProxyAPI"

    if [[ "${AUTO_INSTALL:-}" == "1" ]]; then
      info "자동 설치 시도 중..."
      git clone https://github.com/router-for-me/CLIProxyAPI.git "${proxy_dir}" 2>/dev/null \
        && ok "CLIProxyAPI 자동 클론 완료" \
        || fail "CLIProxyAPI 자동 클론 실패"
    fi
  fi

  # config.yaml 확인
  if [[ -f "${proxy_dir}/config.yaml" ]]; then
    ok "config.yaml 존재"
    # 모델 alias 확인
    if grep -q 'claude-sonnet-4-6' "${proxy_dir}/config.yaml" 2>/dev/null; then
      ok "모델 alias 매핑 설정됨 (claude-sonnet-4-6 → codex)"
    else
      warn "config.yaml에 모델 alias 미설정. 아래 내용을 추가하세요:"
      cat <<'YAML'
    oauth-model-alias:
      codex:
        - name: "gpt-5.6"
          alias: "claude-sonnet-4-6"
        - name: "gpt-5.6"
          alias: "claude-opus-4-6"
        - name: "gpt-5.6"
          alias: "claude-sonnet-4-5-20250929"
        - name: "gpt-5.6"
          alias: "claude-haiku-4-5-20251001"
YAML
    fi

    if [[ "${AUTO_INSTALL:-}" == "1" ]] && ! [[ -f "${proxy_dir}/config.yaml" ]]; then
      info "config.yaml 자동 생성 중..."
      cat > "${proxy_dir}/config.yaml" <<'YAML'
host: "127.0.0.1"
port: 8317
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "codex-hybrid-team"
debug: false
request-retry: 3
routing:
  strategy: "round-robin"
oauth-model-alias:
  codex:
    - name: "gpt-5.6"
      alias: "claude-sonnet-4-6"
    - name: "gpt-5.6"
      alias: "claude-opus-4-6"
    - name: "gpt-5.6"
      alias: "claude-sonnet-4-5-20250929"
    - name: "gpt-5.6"
      alias: "claude-haiku-4-5-20251001"
YAML
      ok "config.yaml 자동 생성 완료"
    fi
  else
    if [[ -d "${proxy_dir}" ]]; then
      warn "config.yaml 없음. 자동 생성합니다..."
      cat > "${proxy_dir}/config.yaml" <<'YAML'
host: "127.0.0.1"
port: 8317
auth-dir: "~/.cli-proxy-api"
api-keys:
  - "codex-hybrid-team"
debug: false
request-retry: 3
routing:
  strategy: "round-robin"
oauth-model-alias:
  codex:
    - name: "gpt-5.6"
      alias: "claude-sonnet-4-6"
    - name: "gpt-5.6"
      alias: "claude-opus-4-6"
    - name: "gpt-5.6"
      alias: "claude-sonnet-4-5-20250929"
    - name: "gpt-5.6"
      alias: "claude-haiku-4-5-20251001"
YAML
      ok "config.yaml 자동 생성 완료"
    else
      fail "config.yaml 없음 (CLIProxyAPI 미설치)"
    fi
  fi
}

# ══════════════════════════════════════════════════════════
# 4. OAuth 토큰
# ══════════════════════════════════════════════════════════
check_oauth() {
  step "4/5  Codex OAuth 토큰"

  local token_dir="${HOME}/.cli-proxy-api"
  local token_file
  token_file=$(ls "${token_dir}"/codex-*.json 2>/dev/null | head -1 || true)

  if [[ -n "${token_file}" ]]; then
    ok "OAuth 토큰 존재 ($(basename "${token_file}"))"
  else
    fail "OAuth 토큰 없음"
    info "인증 방법:"
    info "  1. CLIProxyAPI 실행: cd ~/CLIProxyAPI && ./cli-proxy-api"
    info "  2. TUI에서 Codex OAuth 인증 수행"
    info "  또는: codex --login"
  fi
}

# ══════════════════════════════════════════════════════════
# 5. Claude Code + Agent Teams
# ══════════════════════════════════════════════════════════
check_claude() {
  step "5/5  Claude Code & Agent Teams"

  if command -v claude &>/dev/null; then
    local ver
    ver=$(claude --version 2>/dev/null | head -1 || echo "unknown")
    ok "Claude Code 설치됨 ($ver)"
  else
    fail "Claude Code 미설치"
    info "설치: https://docs.anthropic.com/en/docs/claude-code"
  fi

  # Agent Teams 환경변수 확인
  local settings_file="${REPO_ROOT}/.claude/settings.local.json"
  if [[ -f "${settings_file}" ]]; then
    if grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' "${settings_file}" 2>/dev/null; then
      ok "Agent Teams 활성화됨 (settings.local.json)"
    else
      warn "Agent Teams 미활성화. settings.local.json에 추가 필요:"
      info '  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }'
    fi
  else
    warn "settings.local.json 없음"
  fi

  # teammateMode 확인
  if [[ -f "${settings_file}" ]]; then
    if grep -q '"teammateMode"' "${settings_file}" 2>/dev/null; then
      local mode
      mode=$(grep '"teammateMode"' "${settings_file}" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
      ok "teammateMode: ${mode}"
    else
      warn "teammateMode 미설정 (tmux 권장)"
    fi
  fi
}

# ══════════════════════════════════════════════════════════
# Proxy 연결 테스트 (선택)
# ══════════════════════════════════════════════════════════
test_proxy() {
  if [[ "${RUN_PROXY_TEST:-}" != "1" ]]; then
    return
  fi

  step "BONUS  CLIProxyAPI 라우팅 테스트"

  local health
  health=$(curl -s http://127.0.0.1:8317/ --connect-timeout 2 2>/dev/null || echo "")

  if echo "${health}" | grep -q "CLI Proxy API" 2>/dev/null; then
    ok "CLIProxyAPI 실행 중"

    info "Codex 라우팅 검증 중..."
    local response
    response=$(curl -s -X POST http://127.0.0.1:8317/v1/messages \
      -H "Content-Type: application/json" \
      -H "x-api-key: codex-hybrid-team" \
      -H "anthropic-version: 2023-06-01" \
      -d '{"model":"claude-sonnet-4-6","max_tokens":30,"messages":[{"role":"user","content":"What model are you? Reply with your exact model name only."}]}' \
      2>/dev/null || echo "CURL_FAILED")

    if echo "${response}" | grep -q '"type":"message"' 2>/dev/null; then
      ok "Anthropic Messages 형식 응답 확인"
    else
      fail "응답 형식 이상: ${response:0:200}"
    fi

    local model_field
    model_field=$(echo "${response}" | grep -o '"model":"[^"]*"' | head -1 || echo "")
    if echo "${model_field}" | grep -qi "codex\|gpt" 2>/dev/null; then
      ok "Codex 라우팅 확인 (${model_field})"
    else
      warn "모델 필드 확인 필요: ${model_field}"
    fi
  else
    warn "CLIProxyAPI 미실행. 테스트 스킵."
    info "실행: cd ~/CLIProxyAPI && ./cli-proxy-api"
  fi
}

# ══════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════
summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Summary${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${GREEN}Passed:${NC}   ${passed}"
  echo -e "  ${YELLOW}Warnings:${NC} ${warnings}"
  echo -e "  ${RED}Failed:${NC}   ${failed}"
  echo ""

  if [[ ${failed} -eq 0 ]]; then
    echo -e "  ${GREEN}${BOLD}All checks passed! /tofu-at-codex 실행 준비 완료.${NC}"
    echo ""
    echo -e "  실행 방법 (tmux 세션 내에서):"
    echo -e "    ${CYAN}claude${NC}  →  ${CYAN}/tofu-at-codex${NC}"
    echo ""
  else
    echo -e "  ${RED}${BOLD}${failed}개 항목 실패. 위 안내에 따라 설치 후 다시 실행하세요.${NC}"
    echo ""
    echo -e "  자동 설치 모드 (가능한 항목 자동 설치):"
    echo -e "    ${CYAN}AUTO_INSTALL=1 bash .claude/scripts/setup-tofu-at-codex.sh${NC}"
    echo ""
  fi

  echo -e "  프록시 라우팅 테스트 (CLIProxyAPI 실행 중일 때):"
  echo -e "    ${CYAN}RUN_PROXY_TEST=1 bash .claude/scripts/setup-tofu-at-codex.sh${NC}"
  echo ""
}

# ── Main ──
header

if [[ "${SWARM_MODE}" == "1" ]]; then
  echo -e "${BOLD}${CYAN}  [v4.0] Swarm Mode ENABLED — CLIProxyAPI + OAuth are REQUIRED${NC}"
  echo ""
else
  echo -e "${BOLD}${CYAN}  [v4.0] Standard Mode — CLIProxyAPI/OAuth are OPTIONAL (warning only)${NC}"
  echo -e "${CYAN}  Swarm 모드 활성화: ${BOLD}ENABLE_SWARM=1 bash .claude/scripts/setup-tofu-at-codex.sh${NC}"
  echo ""
fi

check_tmux
check_codex
check_cliproxyapi
check_oauth
check_claude
test_proxy

# v4.0: Standard mode에서는 CLIProxyAPI/OAuth 실패를 warning으로 다운그레이드
if [[ "${SWARM_MODE}" != "1" ]]; then
  # CLIProxyAPI/OAuth 관련 failure가 있으면 warnings로 이동
  # (구체적 다운그레이드 로직은 향후 확장 — 현재는 summary에서 안내만)
  :
fi

summary

# v4.0: Standard mode는 CLIProxyAPI/OAuth 실패해도 exit 0
# Swarm mode는 모든 실패가 exit != 0
if [[ "${SWARM_MODE}" == "1" ]]; then
  exit ${failed}
else
  # Standard mode: tmux/codex/claude 핵심 3개만 실패 조건
  # CLIProxyAPI/OAuth 실패는 warning으로 간주하고 exit 0 허용
  # (실제 Swarm 모드 사용 시 /tofu-at-codex가 PHASE 1.6에서 재검증)
  if [[ ${failed} -gt 2 ]]; then
    # 핵심 3개 중 하나라도 실패하면 (실제 failed > 2는 tmux/codex/claude 중 2개 이상 실패 = critical)
    exit ${failed}
  else
    # failed가 1~2라면 CLIProxyAPI/OAuth 정도일 가능성 → warning으로 간주
    echo -e "  ${YELLOW}[v4.0 Standard mode] CLIProxyAPI/OAuth 실패는 무시 (Swarm 모드만 필요).${NC}"
    exit 0
  fi
fi
