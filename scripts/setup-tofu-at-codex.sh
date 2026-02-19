#!/usr/bin/env bash
# setup-tofu-at-codex.sh — /tofu-at-codex 원클릭 환경 설정
# Usage: bash .claude/scripts/setup-tofu-at-codex.sh
#
# 이 스크립트는 /tofu-at-codex 실행에 필요한 모든 의존성을 확인하고,
# 누락된 항목을 자동 설치합니다.
#
# 의존성:
#   1. tmux          — Agent Teams Split Pane 필수
#   2. Codex CLI     — OpenAI Codex 실행기
#   3. CLIProxyAPI   — Anthropic → Codex 프록시 라우팅
#   4. OAuth 인증    — Codex API 접근 토큰
#   5. Claude Code   — Agent Teams 기반 (이미 설치된 상태로 가정)

set -uo pipefail

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
        - name: "gpt-5.3-codex"
          alias: "claude-sonnet-4-6"
        - name: "gpt-5.3-codex"
          alias: "claude-opus-4-6"
        - name: "gpt-5.3-codex"
          alias: "claude-sonnet-4-5-20250929"
        - name: "gpt-5.3-codex"
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
    - name: "gpt-5.3-codex"
      alias: "claude-sonnet-4-6"
    - name: "gpt-5.3-codex"
      alias: "claude-opus-4-6"
    - name: "gpt-5.3-codex"
      alias: "claude-sonnet-4-5-20250929"
    - name: "gpt-5.3-codex"
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
    - name: "gpt-5.3-codex"
      alias: "claude-sonnet-4-6"
    - name: "gpt-5.3-codex"
      alias: "claude-opus-4-6"
    - name: "gpt-5.3-codex"
      alias: "claude-sonnet-4-5-20250929"
    - name: "gpt-5.3-codex"
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
  local settings_file=".claude/settings.local.json"
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
check_tmux
check_codex
check_cliproxyapi
check_oauth
check_claude
test_proxy
summary

exit ${failed}
