---
description: "Codex 하이브리드 팀 (Leader=Opus, Teammates=Codex via CLIProxyAPI)"
allowedTools: Bash, Read, Write, Glob, Grep, Skill, AskUserQuestion, Task, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, SendMessage
---

# /tofu-at-codex — Codex Hybrid Team

> **Leader = Opus (Anthropic Direct)**
> **Teammates = GPT-5.3-Codex (CLIProxyAPI proxy)**
>
> 기존 `/tofu-at` 워크플로우를 그대로 사용하되,
> 팀원(Worker/DA)만 Codex로 실행하는 하이브리드 모드입니다.

$ARGUMENTS

---

## Quick Start (설치 가이드)

### 원클릭 환경 체크

```bash
bash .claude/scripts/setup-tofu-at-codex.sh
```

모든 의존성을 자동 확인합니다. 누락 항목이 있으면 설치 명령어를 안내합니다.

**자동 설치 모드** (가능한 항목 자동 설치):
```bash
AUTO_INSTALL=1 bash .claude/scripts/setup-tofu-at-codex.sh
```

### 의존성 목록

| # | 의존성 | 용도 | 설치 명령어 |
|---|--------|------|------------|
| 1 | **tmux** | Agent Teams Split Pane | `sudo apt install tmux` (Linux) / `brew install tmux` (macOS) |
| 2 | **Codex CLI** | OpenAI Codex 실행기 | `npm install -g @openai/codex && codex --login` |
| 3 | **CLIProxyAPI** | Anthropic→Codex 프록시 | `git clone https://github.com/router-for-me/CLIProxyAPI.git ~/CLIProxyAPI` |
| 4 | **OAuth 토큰** | Codex API 인증 | `cd ~/CLIProxyAPI && ./cli-proxy-api` (TUI에서 인증) |
| 5 | **Claude Code** | Agent Teams 기반 | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |

### CLIProxyAPI config.yaml (자동 생성됨)

setup 스크립트가 자동 생성하지만, 수동 설정이 필요한 경우:

```yaml
# ~/CLIProxyAPI/config.yaml
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
```

### 실행 방법

```bash
# 1. tmux 세션 시작 (이미 tmux 안이면 스킵)
tmux new -s claude

# 2. Claude Code 실행
claude

# 3. /tofu-at-codex 실행
/tofu-at-codex
```

### 프록시 라우팅 테스트

```bash
RUN_PROXY_TEST=1 bash .claude/scripts/setup-tofu-at-codex.sh
```

---

<mindset priority="HIGHEST">
이 명령어는 **환경 설정만 수행**하고, 팀 구성은 `/tofu-at`에 위임합니다.

핵심 원리 — **시간차 환경변수 주입**:
1. Leader(현재 프로세스)는 이미 Opus로 실행 중 → process.env 변경 불가
2. `tmux set-environment`로 세션 레벨에 프록시 URL 설정
3. `/tofu-at` → TeamCreate → Task spawn → 새 pane 생성
4. 새 pane은 tmux 세션 env를 상속 → `ANTHROPIC_BASE_URL=proxy` → Codex로 라우팅

기술 근거 (cli.js spawn 명령):
- spawn: `cd {cwd} && env CLAUDECODE=1 ... claude --agent-id ...` (`env -i` 미사용)
- Leader의 process.env에 ANTHROPIC_BASE_URL이 없으면 env prefix에 미포함
- pane의 shell이 tmux 세션 env를 상속 → claude 프로세스에 전달

CLIProxyAPI 검증 결과:
- Anthropic Messages API (`/v1/messages`) 네이티브 지원 확인됨
- 모델 alias 매핑 작동: `claude-sonnet-4-6` → `gpt-5.3-codex`
- 응답 형식 호환: `type: "message"`, `content[].type: "text"`, `stop_reason`
- 브릿지 프록시 불필요

<model_display_notice priority="HIGH">
**UI 표시 vs 실제 모델 (CRITICAL)**

Claude Code의 UI/config/Agent Office에는 팀원이 `sonnet 4.6`으로 표시됩니다.
이것은 Claude Code가 spawn 시 지정한 model 파라미터를 표시하기 때문이며,
**실제 API 응답의 model 필드는 `gpt-5.3-codex`로 반환**됩니다.

CLIProxyAPI 측에서는 라우팅된 실제 모델명(`gpt-5.3-codex`)이 정상 표시됩니다.
(참고: https://www.threads.com/@trading.inventory/post/DU8DEbNkuGH)

검증 방법 (PHASE 1-4에서 자동 수행):
1. CLIProxyAPI 응답의 `"model"` 필드 확인 → `gpt-5.3-codex` (API 레벨 검증)
2. 팀원에게 "What model are you?" 질문 → "ChatGPT" 응답 (모델 자기 식별)
3. CLIProxyAPI 로그/TUI에서 라우팅 확인 (서버 레벨 검증)

추론 레벨: Claude Code가 extended thinking을 보내면 budget_tokens에 따라 결정.
미전송 시 Codex 기본값 `medium`. (상세: tofu-at-overrides 참조)

결론: Claude Code UI 표시는 클라이언트 제약. 실제 라우팅은 정상.
PHASE 1-4 검증 결과를 사용자에게 명시적으로 보여줘서 혼동 방지.
</model_display_notice>

<tofu-at-overrides priority="HIGH">
**tofu-at 위임 시 오버라이드 사항**

tofu-at의 STEP 2-B (DA 모델 선택)에서 선택지를 다음으로 대체:
- "OFF" — DA 없이 진행
- "ON (Codex) (Recommended)" — GPT-5.3-Codex로 DA (CLIProxyAPI 경유)
- "ON (Opus)" — Anthropic Opus로 DA (Leader와 동일, Anthropic Direct)

**Codex 추론 레벨 제어 — MAX_THINKING_TOKENS 순차 스폰 방식 (테스트 검증 완료):**

CLIProxyAPI의 `apply.go` thinking 모듈이 reasoning.effort를 제어합니다.
Claude Code는 `MAX_THINKING_TOKENS` 환경변수로 thinking budget을 결정하며,
CLIProxyAPI가 이를 Codex의 reasoning.effort 레벨로 변환합니다:

| MAX_THINKING_TOKENS | budget_tokens | reasoning.effort |
|--------------------|--------------|-----------------|
| ~1024 | ~1024 | low |
| ~8192 | ~8192 | medium |
| ~16384 | ~16384 | **high** |
| ~31999 (기본값) | ~31999 | **xhigh** |

**역할별 추론 레벨 차등 적용 (순차 스폰 방식):**

tmux 세션 환경변수는 pane 생성 시점에 상속되므로, 스폰 순서를 제어하면
DA와 Worker에 서로 다른 thinking budget을 적용할 수 있습니다:

```
1. tmux set-environment MAX_THINKING_TOKENS {DA_BUDGET}
2. DA 스폰 → DA pane은 {DA_BUDGET} 상속
3. tmux set-environment MAX_THINKING_TOKENS {WORKER_BUDGET}
4. Workers 스폰 → Worker panes는 {WORKER_BUDGET} 상속
```

기본값: DA = 31999 (xhigh), Workers = 31999 (xhigh). 둘 다 xhigh.
PHASE 2.3에서 사용자가 원하면 변경 가능합니다.

**tofu-at STEP 7-4-1 스폰 순서 오버라이드 (CRITICAL):**
원본 tofu-at는 DA와 Worker를 동시 스폰하지만,
Codex Hybrid 모드에서는 **DA 먼저 → Workers 후** 순차 스폰으로 변경합니다.
이유: tmux 세션 env를 스폰 사이에 변경해야 역할별 차등 적용 가능.

**DA 흐름: tofu-at 원본 그대로 사용 (수정 없음)**

tofu-at의 DA 2-Phase 흐름을 그대로 따릅니다:
- STEP 7-4-1: DA를 워커와 함께 스폰 (동시)
- STEP 7-6: 각 워커 결과 수신 시 DA에게 개별 리뷰 요청 (Phase 1)
- STEP 7-6.5: 모든 워커 완료 후 DA 종합 검토 (Phase 2)
- STEP 7-7: DA 셧다운

DA 모델 선택지만 오버라이드 (위 STEP 2-B 참조).

Why: tofu-at의 DA 흐름에서 idle 문제는 개별 리뷰 단계(STEP 7-6)를 생략했기 때문.
tofu-at를 올바르게 위임하면 DA가 워커 결과마다 리뷰 작업을 받으므로 idle 시간이 짧음.
</tofu-at-overrides>

절대 금지:
- 기존 tofu-at.md 수정 X
- tofu-at 스킬 파일 수정 X
- Leader 프로세스의 ANTHROPIC_BASE_URL 설정 X (Opus 유지 필수)
</mindset>

---

## PHASE 0: 사전 요구사항 확인 (자동화)

### 0-SKIP: 검증 캐시 확인 (최초 1회 이후 스킵)

```
Glob(".team-os/.env-verified") 존재 확인:

IF 존재:
  Read(".team-os/.env-verified") → JSON 파싱
  IF verified.session == current_tmux_session AND verified.agent_teams == true:
    → "환경 검증 캐시 유효. PHASE 0 스킵합니다."
    → env_profile = verified.env_profile  (캐시된 값 사용)
    → PHASE 1로 직접 진행
  ELSE:
    → 캐시 무효 (세션 불일치). 전체 검증 진행.

ELSE:
  → 캐시 없음. 전체 검증 진행.
```

캐시 무효 또는 미존재 시 → 아래 0-0부터 전체 실행.
검증 완료 후 캐시는 tofu-at의 STEP 0.5에서 저장됩니다.
(참고: CLIProxyAPI 헬스체크(PHASE 1)는 프록시 상태이므로 매번 실행 — 캐시 대상 아님)

### 0-0. Setup 스크립트로 일괄 확인 (권장)

```bash
bash .claude/scripts/setup-tofu-at-codex.sh
```

- exit code 0 → 모든 의존성 OK, PHASE 1로 진행
- exit code > 0 → 누락 항목 안내됨. 사용자에게 안내 후 **중단**:

> 일부 의존성이 누락되었습니다. 자동 설치를 시도할까요?

```
AskUserQuestion({
  "questions": [{
    "question": "누락된 의존성을 자동 설치할까요?",
    "header": "Setup",
    "options": [
      {"label": "자동 설치 (Recommended)", "description": "AUTO_INSTALL=1로 가능한 항목 자동 설치"},
      {"label": "수동 설치", "description": "설치 명령어만 확인하고 직접 설치"},
      {"label": "취소", "description": "명령어 실행 중단"}
    ],
    "multiSelect": false
  }]
})
```

**자동 설치 선택 시:**
```bash
AUTO_INSTALL=1 bash .claude/scripts/setup-tofu-at-codex.sh
```

**수동 설치 선택 시:** 스크립트 출력의 안내 메시지를 따라 개별 설치.

### 0-1. Codex CLI 확인 (setup 스크립트가 수행)

- 성공 → 버전 표시 후 계속
- 실패 → 설치 안내:
  ```bash
  npm install -g @openai/codex
  codex --login   # OAuth 인증 (ChatGPT Plus/Pro 필요)
  ```

### 0-2. CLIProxyAPI 확인 (setup 스크립트가 수행)

- 바이너리 + config.yaml + 모델 alias 모두 확인
- config.yaml 미존재 시 자동 생성 (setup 스크립트 내장)

### 0-3. OAuth 토큰 확인 (setup 스크립트가 수행)

- 토큰 없음 → 안내:
  ```bash
  cd ~/CLIProxyAPI && ./cli-proxy-api
  # TUI에서 Codex OAuth 인증 수행
  ```

---

## PHASE 1: CLIProxyAPI 프록시 시작

### 1-1. 기존 프록시 헬스체크

```bash
curl -s http://127.0.0.1:8317/ --connect-timeout 2 | grep -q "CLI Proxy API" && echo "RUNNING" || echo "NOT_RUNNING"
```

- `RUNNING` → 이미 실행 중, 스킵
- `NOT_RUNNING` → 프록시 시작 필요

### 1-2. 프록시 백그라운드 시작

```bash
cd ~/CLIProxyAPI && ./cli-proxy-api
```
`run_in_background: true`로 실행.

### 1-3. 헬스체크 루프 (최대 15초)

```bash
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:8317/ --connect-timeout 1 2>/dev/null | grep -q "CLI Proxy API"; then
    echo "PROXY_READY"
    exit 0
  fi
  sleep 1
done
echo "PROXY_TIMEOUT"
exit 1
```

- `PROXY_READY` → 계속
- `PROXY_TIMEOUT` → 에러 안내 후 **중단**:

> CLIProxyAPI가 15초 내에 시작되지 않았습니다.
> ```bash
> cd ~/CLIProxyAPI && ./cli-proxy-api
> ```
> 수동으로 실행하고 다시 시도해 주세요.

### 1-4. Codex 라우팅 검증 (CRITICAL — 사용자에게 결과 표시!)

```bash
RESPONSE=$(curl -s -X POST http://127.0.0.1:8317/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: codex-hybrid-team" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":30,"messages":[{"role":"user","content":"What model are you? Reply with your exact model name only."}]}')
echo "$RESPONSE"
```

검증 항목 3가지:
1. 응답의 `"model"` 필드 → `gpt-5.3-codex`이어야 함
2. 응답 내용 → "ChatGPT" 또는 "GPT" 포함이어야 함
3. `"type":"message"` 형식이어야 함

**사용자에게 검증 결과 표시:**

> **Codex 라우팅 검증:**
> | 검증 항목 | 기대값 | 실제값 | 결과 |
> |----------|--------|--------|------|
> | 요청 모델 | claude-sonnet-4-6 | claude-sonnet-4-6 | - |
> | 응답 model 필드 | gpt-5.3-codex | {실제값} | OK/FAIL |
> | 모델 자기 식별 | ChatGPT/GPT | {실제값} | OK/FAIL |
> | 응답 형식 | Anthropic Messages | {type:message} | OK/FAIL |
>
> **참고**: Claude Code UI에는 팀원이 `sonnet 4.6`으로 표시됩니다.
> 이것은 클라이언트 측 모델명이며, 실제 API 호출은 CLIProxyAPI를 경유하여
> `gpt-5.3-codex`로 라우팅됩니다.

- 3개 모두 OK → 계속
- FAIL → 에러 안내 + config.yaml의 oauth-model-alias 확인 권고

---

## PHASE 2: tmux 세션 환경변수 주입 (CRITICAL)

### 2-1. 현재 tmux 세션명 확인

```bash
tmux display-message -p '#S'
```

tmux 미실행 시 **중단**:
> tmux 세션 내에서 실행해야 합니다.
> `tmux new -s claude` 등으로 세션을 시작한 후 다시 시도해 주세요.

### 2-2. 세션 환경변수 설정

```bash
TMUX_SESSION=$(tmux display-message -p '#S')
tmux set-environment -t "$TMUX_SESSION" ANTHROPIC_BASE_URL "http://127.0.0.1:8317"
tmux set-environment -t "$TMUX_SESSION" ANTHROPIC_AUTH_TOKEN "codex-hybrid-team"
```

### 2-3. Leader 격리 확인

Leader(현재 프로세스)의 env에는 ANTHROPIC_BASE_URL이 없어야 합니다:

```bash
echo "LEADER_BASE_URL=${ANTHROPIC_BASE_URL:-UNSET}"
```

- `LEADER_BASE_URL=UNSET` → 정상 (Leader는 Anthropic Direct 유지)
- 값이 있으면 → **경고** 출력 후 계속 (Leader가 이미 프록시를 가리키고 있을 수 있음)

### 2-4. 사용자 안내

> **Codex Hybrid Mode 활성화 완료**
>
> | 역할 | 실제 모델 | Claude Code UI 표시 | 라우팅 |
> |------|----------|-------------------|--------|
> | Leader (현재) | Opus 4.6 [1M] | opus | Anthropic Direct |
> | Teammates (새 pane) | **GPT-5.3-Codex** | sonnet 4.6 (표시만) | CLIProxyAPI (127.0.0.1:8317) |
>
> **추론 레벨**: Claude Code가 thinking 파라미터를 보내면 budget_tokens에 따라
> 자동 결정됩니다. 미전송 시 Codex 기본값 `medium`.
>
> **주의**: Claude Code UI/Agent Office에서 팀원이 `sonnet 4.6`으로 표시되지만,
> 실제로는 CLIProxyAPI를 경유하여 **GPT-5.3-Codex**로 실행됩니다.
> (PHASE 1-4에서 라우팅 검증 완료)
>
> `/tofu-at` 워크플로우를 시작합니다...

---

## PHASE 2.3: 역할별 Codex 추론 레벨 설정

**DA와 Worker의 추론 레벨을 사용자에게 확인합니다.**

### 2.3-1. 추론 레벨 선택

```
AskUserQuestion({
  "questions": [
    {
      "question": "Worker(일반 작업)의 추론 레벨을 선택하세요.",
      "header": "Worker",
      "options": [
        {"label": "xhigh (Recommended)", "description": "MAX_THINKING_TOKENS=31999. 최대 추론. 기본값"},
        {"label": "high", "description": "MAX_THINKING_TOKENS=16384. 복잡한 코딩 작업에 적합"},
        {"label": "medium", "description": "MAX_THINKING_TOKENS=8192. 단순 작업에 적합"},
        {"label": "low", "description": "MAX_THINKING_TOKENS=1024. 사소한 수정용"}
      ],
      "multiSelect": false
    },
    {
      "question": "DA(Devil's Advocate)의 추론 레벨을 선택하세요.",
      "header": "DA",
      "options": [
        {"label": "xhigh (Recommended)", "description": "MAX_THINKING_TOKENS=31999. 최대 추론. 검토/분석에 최적"},
        {"label": "high", "description": "MAX_THINKING_TOKENS=16384. Worker와 동일 레벨"}
      ],
      "multiSelect": false
    }
  ]
})
```

DA가 OFF인 경우 DA 질문을 건너뜁니다.

### 2.3-2. 추론 레벨 값 매핑

| 선택 | MAX_THINKING_TOKENS |
|------|-------------------|
| low | 1024 |
| medium | 8192 |
| high | 16384 |
| xhigh | 31999 |

### 2.3-3. 사용자 안내

> **Codex 추론 레벨 설정:**
> | 역할 | 추론 레벨 | MAX_THINKING_TOKENS | 적용 방식 |
> |------|----------|-------------------|----------|
> | DA | {DA_LEVEL} | {DA_TOKENS} | tmux env → DA pane 상속 (먼저 스폰) |
> | Worker | {WORKER_LEVEL} | {WORKER_TOKENS} | tmux env → Worker panes 상속 (후 스폰) |
>
> tofu-at STEP 7-4-1에서 DA를 먼저 스폰 → env 변경 → Workers 스폰 순서로 진행합니다.

---

## PHASE 2.5: Agent Office 대시보드 실행

**tofu-at 위임 전에 Agent Office를 미리 실행합니다.**

### 2.5-1. agent-office 경로 감지 (tofu-at STEP 0.5 4.5단계와 동일 방식)

agent_office_path를 아래 순서로 탐색 (먼저 찾은 경로 사용):

```
1. Glob("agent-office/server.js") → 현재 프로젝트 루트에 존재하면 "agent-office"
2. Bash("echo $AGENT_OFFICE_PATH 2>/dev/null") → 환경변수로 명시 설정된 경우 사용
```

→ 모두 실패: agent_office_path = null
→ null일 때: "Agent Office 미설치. 대시보드 없이 진행." 안내 후 PHASE 3으로

Why: 기존 `find /mnt/c/Users -maxdepth 6`은 WSL에서 매우 느리고 실패율 높음.
tofu-at와 동일한 Glob 기반 2-step 탐색으로 교체하여 안정성 확보.

### 2.5-2. 서버 시작

```
# 1. 기존 서버 헬스체크
health = Bash("curl -s -o /dev/null -w '%{http_code}' http://localhost:3747/api/status --connect-timeout 2 || echo 'fail'")

IF health == "200":
  → "Agent Office 이미 실행 중."
ELSE:
  # 2. 포트 정리 (플랫폼별 분기)
  # Windows: tofu-at-codex는 tmux 필수이므로 WSL 환경 가정 — lsof 사용
  Bash("lsof -ti:3747 | xargs kill -9 2>/dev/null || true")

  # 3. 서버 시작 (백그라운드 — run_in_background: true)
  # Note: tofu-at-codex는 tmux(WSL) 필수이므로 $(pwd) 방식 사용 (Windows native 미지원)
  Bash("AGENT_OFFICE_ROOT=$(pwd) node {agent_office_path}/server.js --open", run_in_background: true)

  # 4. 헬스체크 루프 (최대 10초)
  ready = Bash("for i in 1 2 3 4 5 6 7 8 9 10; do code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3747/api/status --connect-timeout 1 2>/dev/null); if [ \"$code\" = \"200\" ]; then echo 'ready'; break; fi; sleep 1; done")

  IF ready != "ready":
    → 경고: "Agent Office 10초 내 시작 실패. 대시보드 없이 진행."
    → PHASE 3으로 진행 (서버 없이)
```

### 2.5-3. 브라우저 오픈 (WSL)

```bash
cmd.exe /c start http://localhost:3747 2>/dev/null || true
```

> Agent Office 대시보드: http://localhost:3747
> (WSL tmux에서 브라우저가 자동으로 열리지 않을 수 있습니다.
> Windows 브라우저에서 직접 http://localhost:3747 을 열어주세요.)

---

## PHASE 3: tofu-at 워크플로우 위임 (전체 클론)

```
Skill("tofu-at", args: "$ARGUMENTS")
```

표준 tofu-at STEP 0~9 전체 실행. 아래 항목이 반드시 포함되어야 합니다:

### 필수 포함 항목 (tofu-at가 자체 실행 — tofu-at-codex가 개입 X)

| tofu-at STEP | 항목 | 설명 |
|-------------|------|------|
| STEP 7-2.5 | 공유 메모리 초기화 | TEAM_PLAN/PROGRESS/BULLETIN/FINDINGS.md 생성 |
| STEP 7-4-0.5 | progress_update_rule | 모든 워커 프롬프트에 curl API push 블록 포함 |
| STEP 7-4-1 | DA→Worker 순차 스폰 | **Codex 오버라이드**: DA 먼저 → env 변경 → Workers 후 스폰 (추론 레벨 차등) |
| STEP 7-4-2 | 진행 상태 초기 업데이트 | 스폰 직후 TEAM_PROGRESS.md + Agent Office API |
| STEP 7-5.5 | Health Check 루프 | 비활성 에이전트 감지 + 깨우기 |
| STEP 7-6 | 결과 수신 + DA 개별 리뷰 | 각 워커별 DA 검토 요청 + progress 갱신 |
| STEP 7-6.5 | DA 종합 리뷰 | 2-Phase Review: 전체 결과 교차 검증 |
| STEP 7-7 | 셧다운 + Results 보고서 | DA 셧다운 + TeamDelete + Agent Office report |
| STEP 8 | 검증 + 보고 | 팀 라이프사이클 + 산출물 검증 |
| STEP 9 | 재실행 커맨드 생성 | 원클릭 재실행 /{name} 커맨드 |

tofu-at-codex는 PHASE 0-2.5만 직접 실행하고, STEP 0~9는 tofu-at에 100% 위임합니다.
tofu-at의 DA 흐름, progress 업데이트, Agent Office 연동을 절대 생략하거나 간소화하지 마세요.

### 기존 에이전트 통합 (tofu-at Step 5-0에서 자동 처리)

tofu-at의 Step 5-0이 기존 에이전트를 감지하면:
- 원본 에이전트 콘텐츠를 보존한 채 최소 팀 통합 래퍼를 적용
- Codex Hybrid 모드에서도 동일 작동 (CLIProxyAPI 경유만 다름)
- 래퍼의 progress_update_rule은 Codex 환경에서도 정상 작동 (curl은 로컬)
- source_agent 필드가 registry.yaml에 설정된 역할은 Steps 5-1~5-6을 스킵하고 래퍼 모드로 스폰

### Codex 특화 검증 (tofu-at 위임 후 자동)

- 새 pane은 tmux 세션 env 상속 → `ANTHROPIC_BASE_URL=http://127.0.0.1:8317`
- 팀원 프로세스는 CLIProxyAPI 경유 → Codex 실행

**tofu-at STEP 2-B DA 모델 선택 오버라이드:**
Codex Hybrid 모드에서는 DA 선택지를 다음으로 대체:
- "OFF" — DA 없이 진행
- "ON (Codex) (Recommended)" — GPT-5.3-Codex로 DA (CLIProxyAPI 경유)
- "ON (Opus)" — Anthropic Opus로 DA (Leader와 동일)

**tofu-at STEP 7-4-1 순차 스폰 오버라이드 (CRITICAL):**
원본 tofu-at는 DA+Workers 동시 스폰이지만, Codex Hybrid 모드에서는 순차 스폰합니다:

```
TMUX_SESSION = Bash("tmux display-message -p '#S'")

# Step A: DA 스폰 (높은 추론 레벨)
Bash("tmux set-environment -t {TMUX_SESSION} MAX_THINKING_TOKENS {DA_TOKENS}")
→ DA Task 스폰 (DA pane은 {DA_TOKENS} 상속)

# Step B: env 변경 후 Workers 스폰 (일반 추론 레벨)
Bash("tmux set-environment -t {TMUX_SESSION} MAX_THINKING_TOKENS {WORKER_TOKENS}")
→ Worker Tasks 스폰 (Worker panes는 {WORKER_TOKENS} 상속)
```

DA OFF인 경우 Step A를 건너뛰고 Workers만 스폰합니다.
{DA_TOKENS}와 {WORKER_TOKENS}는 PHASE 2.3에서 사용자가 선택한 값입니다.

**tofu-at STEP 7-4 스폰 후 Codex 검증:**
각 팀원 스폰 후, 팀원 pane에서 `ANTHROPIC_BASE_URL` 및 `MAX_THINKING_TOKENS` 상속 확인:
```bash
tmux capture-pane -t {pane_id} -p | head -5
```

tofu-at가 완료되면 PHASE 4로 진행합니다.

---

## PHASE 4: 정리

tofu-at 완료 후 (팀 셧다운 시) 프록시 + 환경 + 대시보드 정리:

```bash
# 1. Agent Office stale 데이터 정리 (session/clear 명시 호출 — Bug 4 수정)
curl -s -X POST http://localhost:3747/api/session/clear --connect-timeout 2 || true

# 2. CLIProxyAPI 프록시 종료
pkill -f "cli-proxy-api" || true

# 3. tmux 세션 환경변수 제거
TMUX_SESSION=$(tmux display-message -p '#S')
tmux set-environment -t "$TMUX_SESSION" -u ANTHROPIC_BASE_URL
tmux set-environment -t "$TMUX_SESSION" -u ANTHROPIC_AUTH_TOKEN
tmux set-environment -t "$TMUX_SESSION" -u MAX_THINKING_TOKENS
```

> **참고**: Agent Office 서버 자체는 종료하지 않습니다 (Results 탭 유지).
> `session/clear`만 호출하여 stale 팀 데이터를 정리합니다.

---

## 트러블슈팅

### 팀원이 UI에서 sonnet 4.6으로 표시되는 경우

**이것은 정상 동작입니다.**

Claude Code의 UI/config/Agent Office는 클라이언트 측 모델명(`sonnet`)을 표시합니다.
실제 API 호출은 CLIProxyAPI를 경유하여 `gpt-5.3-codex`로 라우팅됩니다.

**검증 방법:**
1. PHASE 1-4 검증 결과 확인 (프록시 시작 시 자동 수행)
2. 팀원에게 "What model are you?" 질문:
   ```
   SendMessage(recipient: "{worker}", content: "What model are you? Reply with exact model name.")
   ```
   → "ChatGPT" 또는 "GPT-5.3-Codex" 응답이면 Codex 확인
3. CLIProxyAPI 로그 확인:
   ```bash
   cat /tmp/claude-1000/-home-tofu-AI/tasks/{proxy_task_id}.output | grep -i "model\|alias\|codex"
   ```

### 팀원이 실제로 Anthropic에 연결되는 경우

1. 팀원 pane에서 확인:
   ```bash
   tmux send-keys -t {pane_id} 'echo $ANTHROPIC_BASE_URL' Enter
   ```
   → `http://127.0.0.1:8317`이어야 함

2. 비어있으면 tmux 세션 env 재설정:
   ```bash
   tmux set-environment ANTHROPIC_BASE_URL "http://127.0.0.1:8317"
   ```

3. 이미 스폰된 팀원은 env를 상속받은 상태이므로, 새로 스폰해야 반영됨

### DA idle hook 반복 경고

DA idle hook 경고가 반복되는 경우:
1. tofu-at의 STEP 7-6 (개별 워커 DA 리뷰)이 정상 실행되고 있는지 확인
2. 리드가 워커 결과 수신 시 DA에게 SendMessage를 보내고 있는지 확인
3. 정상 흐름에서는 DA가 워커 결과마다 리뷰 요청을 받으므로 idle 시간이 짧음
4. 그래도 경고가 반복되면 tofu-at 위임이 제대로 되지 않은 것 → Skill("tofu-at") 호출 확인

### 모델 alias가 매핑되지 않는 경우

`~/CLIProxyAPI/config.yaml`의 `oauth-model-alias` 섹션에
Claude Code가 보내는 모델명이 등록되어 있는지 확인:

```yaml
oauth-model-alias:
  codex:
    - name: "gpt-5.3-codex"
      alias: "claude-sonnet-4-6"     # ← teammate가 보내는 모델명
```

### Agent Office가 자동 실행되지 않는 경우

PHASE 2.5에서 자동 실행을 시도하지만, WSL tmux 환경에서는 실패할 수 있습니다.
수동으로 실행:
```bash
cd {project_root} && AGENT_OFFICE_ROOT=$(pwd) node agent-office/server.js &
```
브라우저에서 http://localhost:3747 접속.

### Codex OAuth 토큰 만료

```bash
codex --login
```
재인증 후 CLIProxyAPI를 재시작하세요.

### Leader가 프록시를 가리키는 경우

Leader 프로세스에 이미 `ANTHROPIC_BASE_URL`이 설정되어 있다면,
현재 세션을 종료하고 새 세션에서 `/tofu-at-codex`를 실행하세요.
(Leader는 프록시 설정 전에 시작되어야 합니다.)

---

## 제한사항

| 항목 | 설명 |
|------|------|
| UI 모델 표시 | Claude Code UI에 팀원이 sonnet으로 표시됨 (실제는 Codex). PHASE 1-4 검증으로 확인 |
| 추론 레벨 | CLIProxyAPI apply.go가 결정. MAX_THINKING_TOKENS env로 제어. 기본값 31999 (xhigh) |
| 역할별 추론 차등 | MAX_THINKING_TOKENS 순차 스폰으로 DA/Worker 차등 적용 가능. 단, 동시 스폰 불가 (순차만) |
| Anthropic 전용 기능 | extended thinking, prompt caching 등은 팀원(Codex)에서 미작동 |
| 팀원 역할 | 단순 워커/DA에 적합. 복잡한 에이전트 로직은 Leader가 처리 |
| 프록시 의존성 | CLIProxyAPI 종료 시 팀원 전원 통신 불가 |
| 동시성 | CLIProxyAPI의 동시 요청 처리 한계에 따라 팀원 수 제한 가능 |
| DA idle hook | tofu-at 원본 흐름(개별 리뷰+종합 리뷰) 따르면 최소화됨. 간소화 시 발생 |
| 응답 속도 | Codex CLI subprocess 경유로 Anthropic 대비 1.5-2x 느림 |
