---
description: 워크플로우를 Agent Teams(Split Pane)로 변환 - 리소스 탐색, 분석, 팀 구성, 스폰 실행
allowedTools: Task, Read, Write, Bash, Glob, Grep, AskUserQuestion, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, SendMessage, ToolSearch
---

# /tofu-at - Agent Teams 워크플로우 변환기

> **Version**: 2.0.0
> 기존/신규 워크플로우를 Agent Teams(Split Pane/Swarm)로 변환합니다.
> 참조 스킬: `tofu-at-workflow.md`, `tofu-at-registry-schema.md`, `tofu-at-spawn-templates.md`

$ARGUMENTS

<mindset priority="HIGHEST">
천천히, 최선을 다해 작업하세요.

핵심 역할: **워크플로우 → Agent Teams 변환기**
1. 사용 가능한 모든 리소스를 동적으로 탐색
2. 워크플로우를 분석하여 에이전트 유닛으로 분해
3. Split Pane(tmux) 기반 Agent Teams 구성안 생성
4. 사용자 선택에 따라 즉시 실행 또는 템플릿 저장

<mandatory_interaction rule="NEVER_SKIP">
AskUserQuestion 호출은 워크플로우 필수 입력입니다 — 권한 승인이 아닙니다.
bypassPermissions 모드와 무관하게, $ARGUMENTS 유무와 무관하게,
아래 STEP의 AskUserQuestion은 반드시 실행해야 합니다:

| STEP | 질문 | 도구 호출 | 스킵 조건 |
|------|------|----------|----------|
| STEP 2-A | 팀 규모/모델/게이트/출력 | AskUserQuestion 1/2 (4개 질문) | spawn 또는 catalog 모드일 때만 스킵 |
| STEP 2-B | Ralph/DA | AskUserQuestion 2/2 (2개 질문) | spawn 또는 catalog 모드일 때만 스킵 |
| STEP 3 | 팀 구성안 확인 | AskUserQuestion (1개 질문) | 스킵 불가 |
| STEP 6 | 실행 옵션 선택 | AskUserQuestion (1개 질문) | 스킵 불가 |

Why: AskUserQuestion은 사용자 선호도 수집 도구입니다.
bypassPermissions는 Bash/Write 등 시스템 변경 도구의 승인만 생략합니다.
이 두 가지는 완전히 다른 카테고리이므로 혼동하지 마세요.
</mandatory_interaction>

절대 금지:
- 리소스 탐색 없이 팀 구성 제안 X
- 사용자 확인 없이 TeamCreate 실행 X
- MCP vs CLI 최적 경로 확인 없이 도구 할당 X
- AskUserQuestion 스킵 (bypass 모드/인자 유무 무관) X
- 여러 STEP의 AskUserQuestion을 한꺼번에 묶어서 질문 X — 각 STEP에서 개별 호출

<execution_model rule="ASK_THEN_PROCEED">
이 커맨드는 plan mode 사용 가능하나, AskUserQuestion 호출 의무는 동일합니다.

Plan mode에서의 실행 규칙:
- Plan 작성 전에 STEP 2 AskUserQuestion을 먼저 호출하여 사용자 선호도 수집
- Plan에 사용자 응답을 반영한 후 plan 작성
- Plan 실행 중에도 STEP 3, STEP 6의 AskUserQuestion은 반드시 호출

STEP별 실행 흐름 (plan mode / 일반 mode 공통):
  STEP 0 → (라우팅) → [첫 실행 감지 시: STEP 0-SETUP 자동]
  STEP 2-A → ⛔ AskUserQuestion 1/2 호출 (규모/모델/게이트/출력) → 응답 대기 (관성 쌓이기 전 즉시 호출)
  STEP 2-B → ⛔ AskUserQuestion 2/2 호출 (Ralph/DA) → 응답 대기 → 응답 받은 후 진행
  STEP 0.5 → (환경 감지 - 자동)
  STEP 1 → (리소스 스캔 - 자동)
  STEP 3 → (분석 완료) → ⛔ AskUserQuestion 호출 → 응답 대기 → 응답 받은 후 진행
  STEP 4-5 → (자동 실행)
  STEP 6 → ⛔ AskUserQuestion 호출 → 응답 대기 → 응답 받은 후 진행
  STEP 7-8 → (실행)

setup 모드 실행 흐름:
  STEP 0 → STEP 0-SETUP → (완료 후 종료)

⛔ 표시 지점에서 반드시 멈추고 사용자 입력을 받으세요.
AskUserQuestion 응답 없이 다음 STEP으로 진행하면 안 됩니다.
</execution_model>
</mindset>

---

## STEP 0: 서브커맨드 라우팅

`$ARGUMENTS`를 파싱하여 실행 모드를 결정합니다.

| 패턴 | 모드 | 설명 |
|------|------|------|
| (빈값) | 인터랙티브 | AskUserQuestion으로 액션 선택 |
| `scan <경로>` | 분석 | 스킬/에이전트/커맨드 분석 → 팀 구성안 |
| `catalog <team_id>` | 카탈로그 | registry.yaml 생성/갱신 |
| `spawn <team_id>` | 스폰 | 팀 즉시 생성 (Split Pane) |
| `clone <team_id>` | 버전 | 기존 팀 설정 스냅샷 |
| `inventory` | 인벤토리 | 사용 가능한 모든 리소스 표시 |
| `setup` | 설정 | 환경 검증 + 필수 설정 자동 구성 (첫 실행 시 자동) |

### 인터랙티브 모드 (빈값)

```
AskUserQuestion({
  "questions": [
    {
      "question": "어떤 작업을 하시겠습니까?",
      "header": "액션",
      "options": [
        {"label": "스캔 (Recommended)", "description": "기존 스킬/에이전트를 분석 → Agent Teams 구성안 생성"},
        {"label": "인벤토리", "description": "사용 가능한 Skills/MCP/Agents/Commands 전체 조회"},
        {"label": "스폰", "description": "등록된 팀 템플릿으로 Split Pane 팀 즉시 생성"},
        {"label": "카탈로그", "description": "팀 템플릿을 registry에 등록/갱신"},
        {"label": "환경설정", "description": "환경 확인 + 필수 설정 구성 (첫 실행 시 자동)"}
      ],
      "multiSelect": false
    }
  ]
})
```

- "스캔" → `scan` 모드로 전환 (대상 경로를 추가 질문)
- "인벤토리" → `inventory` 모드로 전환
- "스폰" → `spawn` 모드로 전환 (team_id를 추가 질문)
- "카탈로그" → `catalog` 모드로 전환
- "환경설정" → `setup` 모드로 전환 (STEP 0-SETUP 실행)

### 첫 실행 자동 감지 (Pre-flight Check)

**모든 모드 진입 전에 아래 조건을 자동 확인합니다. setup 모드 제외.**

```
first_run = false

1. Read(".claude/settings.local.json") 시도:
   → 파일 없음: first_run = true
   → 파일 있음: "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" 키 확인
     → 없음 또는 "1" 아님: first_run = true

2. Glob(".team-os/registry.yaml"):
   → 없음: first_run = true

IF first_run == true:
  → 사용자에게 안내:
    "첫 실행이 감지되었습니다. 환경설정을 먼저 진행합니다."
  → STEP 0-SETUP 자동 실행
  → setup 완료 후 원래 요청한 모드로 복귀
```

Why: 인프라 미비 상태에서 scan/spawn 모드로 진입하면 STEP 7에서 실패.
첫 실행 시 setup을 먼저 완료해야 안정적으로 워크플로우 실행 가능.

### 라우팅 후 다음 STEP (모드별 분기)

| 모드 | 라우팅 후 다음 STEP | 이유 |
|------|-------------------|------|
| setup | **STEP 0-SETUP** (환경설정) | 환경 구성만 수행 후 종료 |
| scan | **STEP 2** (사용자 선호도 수집) | 관성 축적 전 AskUserQuestion 즉시 호출 |
| inventory | STEP 0.5 (환경 감지) | 자동 실행만 필요 |
| spawn | STEP 7 (즉시 실행) | team_id 지정됨, 선호도 불필요 |
| catalog | STEP 0.5 (환경 감지) | 자동 실행 후 STEP 4로 |
| 첫 실행 | STEP 0-SETUP (자동) → 원래 모드 | 인프라 미비 시 자동 전환 |

---

## STEP 0-SETUP: 환경설정 (첫 실행 또는 `setup` 서브커맨드)

**첫 실행 자동 감지 또는 `/tofu-at setup` 명시 실행 시 이 STEP을 수행합니다.**
**목적: 최소한의 인프라를 구성하여 이후 scan/spawn 등이 정상 작동하도록 보장.**

### Setup-0: 설치 가이드 문서 참조 (CRITICAL)

**설치를 시작하기 전에 반드시 아래 URL에서 최신 설치 가이드를 읽습니다.**
AI 에이전트(Claude Code)가 직접 읽을 수 있는 순수 텍스트 형식으로 제공됩니다.

```
1. 빠른 설치 요약:
   WebFetch("https://tofu-at.manus.space/llms.txt")
   → 설치 명령어, 시스템 요구사항, 핵심 정보 요약

2. 전체 설치 가이드 (상세):
   WebFetch("https://tofu-at.manus.space/llms-full.txt")
   → 단계별 설치, 설정, 검증, 플랫폼별 가이드, 문제 해결까지 포함

3. 읽기 우선순위:
   - 첫 설치: llms-full.txt를 먼저 읽고 전체 절차를 파악
   - 재설치/업데이트: llms.txt만 읽고 빠르게 진행
   - 설치 중 문제 발생: llms-full.txt의 문제 해결 섹션 참조
```

> **참고**: 메인 페이지(https://tofu-at.manus.space/)는 React SPA이므로
> WebFetch로 읽을 수 없습니다. 반드시 `/llms.txt` 또는 `/llms-full.txt` 경로를 사용하세요.

Why: 설치 가이드 문서에 최신 설치 절차, 플랫폼별 주의사항, 문제 해결이 포함되어 있어
아래 Setup-1~7보다 더 정확한 정보를 제공할 수 있음. 문서를 먼저 읽고 절차를 보완.

### Setup-1: 플랫폼 감지

```
1단계: 플랫폼 감지 — Bash("uname -r 2>/dev/null")
  - 출력에 "microsoft" 포함 → env_platform = "wsl"
  - platform == "darwin" → env_platform = "macos"
  - Bash("echo $WINDIR") 비어있지 않음 또는 Bash("uname -s") 출력에 "MINGW"/"MSYS" 포함 → env_platform = "windows"
  - 그 외 → env_platform = "linux"

2단계: 사용자에게 플랫폼 표시
  "감지된 환경: {env_platform}"
```

### Setup-2: 필수 도구 확인

```
| 도구 | 확인 방법 | 미설치 시 대응 |
|------|----------|--------------|
| tmux | env_platform != "windows" 일 때만: Bash("which tmux 2>/dev/null") | wsl/linux: "sudo apt install tmux (권장, 필수 아님)" 안내, macos: "brew install tmux" 안내 |
| Node.js | Bash("node --version 2>/dev/null") | "Node.js는 Agent Office(선택) 사용 시 필요합니다. https://nodejs.org" 안내 |
```

**tmux 플랫폼별 안내:**
- **Windows (native)**: tmux 확인 자체를 스킵합니다. "Windows에서는 tmux 없이도 Agent Teams가 작동합니다 (in-process 모드). WSL 설치를 권장하지만 필수는 아닙니다."
- **WSL**: "tmux를 권장하지만 필수는 아닙니다. 미설치 시 in-process 모드로 폴백합니다."
- **macOS/Linux**: tmux 미설치 시 경고만 표시하고 계속 진행.

Why: VS Code 터미널 및 native Windows에서는 in-process 모드로 폴백 가능하므로 tmux 없이도 기본 작동 가능.

### Setup-3: settings.local.json 핵심 설정 확인 + 자동 구성

```
Read(".claude/settings.local.json") 시도:

CASE 1: 파일 없음
  → 사용자에게 안내:
    "Agent Teams 활성화를 위해 settings.local.json을 구성해야 합니다.
     아래 명령어를 실행해주세요:"
  → 안내 표시:
    claude config set -p env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1
    claude config set -p teammateMode tmux
  → 사용자가 직접 실행하도록 안내 (자동 수정 불가 — 포맷 보존 문제)

CASE 2: 파일 있음
  1. "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" 확인
     → 없거나 "1" 아님:
       "Agent Teams가 비활성입니다. 아래 명령으로 활성화하세요:"
       claude config set -p env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS 1

  2. "teammateMode" 확인
     → 없거나 "tmux"/"auto" 아님:
       "Split Pane 모드가 비활성입니다. 아래 명령으로 활성화하세요:"
       claude config set -p teammateMode tmux
```

### Setup-4: .team-os/ 디렉토리 초기화

```
Glob(".team-os/") 존재 확인:

IF .team-os/ 없음:
  Bash("mkdir -p .team-os/artifacts .team-os/hooks .team-os/spawn-prompts .team-os/consensus .team-os/graphrag .team-os/reports")

IF Glob(".team-os/registry.yaml") 없음:
  Write(".team-os/registry.yaml"):
    version: 1
    defaults:
      routing:
        lead: opus
        category_lead: opus
        worker: sonnet
        low_cost: haiku
    teams: []
```

### Setup-5: Agent Office 설치 (필수)

Agent Office는 팀 대시보드로, 팀 운영 시 실시간 모니터링에 필수입니다.

```
1. Glob("agent-office/server.js") → 존재하면 agent_office_found = true → 스킵

2. agent_office_found = false 일 때:
   → 사용자에게 안내:
     "Agent Office(팀 대시보드)가 설치되지 않았습니다.
      tofu-at 전체 설치를 진행합니다."

   → install.sh 실행 (2가지 방법, 순서대로 시도):

   방법 A (tofu-at 리포가 로컬에 있는 경우):
     Glob("tofu-at/install.sh") → 존재하면:
       Bash("bash tofu-at/install.sh")

   방법 B (없는 경우 — GitHub에서 다운로드):
     Bash("curl -fsSL https://raw.githubusercontent.com/treylom/tofu-at/main/install.sh | bash")

   → install.sh가 다음을 자동 수행:
     - 필수 도구 확인 (git, node, tmux, claude)
     - tofu-at 파일 설치 (.claude/commands, .claude/skills)
     - .team-os/ 인프라 설정 (hooks, artifacts, registry)
     - Agent Office 복사 + npm install
     - settings.local.json 구성

3. 설치 후 재확인:
   Glob("agent-office/server.js") → 여전히 없으면:
     "Agent Office 설치에 실패했습니다.

      수동 설치 방법:
        git clone https://github.com/treylom/tofu-at /tmp/tofu-at
        bash /tmp/tofu-at/install.sh

      상세 가이드 참조:
        WebFetch('https://tofu-at.manus.space/llms-full.txt')
        → 문제 해결(Troubleshooting) 섹션에서 플랫폼별 해결 방법을 확인하세요."
```

Why: Agent Office는 tofu-at GitHub 리포에 포함. install.sh 한 줄로 전체 인프라 설치.
실패 시 docs URL에서 문제 해결 가이드를 참조할 수 있도록 안내.

### Setup-6: 모델 + 컨텍스트 안내

```
현재 모델이 opus가 아니거나 1M이 아닌 경우:
  "tofu-at는 opus 1M 컨텍스트에서 최적 작동합니다.
   다음에 CC를 시작할 때: claude --model=opus[1m]
   현재 세션에서 전환: /model opus[1m]"
```

### Setup-7: 환경 요약 출력

```markdown
## 환경설정 결과

| 항목 | 상태 |
|------|------|
| 플랫폼 | {env_platform} |
| tmux | ✅ 설치됨 / ❌ 미설치 (안내 표시) |
| Agent Teams | ✅ 활성 / ❌ 비활성 (명령어 안내) |
| teammateMode | ✅ tmux / ❌ 미설정 (명령어 안내) |
| .team-os/ | ✅ 초기화 완료 |
| Agent Office | ✅ 설치됨 / ❌ 설치 실패 (수동 설치 안내) |
| 모델 | {현재 모델} (권장: opus[1m]) |

환경설정이 완료되었습니다.

> **중요**: 설정을 적용하려면 **`/resume`을 실행하거나 세션을 재시작**하세요.
> 새로 설정된 환경변수(CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)와 teammateMode는
> 세션 재로드 후 활성화됩니다. 스킬/커맨드(/tofu-at 등)가 바로 인식되지 않으면
> 반드시 /resume 후 다시 시도하세요.
```

### Setup 종료 분기

```
IF Agent Office 설치 성공 (agent_office_found == true):
  IF setup 서브커맨드로 진입:
    → "환경설정 완료. /tofu-at를 사용할 수 있습니다."
    → 사용법 안내:
      "/tofu-at — 인터랙티브 모드로 시작
       /tofu-at scan <경로> — 스킬/에이전트 분석 → 팀 구성
       /tofu-at inventory — 사용 가능 리소스 조회
       /tofu-at spawn <team_id> — 팀 즉시 생성"
    → 종료

  IF 첫 실행 자동감지로 진입:
    → "환경설정 완료. 원래 요청한 작업을 계속합니다."
    → 원래 모드(scan/inventory/spawn/인터랙티브)로 복귀하여 계속 진행

IF Agent Office 설치 실패:
  → "Agent Office 설치에 실패했습니다.

     수동 설치:
       git clone https://github.com/treylom/tofu-at /tmp/tofu-at && bash /tmp/tofu-at/install.sh

     상세 가이드 (AI가 직접 읽을 수 있는 텍스트):
       https://tofu-at.manus.space/llms-full.txt

     설치 완료 후 /tofu-at setup을 다시 실행하세요."
  → 종료 (원래 모드로 복귀하지 않음)
```

---

## STEP 0.5: 환경 검증 (자동 - 사용자 표시 불필요)

**모든 모드에서 자동 실행. 사용자에게 결과만 요약 표시.**

### 0.5-SKIP: 검증 캐시 확인 (최초 1회 이후 스킵)

```
Glob(".team-os/.env-verified") 존재 확인:

IF 존재:
  Read(".team-os/.env-verified") → JSON 파싱
  IF verified.session == current_tmux_session AND verified.agent_teams == true:
    → "환경 검증 캐시 유효. 스킵합니다."
    → env_profile = verified.env_profile  (캐시된 값 사용)
    → STEP 1로 직접 진행
  ELSE:
    → 캐시 무효 (세션 불일치). 전체 검증 진행.

ELSE:
  → 캐시 없음. 전체 검증 진행.
```

캐시 무효 또는 미존재 시 → 아래 0.5-0부터 전체 실행.
검증 완료 후 캐시 저장은 0.5-4 마지막에 수행합니다.

### 0.5-0. 모델 + 컨텍스트 확인

**tofu-at는 대규모 워크플로우를 처리하므로 Opus 1M 컨텍스트를 권장합니다.**

CC 시작 시 아래 명령으로 실행하면 1M 컨텍스트 사용 가능:
```
claude --model=opus[1m]
```

> **`[1m]` 문법**: 모델명 뒤에 `[1m]`을 붙이면 1M(1,048,576) 토큰 컨텍스트로 시작됩니다.
> `[1m]` 없이 `--model=opus`만 사용하면 기본 200K 컨텍스트로 시작됩니다.
> 세션 도중 변경: `/model opus[1m]` 명령어 사용
>
> **참고**: 1M 컨텍스트는 API 및 pay-as-you-go 사용자에게 제공됩니다.
> Claude Max 등 구독 플랜에서는 제한될 수 있으니 확인하세요.
>
> **필수 설정 (CRITICAL)**: Opus 1M / Sonnet 1M 사용 시 반드시 **'Claude 추가 사용량(Extended Usage)'**을 활성화해야 합니다.
> 이 설정 없이는 1M 컨텍스트 세션이 시작되지 않거나 중간에 종료됩니다.
>
> **설정 경로**: Claude 앱/웹 → Settings → Usage → "추가 사용량 허용(Allow extended usage)" 활성화
> 이 설정은 구독 플랜(Max/Pro)과는 별도이며, API 사용자도 동일합니다.

현재 모델이 opus가 아니거나 1M이 아닌 경우, 사용자에게 안내:
> "tofu-at는 opus 1M 컨텍스트에서 최적 작동합니다.
> 다음에 CC를 시작할 때 `claude --model=opus[1m]`으로 실행해 주세요.
> 현재 세션에서도 `/model opus[1m]`으로 전환할 수 있습니다.
> 현재 세션에서도 계속 진행 가능하지만, 대규모 팀 운영 시 컨텍스트 부족이 발생할 수 있습니다."

**편의 별칭 설정 안내** (선택사항 — 사용자에게 표시):

| 환경 | 설정 방법 |
|------|----------|
| **WSL/Linux** | `~/.bashrc` 또는 `~/.zshrc`에 추가: `alias ai='claude --model=opus[1m]'` / `alias ain='claude --model=opus[1m] -p'` |
| **macOS** | `~/.zshrc`에 추가: `alias ai='claude --model=opus[1m]'` / `alias ain='claude --model=opus[1m] -p'` |
| **Windows (PowerShell)** | `$PROFILE`에 추가: `function ai { claude --model='opus[1m]' @args }` |
| **Windows (cmd)** | 프로젝트 루트에 `ai.bat` 생성: `@echo off` + `claude --model=opus[1m] %*` |

> 별칭 설정 후 `ai` 명령어만으로 Opus 1M 컨텍스트 CC를 시작할 수 있습니다.

### 0.5-1. Split Pane 모드 확인

```
Read(".claude/settings.local.json") → teammateMode 확인

IF teammateMode == "tmux":
  split_pane = true ✅
ELIF teammateMode == "auto":
  split_pane = "auto" (환경에 따라)
ELSE:
  split_pane = false
  → 사용자에게 안내: "Split Pane 모드가 비활성입니다. tmux 모드로 전환할까요?"
```

### 0.5-2. Agent Teams 활성화 확인

```
Read(".claude/settings.local.json") → env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS

IF == "1":
  agent_teams = true ✅
ELSE:
  → 안내: "Agent Teams가 비활성입니다. 활성화가 필요합니다."
```

### 0.5-3. 플랫폼 + WSL + tmux 감지

**아래 명령을 순서대로 실행하여 env_profile을 생성하세요:**

**1단계: WSL 감지** — Bash("uname -r 2>/dev/null") 실행
- 출력에 "microsoft" 포함 → env_platform = "wsl"
- platform == "win32" → env_platform = "windows"
- platform == "darwin" → env_platform = "macos"
- 그 외 → env_platform = "linux"

**2단계: tmux 세션 감지** — Bash("echo $TMUX") 실행
- 비어있지 않음 → env_tmux = true, Bash("tmux display-message -p '#S'")로 세션명 확인
- 비어있음 → env_tmux = false

**3단계: VS Code 감지** — Bash("echo $TERM_PROGRAM") 실행
- "vscode" → env_vscode = true
- 그 외 → env_vscode = false

**4단계: env_profile 구성** (이후 모든 STEP에서 참조):

| env_platform | browser_cmd |
|-------------|-------------|
| "windows" | cmd.exe /c start {url} |
| "wsl" | cmd.exe /c start {url} |
| "macos" | open {url} |
| "linux" | xdg-open {url} 2>/dev/null |

**4.5단계: Agent Office 경로 감지** (간소화 — 2단계만)

agent_office_path를 아래 순서로 탐색 (먼저 찾은 경로 사용):

1. Glob("agent-office/server.js") → 현재 프로젝트 루트에 존재하면 "agent-office"
2. Bash("echo $AGENT_OFFICE_PATH 2>/dev/null") → 환경변수로 명시 설정된 경우 사용

→ 모두 실패: agent_office_path = null
→ null일 때: "Agent Office 미설치. 대시보드 없이 팀 운영 가능."

env_profile에 추가:

| 필드 | 값 |
|------|-----|
| agent_office_path | 탐색된 경로 또는 null |

Why: 광범위한 파일시스템 탐색(find /mnt/c, find $HOME)을 제거하여
첫 설치 사용자가 불필요한 대기 없이 바로 사용 가능.
Agent Office 미설치 시 STEP 0-SETUP에서 install.sh로 설치 안내.
AGENT_OFFICE_ROOT는 사용 시 항상 $(pwd)로 설정.

**5단계: tmux 설치 확인** (env_tmux == false인 경우만)
- windows → 스킵. "Windows에서는 tmux 없이 in-process 모드로 작동합니다. (WSL 사용 권장, 필수 아님)"
- wsl/linux → Bash("which tmux") 실행, 실패 시 설치 안내: "sudo apt install tmux (권장, 필수 아님)"
- macos → Bash("which tmux") 실행, 실패 시: "brew install tmux"
- vscode → "VS Code 터미널은 Split Pane 미지원. in-process 모드로 자동 폴백."

**6단계: 사용자에게 환경 요약 1줄 표시**

알려진 안정성 이슈 참고 (2026-02 기준):

미해결:
- #23615: Split Pane 레이아웃 깨짐
- #24108: 팀원 idle 멈춤
- #24771: 메시징 분리
- #24292: iTerm2 분할 미생성
- 대응: teammateMode "auto" + 기존 tmux 세션 안에서 실행이 가장 안정적

v2.1.45에서 해결됨:
- Agent Teams 클라우드 플랫폼 (Bedrock/Vertex/Foundry) env var 전파 수정
- Task tool 백그라운드 에이전트 ReferenceError 크래시 수정
- Skills compaction 누수 수정 (서브에이전트 스킬이 부모 컨텍스트에 잔류하던 문제)
- 참고: "거짓 완료 보고" 버그(Bug-2025-12-12-2056)는 별개 이슈, 미해결

### 0.5-4. .team-os/ 인프라 확인 + 자동 초기화 (CRITICAL)

team_os_status를 아래 순서로 확인:

**1단계**: Glob(".team-os/registry.yaml") 존재?
- NO → 전체 bootstrap 필요
- YES → 2단계로 진행

**2단계**: 아티팩트 파일 존재 확인
- Glob(".team-os/artifacts/TEAM_PLAN.md") 존재?
- Glob(".team-os/artifacts/TEAM_BULLETIN.md") 존재?
- Glob(".team-os/artifacts/TEAM_PROGRESS.md") 존재?
- Glob(".team-os/artifacts/TEAM_FINDINGS.md") 존재?
- 하나라도 NO → repair 필요

**3단계**: 자동 초기화/복구 실행 (agent_office_path 참조):
- IF 전체 bootstrap 필요 AND agent_office_path != null:
  Bash("AGENT_OFFICE_ROOT=$(pwd) node {agent_office_path}/lib/team-os-bootstrap.js") 실행
  → 실패 시: 수동 폴백 (아래 mkdir 방식)
- IF 전체 bootstrap 필요 AND agent_office_path == null:
  Bash("mkdir -p .team-os/artifacts .team-os/hooks .team-os/spawn-prompts .team-os/consensus .team-os/graphrag .team-os/reports") 수동 초기화
  → 사용자에게 안내: "/tofu-at setup으로 Agent Office를 설치하세요"
- ELIF repair 필요 AND agent_office_path != null:
  Bash("AGENT_OFFICE_ROOT=$(pwd) node -e \"const b=require('{agent_office_path}/lib/team-os-bootstrap');console.log(JSON.stringify(b.bootstrapTeamOS(process.env.AGENT_OFFICE_ROOT||process.cwd(),{repair:true})))\"") 실행
- ELSE:
  team_os_status = "active"

Why: Agent Office 설치 시 bootstrap.js 활용으로 완전한 인프라 구성. 미설치 시 수동 폴백.

**4단계**: Glob(".team-os/hooks/*") → Hook 스크립트 존재 여부
Glob(".team-os/artifacts/*") → 아티팩트 디렉토리 존재 여부

**5단계 (NEW): 검증 캐시 저장** — 이후 재실행 시 0.5-SKIP에서 스킵 가능

```
tmux_session = Bash("tmux display-message -p '#S' 2>/dev/null || echo 'none'")

Write(".team-os/.env-verified", JSON.stringify({
  session: tmux_session,
  agent_teams: true,
  env_profile: {
    env_platform: env_platform,
    env_tmux: env_tmux,
    env_vscode: env_vscode,
    browser_cmd: browser_cmd,
    agent_office_path: agent_office_path
  },
  verified_at: new Date().toISOString()
}, null, 2))
```

---

## STEP 1: 리소스 동적 탐색 (CRITICAL)

**팀 구성 전 반드시 현재 사용 가능한 모든 리소스를 스캔합니다.**
**상세 알고리즘: `tofu-at-workflow.md` 섹션 1 참조.**

### 실행 순서

```
1. Phase A: 로컬 리소스 스캔
   - Glob(".claude/skills/*.md") → Skills 목록
   - Glob(".claude/agents/*.md") → Agents 목록
   - Glob(".claude/commands/*.md") → Commands 목록
   - 각 파일의 frontmatter Read (첫 10줄)

1-A2. Phase A-2: 기존 에이전트 재사용 후보 인벤토리 (NEW)
   agent_inventory = []
   FOR each agent in Glob(".claude/agents/*.md"):
     # 비에이전트 파일 제외
     IF filename starts with "README" OR "CHANGELOG" OR "BUGS" OR "NOTION":
       SKIP
     Read 첫 15줄 → frontmatter 추출: name, description, tools, model
     keywords = name + description에서 키워드 추출 (소문자)
     agent_inventory.append({ path, name, description, tools, keywords })

   FOR each spawn in Glob(".team-os/spawn-prompts/*.md"):
     Read 첫 5줄 → 역할명 추출
     spawn_inventory.append({ path, name })

   # 인벤토리 결과 요약 (내부 참조용, 사용자 미표시)
   # STEP 3에서 자동 매칭에 사용됨

2. Phase B: MCP 서버 스캔
   - Read(".mcp.json") → MCP 서버 목록
   - ToolSearch("{서버명}") → 각 서버별 도구 확인

3. Phase C: CLI 도구 확인
   - Bash로 CLI 도구 존재/버전 확인
   - npx playwright --version
   - node --version
   - python --version
   - (macOS) which tmux

4. Phase D: 최적 경로 결정
   - tofu-at-workflow.md의 MCP vs CLI 매트릭스 적용
   - 결과를 tool_paths 변수에 저장
```

### inventory 모드일 때

Phase A~D 완료 후 인벤토리 테이블을 사용자에게 출력합니다.
`tofu-at-workflow.md`의 "리소스 인벤토리 출력 포맷" 참조.

inventory 모드면 여기서 종료. scan 모드면 STEP 3으로 진행 (STEP 2는 이미 STEP 0 직후에 완료됨). spawn 모드면 STEP 7로 진행. catalog 모드면 STEP 4로 진행.

---

## STEP 2: 사용자 선호도 수집 (MANDATORY — bypass 무관)

<!-- MANDATORY_INTERACTION: STEP 2 -->

> **실행 순서 주의 (v1.4.2)**: STEP 2는 환경 감지(STEP 0.5)와 리소스 스캔(STEP 1) **이전에** 실행합니다.
> 사용자 선호도는 환경/리소스 정보에 의존하지 않으므로 STEP 0 라우팅 직후 먼저 수집합니다.
> Why: STEP 0.5+1의 20-30회 자동 도구 호출이 "자동 실행 관성"을 만들어 AskUserQuestion을 스킵시키는 것을 방지.

**scan 모드 진입 시 6가지 질문을 반드시 AskUserQuestion으로 물어봅니다. bypassPermissions와 무관하며, $ARGUMENTS에 "scan"이 포함되어 있어도 반드시 실행합니다.**

> ⛔ **STOP — 여기서 반드시 AskUserQuestion을 호출하고 사용자 응답을 받으세요.**
> Plan mode에서도 plan 작성 전에 이 질문을 먼저 실행해야 합니다.
> 이 응답 없이 STEP 3으로 진행하면 안 됩니다.

**AskUserQuestion을 2회에 걸쳐 총 6가지 질문을 합니다.**
**도구 제약: 1회 호출당 최대 4개 질문, 질문당 최대 4개 선택지. 반드시 2회 분할 호출.**

### STEP 2-A: AskUserQuestion 1/2 — 핵심 설정 (4개 질문)

> ⛔ **STOP — 아래 AskUserQuestion 1/2를 호출하고 응답을 받으세요.**

AskUserQuestion 호출 — questions 배열에 4개 질문:

- question: "팀 규모 전략을 선택해주세요", header: "규모", multiSelect: false
  - "최소 (리드+워커 1-2)" — 비용 절약, 단순 워크플로우
  - "표준 (리드+워커 3-5) (Recommended)" — 균형 잡힌 구성
  - "최대 (카테고리 리드+워커 5+)" — 복잡한 대규모 워크플로우

- question: "모델 믹스를 선택해주세요", header: "모델", multiSelect: false
  - "비용 최적 (Recommended)" — 리드=Opus(1M), 카테고리리드=Opus, 워커=Sonnet 4.6/Haiku
  - "품질 최적" — 리드=Opus(1M), 카테고리리드=Opus, 워커=Sonnet 4.6
  - "Sonnet 1M 확장" — 리드=Opus(1M), 카테고리리드=Sonnet 4.6(1M), 워커=Sonnet 4.6(1M)/Haiku. 대규모 컨텍스트 필요 시
  - "초저비용" — 리드=Opus(1M), 카테고리리드=Sonnet 4.6, 워커=Haiku (유일하게 카테고리리드 다운그레이드)

- question: "품질 게이트 수준을 선택해주세요", header: "게이트", multiSelect: false
  - "표준 (Recommended)" — TeammateIdle 요약 강제 + TaskCompleted 산출물 확인
  - "엄격" — + 파일 소유권 검증 + 합의 노트 필수
  - "느슨" — 기본 완료 확인만

- question: "출력 형식을 선택해주세요", header: "출력", multiSelect: false
  - "프롬프트 + 즉시 실행 (Recommended)" — 프롬프트 생성 후 옵션에서 즉시 TeamCreate 가능
  - "YAML 레지스트리만" — registry.yaml 파일만 생성
  - "프롬프트만" — 스폰 프롬프트만 출력 (실행 없음)

> ⛔ **1/2 응답 수신 후 바로 아래 2/2를 호출하세요.**

### STEP 2-B: AskUserQuestion 2/2 — 품질 옵션 (2개 질문)

> ⛔ **STOP — 아래 AskUserQuestion 2/2를 호출하고 응답을 받으세요.**

AskUserQuestion 호출 — questions 배열에 2개 질문:

- question: "Ralph 루프를 활성화하시겠습니까?", header: "Ralph", multiSelect: false
  - "OFF (Recommended)" — 워커 결과를 즉시 수락. 빠른 실행, 비용 절약
  - "ON (최대 5회)" — 리드가 워커 결과를 리뷰하고 피드백. 품질 중시
  - "ON (최대 10회)" — 복잡한 작업에 적합. 비용 주의

- question: "Devil's Advocate를 활성화하시겠습니까?", header: "DA", multiSelect: false
  - "OFF (Recommended)" — 리드가 직접 판정. 빠른 실행
  - "ON (Haiku)" — 저비용 반론. 핵심 위험만 지적
  - "ON (Sonnet 4.6)" — 표준 반론. 깊은 분석
  - "ON (Opus)" — 최고 품질 반론. 리드 수준 추론

> ⛔ **2/2 응답 수신 후에만 STEP 3으로 진행하세요.**
> DA에서 1M 컨텍스트(Sonnet 1M, Opus 1M)가 필요하면 "Other"에서 직접 입력 가능합니다.

**Ralph 루프 설정 적용**:
- "OFF" → `ralph_loop.enabled = false`
- "ON (최대 5회)" → `ralph_loop.enabled = true, max_iterations = 5`
- "ON (최대 10회)" → `ralph_loop.enabled = true, max_iterations = 10`
- 상세 참조: `tofu-at-workflow.md` 섹션 8, `.claude/reference/ralph-loop-research.md`

**Devil's Advocate 설정 적용**:
- "OFF" → `devil_advocate.enabled = false`
- "ON (Haiku)" → `devil_advocate.enabled = true, devil_advocate.model = "haiku"`
- "ON (Sonnet 4.6)" → `devil_advocate.enabled = true, devil_advocate.model = "sonnet"`
- "ON (Opus)" → `devil_advocate.enabled = true, devil_advocate.model = "opus"`
- Other "Sonnet 1M" 또는 "sonnet[1m]" → `devil_advocate.enabled = true, devil_advocate.model = "sonnet[1m]"`
- Other "Opus 1M" 또는 "opus[1m]" → `devil_advocate.enabled = true, devil_advocate.model = "opus[1m]"`

> **DA 모델 규칙**: 사용자가 명시적으로 선택한 DA 모델이 최종입니다.
> 1M 컨텍스트 변형은 "Other" 자유 입력으로 지정합니다 (AskUserQuestion이 항상 Other 옵션을 제공).
> Why: AskUserQuestion 도구 제약(질문당 최대 4개 선택지)을 준수하면서도 모든 모델 조합을 지원.

**spawn 모드일 때**: 이미 team_id가 지정되었으므로, STEP 2를 스킵하고 STEP 7로 직접 진행. Ralph 루프는 registry의 `ralph_loop.enabled` 값 사용.
**catalog 모드일 때**: STEP 2를 스킵하고 STEP 4로 직접 진행.

---

## STEP 3: 워크플로우 분석 (scan 모드)

**대상 파일을 읽고 에이전트 유닛으로 분해합니다.**
**상세 알고리즘: `tofu-at-workflow.md` 섹션 2-5 참조.**

### 실행 순서

```
1. Read(대상 파일) → 전문 읽기
2. 구조 추출:
   - H2/H3 헤더 → Phase/Step 단위
   - allowedTools → 도구 의존성
   - 입출력 패턴 → 데이터 흐름
   - 의존성 관계 → 병렬화 지점
3. 리소스 매칭 (STEP 1 인벤토리 활용)
4. 에이전트 유닛 분해
5. 카테고리 매핑
6. 모델+도구 할당
```

### 3-A. 기존 에이전트 자동 매칭 (NEW)

워크플로우 분석 후 에이전트 유닛 분해 단계에서, STEP 1 Phase A-2의 agent_inventory를 활용하여
각 제안된 역할에 기존 에이전트 매칭을 시도합니다.

```
FOR each proposed_role:
  best_match = null
  best_score = 0

  FOR each agent in agent_inventory:
    score = 0
    # 이름 매칭 (가중치 높음)
    IF proposed_role.name contains agent.name OR agent.name contains proposed_role.name:
      score += 0.5
    # 설명 키워드 매칭
    overlap = count(proposed_role.keywords ∩ agent.keywords) / max(len(proposed_role.keywords), 1)
    score += overlap * 0.3
    # 도구 매칭
    tool_overlap = count(proposed_role.tools ∩ agent.tools) / max(len(proposed_role.tools), 1)
    score += tool_overlap * 0.2

    IF score > best_score:
      best_score = score
      best_match = agent

  IF best_score >= 0.4:
    proposed_role.suggested_source = best_match.path
    proposed_role.match_confidence = best_score
```

### 분석 결과 출력

`tofu-at-workflow.md`의 "팀 구성안 생성 출력 포맷" 참조.

분석 결과 테이블에 "기존 에이전트 매칭" 열을 추가합니다:

```
| 역할 | 에이전트명 | 모델 | 타입 | 핵심 도구 | 기존 에이전트 매칭 |
|------|----------|------|------|----------|------------------|
| writer | thread-writer | sonnet | GP | Read,Write | ✅ thread-writer.md (85%) |
| researcher | vault-scanner | sonnet | Explore | Read,Glob | (생성) |
```

STEP 3의 AskUserQuestion에서 매칭된 에이전트 사용 여부를 함께 확인:
- "확인" 선택 시 → 매칭된 에이전트 사용 확정 (suggested_source 유지)
- "수정" 선택 시 → 개별 역할의 매칭을 변경 가능

**워크플로우 위계 다이어그램 필수 포함**: 분석 결과에 반드시 "워크플로우 흐름" 섹션을 포함합니다.
에이전트를 dependency layer별로 그루핑하여 Phase 테이블과 ASCII 다이어그램을 생성합니다.
`tofu-at-workflow.md`의 "워크플로우 흐름 (Workflow Flow)" 섹션의 생성 알고리즘을 따릅니다.

<!-- MANDATORY_INTERACTION: STEP 3 -->
> ⛔ **STOP — 분석 결과 출력 후 반드시 AskUserQuestion을 호출하고 사용자 응답을 받으세요.**
> **전제 조건**: STEP 2의 AskUserQuestion 응답이 수신된 상태여야 합니다.
> Plan mode에서도 이 질문은 반드시 실행해야 합니다.
> 이 응답 없이 STEP 4로 진행하면 안 됩니다.

**아래 AskUserQuestion을 실행하세요 (코드가 아닌 실행 지시입니다):**

AskUserQuestion 호출 — questions 배열에 1개 질문:

- question: "이 팀 구성안으로 진행할까요?", header: "확인", multiSelect: false
  - "확인 (Recommended)" — 이 구성으로 팀 템플릿 생성 진행
  - "수정" — 역할/모델/도구를 수정하고 싶습니다
  - "재분석" — 다른 규모/모델로 다시 분석

> ⛔ **사용자 응답 수신 후에만 STEP 4로 진행하세요.**

---

## STEP 4: 팀 템플릿 생성

**STEP 3의 분석 결과를 Team Registry YAML로 변환합니다.**
**스키마: `tofu-at-registry-schema.md` 참조.**

### 실행 순서

```
1. team_id 생성: {category}.{workflow}.{variant}
2. environment 설정:
   - teammate_mode: "tmux" (기본) 또는 "auto" (대시보드 팀)
   - required_mcp: STEP 1에서 매칭된 필수 MCP
   - required_cli: STEP 1에서 매칭된 필수 CLI
3. models 설정: STEP 2 선호도 반영
4. roles 구성: STEP 3 에이전트 유닛 기반
5. inputs/outputs: STEP 3 입출력 패턴 기반
6. quality_gates: STEP 2 게이트 수준 반영
7. conflict_prevention: 파일 소유권 + 규칙
8. invoke: /tofu-at spawn {team_id} 형식
```

### 검증

`tofu-at-registry-schema.md`의 "검증 규칙" 체크리스트 실행.

---

## STEP 5: 스폰 프롬프트 생성 (/prompt 파이프라인 내재화)

**각 팀원별로 /prompt 파이프라인을 실행하여 고품질 스폰 프롬프트를 생성합니다.**
**템플릿: `tofu-at-spawn-templates.md` 참조.**
**전문가 DB: `tofu-at-spawn-templates.md` 섹션 7.5에 27도메인 137명 전문가 완전 내장.**
**파이프라인 상세: `tofu-at-spawn-templates.md` 섹션 7.5 (내장 DB + 매핑) + 7.6 (서브스텝) 참조.**

### 실행 순서 (각 팀원에 대해 반복)

```
FOR each role in registry.roles:

  Step 5-0: Existing Agent Detection (NEW — tofu-at-spawn-templates.md §4.5 참조)
    IF role.source_agent OR role.suggested_source (STEP 3에서 확인됨):
      source_path = role.source_agent || role.suggested_source
      original_content = Read(source_path)

      # 래퍼 템플릿 적용 (Section 4.5)
      spawn_prompt = compose_wrapper(
        team_integration: {TEAM_NAME, ROLE_NAME, ROLE_TYPE, TEAM_MEMBERS, TOPIC},
        original_content: original_content,  # 변형 없이 그대로
        team_override: {파일쓰기제한, SendMessage필수, MCP정규화}
      )

      # CE 최소 검증만 수행 (전체 파이프라인 스킵)
      [ ] 래퍼 + 원본 합산 토큰이 모델 컨텍스트의 10% 미만?
      [ ] SendMessage 프로토콜 포함?
      [ ] progress_update_rule 포함?

      → role.spawn_prompt = spawn_prompt
      → role.source_type = "existing"
      → SKIP Steps 5-1 ~ 5-6
      CONTINUE (다음 role로)

  # source_type != "existing" → 기존 파이프라인

  Step 5-1: Purpose Detection
    role 키워드(name + description + tasks) → /prompt 목적 카테고리 매핑
    | 역할 패턴 | /prompt 목적 |
    |----------|-------------|
    | scraper, crawler, fetch | 에이전트/자동화 |
    | analyst, summarize, classify | 분석/리서치 |
    | writer, content, draft | 글쓰기/창작 |
    | coder, developer, build | 코딩/개발 |
    | designer, UI, UX | 코딩/개발 |
    | explorer, search, scan | 분석/리서치 |
    | reviewer, QA, test | 분석/리서치 |
    | lead, coordinator | 에이전트/자동화 |

  Step 5-2: Expert Domain Priming (Embedded DB)
    1. tofu-at-spawn-templates.md §7.5의 내장 전문가 DB에서 domain 매칭
    2. domain 내 best-match expert 선택 (task 키워드 vs 전문가 핵심 용어)
    3. expert_name + expert_framework + domain_vocabulary 추출
    4. <role> 블록에 <domain_vocabulary> 주입
    NOTE: Lead는 적용 제외

  Step 5-3: Task Detail Expansion
    /prompt "명시적 요소 확장 규칙" 적용
    purpose_category별 확장 체크리스트로 누락 요소 자동 보충:
    - 에이전트/자동화 → 역할, 도구, 권한, 제약, 출력형식
    - 분석/리서치 → 범위, 기간, 비교대상, 평가기준, 출력형식
    - 코딩/개발 → 언어, 프레임워크, 아키텍처, 에러처리, 테스트
    - 글쓰기/창작 → 톤, 대상, 길이, 구조, 핵심메시지

  Step 5-4: CE Checklist
    섹션 7 체크리스트 적용:
    [ ] U-shape 배치: <role>은 시작에, <constraints>는 끝에
    [ ] Signal-to-noise: 불필요한 정보 제거
    [ ] 긍정형 프레이밍: "~해라" 우선
    [ ] 테이블 구조화: 규칙은 테이블로
    [ ] 이유(Why) 포함: 각 제약에 이유 명시
    [ ] 토큰 예산 (6-Tier 유동 한도, tofu-at-spawn-templates.md 참조):
        T1 Explore: 1,200/1,800 | T2 Simple Worker: 1,500/2,500
        T3 General Worker: 2,000/3,500 | T4 Worker+Ralph: 2,500/4,000
        T5 Category Lead: 3,000/4,500 | T6 Lead+Ralph: 3,500/5,000
        (Soft 초과=경고만, Hard 초과=강제 축소)

  Step 5-5: Claude Optimization
    subagent_type에 따라 Claude 전용 블록 삽입:
    - general-purpose → <default_to_action> (직접 구현 기본)
    - Explore → <investigate_before_answering> (확인 후 보고)

  Step 5-6: Quick 3-Expert Review (비대화형)
    내부 자가 점검 3관점 (출력 없이 자동 반영):
    1. CE Expert: 토큰 예산, U자형 배치, 신호 대 잡음비
    2. Domain Expert: expert_name 관점으로 역할/용어 정확성
    3. Team Coordinator: 역할 충돌/중복, 도구 할당, 보고 체계

도구 할당: 섹션 6 가이드 적용 (기존과 동일)
  - MCP 정규화 이름 매핑
  - CLI 우선 사용 규칙
```

---

## STEP 6: 출력 + 옵션 제시

```markdown
## 팀 템플릿 생성 완료: {team_id}

### 환경 요구사항
| 항목 | 상태 |
|------|------|
| Split Pane (tmux) | ✅/❌ + 안내 |
| Agent Teams | ✅/❌ |
| MCP 서버 | {필요 목록} ✅/❌ |
| CLI 도구 | {필요 목록} ✅/❌ |
| 플랫폼 | {감지된 OS} |

### 팀 구성
{YAML 코드블록}

### 스폰 프롬프트 (요약)
| 역할 | 에이전트명 | 모델 | 타입 | 핵심 도구 | 소스 |
|------|----------|------|------|----------|------|
```

> **소스 열 표기**: 기존 에이전트 래핑 시 `📄 기존 에이전트`, 템플릿 생성 시 `🔧 템플릿 생성`

<!-- MANDATORY_INTERACTION: STEP 6 -->
> ⛔ **STOP — 팀 템플릿 출력 후 반드시 AskUserQuestion을 호출하고 사용자 응답을 받으세요.**
> **전제 조건**: STEP 3의 AskUserQuestion 응답이 수신된 상태여야 합니다.
> Plan mode에서도 이 질문은 반드시 실행해야 합니다.
> 이 응답 없이 STEP 7로 진행하면 안 됩니다.

**아래 AskUserQuestion을 실행하세요 (코드가 아닌 실행 지시입니다):**

AskUserQuestion 호출 — questions 배열에 1개 질문:

- question: "어떻게 하시겠습니까?", header: "실행", multiSelect: false
  - "즉시 실행 (Recommended)" — TeamCreate → Split Pane으로 팀 즉시 생성 및 실행
  - "registry.yaml 저장" — .team-os/registry.yaml에 템플릿 추가
  - "스폰 프롬프트만 출력" — 각 역할별 전체 spawn prompt 표시
  - "수정" — 팀 구성/역할/모델/도구 변경 후 재생성

> ⛔ **사용자 응답 수신 후에만 STEP 7로 진행하세요.**

---

## STEP 7: 즉시 실행 (1번 "즉시 실행" 또는 spawn 모드)

### 7-1. 환경 재검증

```
teammateMode == "tmux" 또는 "auto" 확인
AGENT_TEAMS == "1" 확인
필수 MCP 서버 활성 확인
```

### 7-2. 팀 생성

```
TeamCreate({
  team_name: "{team_id를 -로 치환}",
  description: "{purpose}"
})
```

### 7-2.1. 대시보드 자동 실행 (백그라운드 — 크로스 플랫폼)

**TeamCreate 직후 Agent Office 대시보드를 자동으로 실행합니다.**
**STEP 0.5 4.5단계의 agent_office_path와 env_profile을 참조하여 크로스 플랫폼 대응.**

```
IF agent_office_path != null:
  # 1. 기존 서버 헬스체크 (크로스 플랫폼)
  health = Bash("curl -s -o /dev/null -w '%{http_code}' http://localhost:3747/api/status --connect-timeout 2 || echo 'fail'")

  IF health == "200":
    # 이미 정상 실행 중 → 브라우저만 오픈 (아래 5번으로)
  ELSE:
    # 2. 포트 점유 프로세스 정리 (stale 프로세스 대응)
    IF env_platform == "wsl" OR env_platform == "linux":
      Bash("lsof -ti:3747 | xargs kill -9 2>/dev/null || true")
    ELIF env_platform == "macos":
      Bash("lsof -ti:3747 | xargs kill -9 2>/dev/null || true")
    ELIF env_platform == "windows":
      Bash("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :3747 ^| findstr LISTENING') do taskkill /F /PID %a 2>nul || exit /b 0")

    # 3. 서버 시작 (항상 AGENT_OFFICE_ROOT 설정 — 모든 플랫폼에서 정확한 프로젝트 루트 보장)
    #    --open 플래그로 서버 시작 시 자동 브라우저 오픈
    IF env_platform == "windows":
      # Windows: $(pwd) bash-ism 불가 → %CD% 또는 node로 직접 CWD 설정
      Bash("set AGENT_OFFICE_ROOT=%CD%&& node {agent_office_path}/server.js --open", run_in_background: true)
    ELSE:
      Bash("AGENT_OFFICE_ROOT=$(pwd) node {agent_office_path}/server.js --open", run_in_background: true)

    # 4. 헬스체크 재시도 루프 (최대 10초 — sleep 2 대체)
    Bash("for i in 1 2 3 4 5 6 7 8 9 10; do
      code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3747/api/status --connect-timeout 1 2>/dev/null)
      if [ \"$code\" = \"200\" ]; then echo 'ready'; break; fi
      sleep 1
    done")

  # 5. 브라우저 자동 오픈 (env_platform에 따라 분기 + fallback chain)
  IF env_platform == "wsl":
    Bash("cmd.exe /c start http://localhost:3747 2>/dev/null || explorer.exe 'http://localhost:3747' 2>/dev/null || wslview http://localhost:3747 2>/dev/null || true")
  ELIF env_platform == "macos":
    Bash("open http://localhost:3747 2>/dev/null || true")
  ELIF env_platform == "linux":
    Bash("xdg-open http://localhost:3747 2>/dev/null || true")
  ELIF env_platform == "windows":
    Bash("cmd.exe /c start http://localhost:3747 2>/dev/null || true")

  # 6. URL 항상 표시 (자동 오픈 성공 여부 무관 — CRITICAL)
  "Agent Office 대시보드: http://localhost:3747"

  # 6.1. 브라우저 복구 (서버 healthy but 브라우저 미오픈 시)
  IF health == "200" AND 브라우저가 열리지 않은 경우:
    Bash("curl -s -X POST http://localhost:3747/api/open-browser --connect-timeout 2 || true")

  # 6.2. 환경별 수동 접근 안내
  IF env_platform == "wsl":
    "tmux 세션에서 브라우저가 자동으로 열리지 않을 수 있습니다."
    "Windows 브라우저에서 직접 http://localhost:3747 을 열어주세요."
  ELIF env_platform == "windows":
    "브라우저가 자동으로 열리지 않으면 직접 http://localhost:3747 을 열어주세요."

ELSE:
  "Agent Office 미설치. /tofu-at setup을 실행하여 설치해주세요.
   현재 팀은 대시보드 없이 진행됩니다.
   진행 상황: .team-os/artifacts/TEAM_PROGRESS.md"
```

### 7-2.5. 공유 메모리 초기화 (CRITICAL)

**TeamCreate 직후, 팀원 스폰 전에 반드시 실행합니다.**
**상세 설계: `tofu-at-workflow.md` 섹션 6 참조.**

```
# 메모리 계층 자동 선택
team_size = roles 수
memory_layers = ["markdown"]  # Layer 1은 항상 사용

IF team_size >= 5:
  memory_layers.append("sqlite")

IF registry.environment.shared_memory.mcp_memory_server != "":
  memory_layers.append("mcp_memory")
```

#### Layer 1: Dashboard-Compatible Artifacts (항상)

**저장 위치: `.team-os/artifacts/` (대시보드 파서가 읽는 정확한 경로)**
**파일명: 대문자 (TEAM_PLAN, TEAM_PROGRESS, TEAM_BULLETIN, TEAM_FINDINGS)**
**포맷: 파서가 기대하는 정확한 마크다운 테이블 구조**

```
Write(".team-os/artifacts/TEAM_PLAN.md"):
  # {team_name} Team Plan

  **주제**: {purpose}
  **복잡도**: {complexity_level}

  ## Team

  | # | Name | Role | Model | Status |
  |---|------|------|-------|--------|
  {roles 테이블 - 파서가 row[1]=name, row[2]=role, row[3]=model, row[4]=status 기대}

  ## Steps

  | # | Step | Assignee | Dependency | Status |
  |---|------|----------|------------|--------|
  {steps 테이블 - 파서가 row[0]=id, row[1]=step, row[2]=assignee, row[3]=dependency, row[4]=status 기대}

  ## Workflow Flow

  | Phase | Agents | Mode | Input | Output |
  |-------|--------|------|-------|--------|
  {phase 테이블 - STEP 3 분석의 dependency layer에서 생성. 파서가 row[0]=phase, row[1]=agents, row[2]=mode, row[3]=input, row[4]=output 기대}

  ## Quality Targets

  | Metric | Target | Measure |
  |--------|--------|---------|
  | 항목별 인용 수 | 최소 3개 | 소스 파일 명시 |
  | 분석 커버리지 | 100% (할당 항목 전체) | 누락 항목 0개 |
  | 분석 깊이 | 각 항목 200자+ | 단순 나열 아닌 분석 |
  | SHIP 기준 | Ralph 5점 만점 중 3.5점+ | 4개 차원 합산 평균 |
  | 완료 시간 | 워커당 15분 이내 | 스폰~결과 수신 |

Write(".team-os/artifacts/TEAM_PROGRESS.md"):
  # {team_name} Progress

  ## Status Board

  | Agent | Task | Progress | Updated | Note |
  |-------|------|----------|---------|------|
  {각 role: | @{name} | {task설명} | 0% | {timestamp} | pending |}

  ## Checkpoints

  | # | Name | Condition | Done |
  |---|------|-----------|------|
  | 1 | All workers spawned | 모든 워커 Task 생성 완료 | [ ] |
  | 2 | All workers completed | 모든 워커 결과 수신 | [ ] |
  | 3 | Artifacts generated | 최종 산출물 생성 | [ ] |

Write(".team-os/artifacts/TEAM_BULLETIN.md"):
  # {team_name} Bulletin
  > Append-only. 기존 내용 수정 금지.
  > 형식: ## [YYYY-MM-DD HH:MM] - Agent Name

Write(".team-os/artifacts/TEAM_FINDINGS.md"):
  # {team_name} Findings
  > 리드가 팀원 결과를 통합 기록합니다.

  ### Cross-Validation Summary

  | Source | Found | Core | Isolated |
  |--------|-------|------|----------|

  ### Core Notes

  | # | Path | Relevance | Source |
  |---|------|-----------|--------|

  ### Key Insights
  1. (Lead가 기입)
```

#### Layer 2: SQLite WAL 초기화 (팀 5명 이상)

```
IF "sqlite" in memory_layers:
  Bash("sqlite3 {memory_dir}/memory.db 'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS shared_state (key TEXT PRIMARY KEY, value TEXT, agent_id TEXT, timestamp INTEGER, ttl INTEGER); CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, decision TEXT, status TEXT, proposer TEXT, votes TEXT, timestamp INTEGER); CREATE TABLE IF NOT EXISTS discoveries (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, content TEXT, tags TEXT, timestamp INTEGER);'")
```

#### Layer 3: MCP Memory 서버 연결 (설정된 경우)

```
IF "mcp_memory" in memory_layers:
  mcp_server = registry.environment.shared_memory.mcp_memory_server
  ToolSearch("{mcp_server}") → 도구 사용 가능 확인
  → 실패 시: Layer 1+2로 폴백 (경고 표시)
```

### 7-3. 태스크 등록

```
# 각 역할별 태스크 생성
TaskCreate({
  team_name: "{team_name}",
  content: "@{role_name}: {태스크 설명}",
  status: "pending"
})
```

### 모델 할당 규칙 (opus 1M 우선)

**CC를 `claude --model=opus[1m]`으로 시작하면 Main(리드)은 자동으로 opus 1M이 적용됩니다.**
**카테고리 리드도 반드시 opus로 스폰합니다 — 핵심 조율 역할이므로.**

| 역할 | 모델 | Task model 파라미터 | 이유 |
|------|------|-------------------|------|
| Lead (Main) | opus 1M | (CC 시작 시 자동) | 전체 팀 조율, 대규모 컨텍스트 필요 |
| Category Lead | opus | model: "opus" | 분석/통합 조율, 높은 판단력 필요 |
| Category Lead (1M) | sonnet 1M | model: "sonnet[1m]" | 대규모 컨텍스트 필요 시 opus 대안 (v2.1.45+) |
| Worker (분석/작성) | sonnet 4.6 | model: "sonnet" | 품질과 비용 균형 |
| Worker (1M 분석) | sonnet 1M | model: "sonnet[1m]" | 대규모 파일/코드베이스 분석 시 |
| Worker (수집/검증) | haiku | model: "haiku" | 비용 효율, 단순 반복 작업 |

**STEP 2 모델 믹스 적용 규칙:**
- 기본: Lead + Category Lead는 opus 사용
- "초저비용": Category Lead를 sonnet으로 다운그레이드
- "Sonnet 1M 확장": Category Lead와 Worker를 sonnet[1m]으로 스폰 (opus[1m]과 동일한 1M 컨텍스트, 더 낮은 비용)
- `sonnet[1m]` 구문은 `opus[1m]`과 동일하게 Task의 model 파라미터에 전달

### 7-4. 팀원 스폰 (병렬!)

**반드시 하나의 메시지에서 모든 Task를 병렬로 호출합니다.**

```
# 아래를 동시에 호출 (하나의 메시지에 모든 Task 포함):

Task(
  name: "{role_name_1}",
  subagent_type: "{subagent_type_1}",
  model: "{model_1}",
  team_name: "{team_name}",
  run_in_background: true,
  prompt: "{스폰 프롬프트 1 - 변수 치환 완료}"
)

Task(
  name: "{role_name_2}",
  subagent_type: "{subagent_type_2}",
  model: "{model_2}",
  team_name: "{team_name}",
  run_in_background: true,
  prompt: "{스폰 프롬프트 2 - 변수 치환 완료}"
)

# ... 필요한 만큼 추가
```

### 7-4-0.3. 스폰 프롬프트 파일 저장 (Results 연동)

**모든 Task 스폰 직후, 각 워커의 스폰 프롬프트를 파일로 보존합니다.**
**Results 탭에서 각 에이전트에게 전달된 정확한 프롬프트를 확인할 수 있습니다.**

```
# .team-os/spawn-prompts/ 디렉토리는 STEP 0.5-4에서 이미 생성됨

FOR each spawned_role:
  Write(".team-os/spawn-prompts/{role_name}.md", spawn_prompt_text)
  # spawn_prompt_text = Task()에 전달한 prompt 파라미터 값 (변수 치환 완료 상태)

# DA 스폰 프롬프트도 저장 (DA 활성화 시)
IF devil_advocate.enabled:
  Write(".team-os/spawn-prompts/devils-advocate.md", da_spawn_prompt_text)
```

Why: spawn-prompts 파일은 report JSON의 spawnPrompts 필드에 포함되어 Agent Office Results에서 조회 가능.
디버깅 시에도 `.team-os/spawn-prompts/` 폴더를 직접 참조할 수 있음.

### 7-4-0.5. 워커 프롬프트 progress_update_rule (CRITICAL)

**모든 워커 스폰 프롬프트에 아래 `<progress_update_rule>` 블록을 반드시 포함합니다.**
**워커가 직접 Agent Office 대시보드에 진행률을 push합니다.**

워커 프롬프트 내 삽입 블록:
```xml
<progress_update_rule>
진행 상황 변경 시 대시보드에 즉시 보고.
한국어/유니코드 인코딩 안전을 위해 Write 도구로 임시 파일 생성 후 curl -d @file 전송:

1) Write("/tmp/.tofu-at-progress.json") 호출:
   내용: {"agent":"{name}","progress":{pct},"task":"{task}","note":"{note}"}

2) Bash("curl -s -X POST http://localhost:3747/api/progress \
  -H 'Content-Type: application/json; charset=utf-8' \
  -d @/tmp/.tofu-at-progress.json \
  --connect-timeout 2 || true")

타이밍: 시작(10%, 작업중) → 진행(20-80%, 작업중) → 완료(100%, Done)
대시보드 표시: 0%=Waiting(노랑) | 1-99%=작업중(초록) | 100%=Done(파랑)
curl 실패 시 무시 (대시보드 미실행 시 정상)
</progress_update_rule>
```

**Progress API 테스트 전략 (3회 시도)**:
- 1차: 기본 프롬프트로 실행, curl 실행 비율 측정
- 2차: 프롬프트 강조도 조정 후 재실행
- 3차: 최종 판정 (50%+ 실행 → 유지, 미만 → hook fallback 전환)

### 7-4-1. Devil's Advocate 스폰 (DA 활성화 시)

```
IF devil_advocate.enabled == true:
  # DA 모델 = 사용자 선택값 (STEP 2에서 직접 선택)
  da_model = devil_advocate.model  # 사용자가 선택한 모델 직접 사용
  Task(
    name: "devils-advocate",
    subagent_type: "general-purpose",
    model: da_model,  # 사용자 선택 모델 (Lead fallback 제거)
    team_name: "{team_name}",
    run_in_background: true,
    prompt: "
<role>
당신은 Devil's Advocate입니다.
{team_name} 팀에서 리드의 판단에 건설적 반론을 제기하는 역할입니다.
</role>

<core_directive>
리드가 워커 결과를 전달하면:
1. 결과의 약점/위험성을 먼저 찾으세요
2. 누락된 관점이나 검증되지 않은 가정을 지적하세요
3. 대체 접근법을 제안하세요
4. 결론: CONCERN(재검토 필요) 또는 ACCEPTABLE(큰 문제 없음) 판정
</core_directive>

<communication_format>
SendMessage 응답에 포함:
- concern_level: HIGH/MEDIUM/LOW
- risks: [위험 목록]
- assumptions_to_verify: [검증 필요 가정]
- alternative_perspectives: [대체 관점]
- recommendation: CONCERN 또는 ACCEPTABLE + 이유
</communication_format>

<constraints>
- 읽기 전용: 파일 수정 금지
- 반론은 건설적이어야 함 (단순 반대 X)
- 응답은 500 토큰 이내
- 리드의 SendMessage에만 응답
</constraints>
"
  )
```

### 7-4-1.5. 메시지 로그 초기화 (Results 연동)

**모든 스폰 완료 직후, 에이전트 간 대화 로그 수집을 시작합니다.**
**Results 탭에서 에이전트 간 전체 메시지 흐름을 시간순으로 확인할 수 있습니다.**

```
# 메시지 로그 배열 초기화
message_log = []

# === 로깅 규칙 (STEP 7-5 ~ 7-7 전체에 적용) ===
#
# 모든 SendMessage 호출 직후, message_log에 항목을 추가합니다:
#
#   message_log.append({
#     "timestamp": "{ISO_timestamp}",
#     "from": "{sender}",        # "lead", "{worker_name}", "devils-advocate"
#     "to": "{recipient}",       # "{worker_name}", "devils-advocate", "all"
#     "type": "{message_type}",  # 아래 테이블 참조
#     "summary": "{summary 필드값 또는 요약 1줄}"
#   })
#
# === 로깅 대상 메시지 유형 ===
#
# | 위치 | from → to | type |
# |------|----------|------|
# | 7-5.5 | lead → worker | health_check |
# | 7-6 (Ralph) | lead → DA | da_review_request |
# | 7-6 (Ralph) | lead → worker | ralph_verdict |
# | 7-6 (non-Ralph) | lead → DA | da_review_request |
# | 7-6 (non-Ralph) | lead → worker | awaiting_da |
# | 7-6.5 | lead → DA | da_comprehensive_review |
# | 7-6.5 | lead → worker | da_rework |
# | 7-6.5 | lead → DA | da_re_review |
# | 7-7 | lead → all | shutdown_request |
# | 수신 | worker → lead | result |
# | 수신 | DA → lead | da_review |
#
# === 수신 메시지 로깅 ===
#
# 워커 결과 수신 시:
#   message_log.append({
#     "timestamp": "{ISO}", "from": "{worker_name}", "to": "lead",
#     "type": "result", "summary": "{결과 요약 1줄}"
#   })
#
# DA 리뷰 응답 수신 시:
#   message_log.append({
#     "timestamp": "{ISO}", "from": "devils-advocate", "to": "lead",
#     "type": "da_review", "summary": "{recommendation}: {요약}"
#   })
```

Why: message_log는 report JSON의 messageLog 필드에 포함되어 Agent Office Results에서 시간순 테이블로 표시됨.
TEAM_BULLETIN.md는 이벤트(milestone)만 기록하지만, message_log는 에이전트 간 실제 대화 흐름을 기록.

### 7-4-2. 진행 상태 초기 업데이트 (대시보드 연동)

**모든 Task 스폰 직후, 대시보드에 실행 상태를 반영합니다.**

> **진행률 갱신 규칙 (3-State 표시 + 8레벨 내부 추적 — CRITICAL for Agent Office 실시간 반영)**:
> - **대시보드 상태 표시**: Waiting(0%, 노랑) → 작업중(1-99%, 초록) → Done(100%, 파랑)
> - General 워커 내부 추적: 5%(spawned) → 10%(assigned) → 20%(first_message) → 30-70%(active) → 80%(results_sent) → 90%(ralph_waiting) → 95%(shutdown) → 100%(team_deleted)
> - Explore 워커 내부 추적: 10%(spawned) → 25→50→75%(active) → 80%(results_sent) → 95%(shutdown) → 100%(team_deleted)
> - Done(100%)은 DA ACCEPTABLE 판정 시 (또는 DA 비활성 시 전체 완료 후) 즉시 표시. TeamDelete는 리소스 정리용이며 Done 표시와 무관
> - 최소 2분마다 1회 갱신 (Agent Office 15초 폴링 + SSE로 실시간 반영)
> - 워커 프롬프트에 `<progress_update_rule>` 포함됨

```
# 모든 Task 스폰 직후:
FOR each spawned_role:
  TEAM_PROGRESS.md의 해당 Agent 행 업데이트:
    Progress: 0% → 10%
    Note: pending → spawned
    Updated: {current_timestamp}

# Checkpoint 1 업데이트:
  | 1 | All workers spawned | 모든 워커 Task 생성 완료 | [x] |

# TEAM_BULLETIN.md에 Append:
  ## [{timestamp}] - Lead
  **Task**: Team spawn complete
  **Findings**: {N}명 워커 스폰 완료: {role_names}
  **Status**: active
```

### 7-5. 사용자 알림

```markdown
Agent Teams가 Split Pane 모드로 실행됩니다.

| 팀원 | 역할 | 모델 | 상태 |
|------|------|------|------|
| {role_1} | {설명} | {model} | 실행 중 |
| {role_2} | {설명} | {model} | 실행 중 |
| ... | ... | ... | ... |

팀원들이 병렬로 작업하면 리드가 결과를 통합합니다.
```

### 7-5.5. Health Check 루프 (리드 모니터링 — CRITICAL)

**결과 수신 대기 중 비활성 에이전트를 감지하고 깨웁니다.**

```
# 결과 수신 대기 중 5분 간격으로 health check 수행:
WHILE 아직 완료되지 않은 워커가 있음:
  # TEAM_PROGRESS.md에서 각 에이전트의 마지막 업데이트 시간 확인
  FOR each active_worker:
    last_update = TEAM_PROGRESS.md에서 해당 Agent의 Updated 열 파싱
    elapsed = current_time - last_update

    IF elapsed > 5분:
      # 1차: 상태 확인 메시지 전송
      SendMessage(
        recipient: "{worker_name}",
        content: "상태 확인: 마지막 업데이트로부터 5분 경과. 현재 진행 상황을 보고해주세요.",
        summary: "Health check for {worker_name}"
      )

      # 2차 (10분 경과 시): 셧다운 + 교체 판단
      IF elapsed > 10분 AND 이미 상태 확인 메시지 전송 완료:
        → SendMessage(type: "shutdown_request", recipient: "{worker_name}")
        → 새 에이전트 스폰 (같은 이름 재사용 금지!)
        → TEAM_BULLETIN.md에 기록: "Agent {worker_name} replaced due to inactivity"
```

### 7-6. 결과 수신 + 통합 (대시보드 실시간 갱신 포함)

```
IF ralph_loop.enabled == true:
  # Ralph 루프 모드: 리뷰-피드백-수정 반복
  for each worker_result:
    iteration = 0
    WHILE iteration < ralph_loop.max_iterations:
      # 1. 결과 수신
      worker_msg = 팀원 메시지 자동 수신

      # 2. (NEW) Devil's Advocate 검토 요청
      advocate_response = null
      IF devil_advocate.enabled:
        SendMessage(
          recipient: "devils-advocate",
          content: "다음 워커 결과를 검토하고 반론을 제시하세요:\n\n워커: {worker_name}\n결과 요약: {worker_msg 요약}\n\n반드시 포함: 위험성, 누락된 관점, 검증 필요 가정",
          summary: "DA review request for {worker_name}"
        )
        # DA 응답 자동 수신 대기
        advocate_response = DA 메시지 자동 수신

      # 3. review_criteria 기준으로 리뷰 (DA 반론 반영)
      IF advocate_response:
        review = Lead가 (worker_msg + advocate_response) 종합 평가 (ralph_loop.review_criteria)
      ELSE:
        review = Lead가 결과 평가 (ralph_loop.review_criteria)

      # 3. 판정
      IF review == "SHIP":
        TaskUpdate(status: "completed")

        # === 대시보드 진행 업데이트 (SHIP - 80% 대기) ===
        TEAM_PROGRESS.md의 해당 Agent 행 업데이트:
          Progress: → 80%
          Note: → SHIP (DA 리뷰 대기)
          Updated: → {current_timestamp}

        # 워커에게 대기 메시지 전송 (셧다운 보류)
        SendMessage(recipient: {worker_name}, content: "SHIP 판정. DA 종합 리뷰 대기 중입니다. 대기해 주세요.", summary: "SHIP - awaiting DA review")

        # curl API progress push
        Write("/tmp/.tofu-at-progress.json", '{"agent":"{worker_name}","progress":80,"task":"SHIP - DA review pending","note":"awaiting DA comprehensive review"}')
        Bash("curl -s -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || true")

        TEAM_BULLETIN.md에 Append:
          ## [{timestamp}] - {worker_name}
          **Task**: {task_description}
          **Findings**: {결과 요약 1-2줄}
          **Status**: SHIP (DA 리뷰 대기)

        BREAK  # 다음 워커로

      ELSE:  # REVISE
        iteration += 1
        피드백 = "REVISE #{iteration}: {구체적 개선 사항}"
        SendMessage(recipient: {worker_name}, content: 피드백)

        # === 대시보드 진행 업데이트 (REVISE) ===
        TEAM_PROGRESS.md의 해당 Agent 행 업데이트:
          Progress: → 50%
          Note: → revise #{iteration}
          Updated: → {current_timestamp}

        TEAM_BULLETIN.md에 Append:
          ## [{timestamp}] - Ralph Review: {worker_name}
          **Task**: REVISE #{iteration}
          **Findings**: {피드백 요약}
          **Status**: revise

        # 워커 재작업 결과 대기

    IF iteration >= ralph_loop.max_iterations:
      → 경고: "Ralph 루프 최대 반복({max})에 도달. 현재 결과로 진행."
      TaskUpdate(status: "completed")

      # === 대시보드 진행 업데이트 (max reached) ===
      TEAM_PROGRESS.md의 해당 Agent 행 업데이트:
        Progress: → 80%
        Note: → max iterations (DA 리뷰 대기)
        Updated: → {current_timestamp}

      # 워커에게 대기 메시지 전송 (셧다운 보류)
      SendMessage(recipient: {worker_name}, content: "DA 종합 리뷰 대기 중입니다. 대기해 주세요.", summary: "max iterations - awaiting DA review")

      TEAM_BULLETIN.md에 경고 + 마지막 점수표 기록

  # Ralph 루프 완료 후
  # === Checkpoint 2 업데이트 ===
  TEAM_PROGRESS.md Checkpoint 2: | 2 | All workers completed | ... | [x] |

  결과 교차 검증 (여러 워커의 결과 비교)
  Write로 산출물 생성 (리드/Main만!)
  Glob/Read로 산출물 검증

  # === Checkpoint 3 업데이트 ===
  TEAM_PROGRESS.md Checkpoint 3: | 3 | Artifacts generated | ... | [x] |

ELSE:
  # 기본 모드: 결과 즉시 수락
  1. 팀원 메시지 자동 수신 대기

  # (NEW) Devil's Advocate 검토 (DA 활성화 시)
  IF devil_advocate.enabled:
    FOR each worker_result received:
      SendMessage(
        recipient: "devils-advocate",
        content: "다음 워커 결과를 검토하고 반론을 제시하세요:\n\n워커: {worker_name}\n결과 요약: {worker_msg 요약}\n\n반드시 포함: 위험성, 누락된 관점, 검증 필요 가정",
        summary: "DA review request for {worker_name}"
      )
      advocate_response = DA 메시지 자동 수신
      # 리드가 워커 결과 + DA 반론을 함께 고려하여 최종 판단

  2. 각 팀원 결과를 요약하여 컨텍스트에 추가 (DA 반론 포함 시 함께)

  # === 대시보드 진행 업데이트 (각 워커 결과 수신 시 - CRITICAL) ===
  FOR each worker_result received:
    TEAM_PROGRESS.md의 해당 Agent 행 업데이트:
      Progress: → 80%
      Note: → DA 리뷰 대기
      Updated: → {current_timestamp}

    # 워커에게 대기 메시지 전송 (셧다운 보류)
    SendMessage(recipient: {worker_name}, content: "DA 종합 리뷰 대기 중입니다. 대기해 주세요.", summary: "awaiting DA review")

    # curl API progress push
    Write("/tmp/.tofu-at-progress.json", '{"agent":"{worker_name}","progress":80,"task":"DA review pending","note":"awaiting DA comprehensive review"}')
    Bash("curl -s -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || true")

    TEAM_BULLETIN.md에 Append:
      ## [{timestamp}] - {worker_name}
      **Task**: {task_description}
      **Findings**: {결과 요약 1-2줄}
      **Status**: DA 리뷰 대기

  3. 모든 팀원 완료 확인

  # === Checkpoint 2 업데이트 ===
  TEAM_PROGRESS.md Checkpoint 2: | 2 | All workers completed | ... | [x] |

  4. 결과 교차 검증 (여러 워커의 결과 비교)
  5. Write로 산출물 생성 (리드/Main만!)
  6. Glob/Read로 산출물 검증

  # === Checkpoint 3 업데이트 ===
  TEAM_PROGRESS.md Checkpoint 3: | 3 | Artifacts generated | ... | [x] |
```

### 7-6.5. DA 종합 리뷰 (2-Phase Review — DA 활성화 시)

**모든 워커 결과 수집 완료 후, DA에게 전체 결과를 종합 검토하도록 요청합니다.**
**기존: 워커별 즉시 SHIP/REVISE → 변경: 전체 수집 → DA 종합 검토 → 재작업 가능**

```
IF devil_advocate.enabled == true:
  # PRECONDITION: 모든 워커 결과 수집 완료 (각 워커 progress == 80%)

  # 1. DA에게 전체 결과 종합 검토 요청
  all_results_summary = 모든 워커의 결과를 1페이지로 요약
  SendMessage(
    recipient: "devils-advocate",
    content: "전체 워커 결과를 종합 검토해주세요:\n\n{all_results_summary}\n\n검토 관점:\n1. 워커 간 결과 일관성\n2. 전체 커버리지 누락 여부\n3. 교차 검증 불일치\n4. 종합 recommendation: ACCEPTABLE 또는 CONCERN + 재작업 대상 워커",
    summary: "DA comprehensive review request"
  )

  # 2. DA 응답 수신 (타임아웃 2분)
  da_timeout_reached = false
  da_review = DA 메시지 자동 수신 (최대 2분 대기)

  # 2-1. 타임아웃 처리 (NEW — Bug 3 수정)
  IF DA 응답 2분 내 미수신:
    → 경고: "DA 종합 리뷰 타임아웃 (2분). 현재 결과로 진행합니다."
    da_timeout_reached = true
    FOR each worker:
      TEAM_PROGRESS.md: Progress → 100%, Note → completed (DA timeout)
      Write("/tmp/.tofu-at-progress.json", '{"agent":"{worker_name}","progress":100,"task":"completed","note":"DA timeout - proceeded without review"}')
      Bash("curl -s -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || true")
    → STEP 7-7 셧다운 진행

  da_iteration = 0

  # 3. DA 판정 처리
  IF da_review.recommendation == "ACCEPTABLE":
    # 모든 워커 100%로 업데이트
    FOR each worker:
      TEAM_PROGRESS.md: Progress → 100%, Note → completed (DA ACCEPTABLE)
      Write("/tmp/.tofu-at-progress.json", '{"agent":"{worker_name}","progress":100,"task":"completed","note":"DA ACCEPTABLE"}')
      result = Bash("curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || echo 'fail'")
      IF result != "200":
        Bash("curl -s -X POST http://localhost:3747/api/progress/done --connect-timeout 2 || true")

    # → STEP 7-7 셧다운 진행

  ELIF da_review.recommendation == "CONCERN":
    da_iteration += 1
    # 재작업 대상 워커 식별
    rework_targets = da_review에서 재작업 필요 워커 목록 추출

    WHILE da_iteration < 3 AND rework_targets not empty:
      FOR each rework_worker in rework_targets:
        # 해당 워커에 DA 피드백 전달
        SendMessage(
          recipient: "{rework_worker}",
          content: "DA 종합 리뷰 피드백:\n{da_review.feedback_for_worker}\n\n수정 후 다시 결과를 보내주세요.",
          summary: "DA rework request for {rework_worker}"
        )

        # 워커 progress 50%로 다운그레이드
        TEAM_PROGRESS.md: Progress → 50%, Note → DA rework #{da_iteration}
        Write("/tmp/.tofu-at-progress.json", '{"agent":"{rework_worker}","progress":50,"task":"DA rework","note":"iteration #{da_iteration}"}')
        Bash("curl -s -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || true")

      # 수정 결과 재수신
      FOR each rework_worker:
        reworked_result = 워커 메시지 자동 수신
        TEAM_PROGRESS.md: Progress → 80%, Note → rework submitted

      # DA 재검토
      da_iteration += 1
      SendMessage(
        recipient: "devils-advocate",
        content: "수정된 결과를 재검토해주세요:\n{reworked_results_summary}\n\nrecommendation: ACCEPTABLE 또는 CONCERN",
        summary: "DA re-review #{da_iteration}"
      )
      da_review = DA 메시지 자동 수신

      IF da_review.recommendation == "ACCEPTABLE":
        FOR each worker:
          TEAM_PROGRESS.md: Progress → 100%, Note → completed (DA ACCEPTABLE)
        BREAK

      rework_targets = da_review에서 재작업 필요 워커 목록 추출

    IF da_iteration >= 3:
      → 경고: "DA 리뷰 최대 반복(3)에 도달. 현재 결과로 진행."
      FOR each worker:
        TEAM_PROGRESS.md: Progress → 100%, Note → completed (DA max iterations)

ELSE:
  # DA 비활성화 시: 기존 로직대로 즉시 100%
  FOR each worker:
    TEAM_PROGRESS.md: Progress → 100%, Note → completed
    Write("/tmp/.tofu-at-progress.json", '{"agent":"{worker_name}","progress":100,"task":"completed","note":"no DA"}')
    Bash("curl -s -X POST http://localhost:3747/api/progress -H 'Content-Type: application/json; charset=utf-8' -d @/tmp/.tofu-at-progress.json --connect-timeout 2 || true")
```

**Ralph + DA 통합 흐름:**
```
Ralph (per-worker) → 각 워커 SHIP → 전체 수집 (80%) → DA (cross-cutting) → 재작업 필요 시 재배정 → 최종 DA ACCEPTABLE → 셧다운
```

Ralph는 개별 워커 품질, DA는 전체 결과 간 일관성/누락 검증.

### 7-7. 셧다운 + 정리

```
PRECONDITION (셧다운 전제 조건 — DA 활성화 시):
  devil_advocate.enabled == false
  OR da_review.recommendation == "ACCEPTABLE"
  OR da_iteration >= 3
  OR da_timeout_reached == true   # NEW: DA 2분 타임아웃 폴백 (Bug 3 수정)

# DA 미승인 시 셧다운 불가 — STEP 7-6.5 완료 후에만 진행

1. 각 팀원에게 shutdown_request:
   SendMessage({ type: "shutdown_request", recipient: "{role_name}", content: "작업 완료" })

1-1. (DA 활성화 시) Devil's Advocate 셧다운:
   IF devil_advocate.enabled:
     SendMessage({ type: "shutdown_request", recipient: "devils-advocate", content: "작업 완료" })

2. shutdown_response 대기 (최대 3초):
   각 팀원의 shutdown_response를 대기.
   3초 내 응답 없는 팀원은 아래 3번에서 강제 정리.
   (10초→3초 단축: 대부분의 팀원은 즉시 응답하거나 응답 불가.
    길게 대기해도 CC "scurrying" 시간만 증가.)

3. 잔류 에이전트 강제 정리 (CRITICAL — scurrying 방지):
   # 팀원이 shutdown에 응답하지 않거나 이미 종료된 경우,
   # orphan 프로세스/pane이 남아 CC가 "scurrying" 상태를 유지할 수 있음.
   # 플랫폼에 따라 정리 방법을 분기:
   FOR each member in team_config.members (리드 제외):
     IF env_platform == "windows":
       # Windows: tmux 없음. isActive 플래그 강제 설정으로 TeamDelete 허용.
       # CC 내장 에이전트 종료 메커니즘에 의존 (shutdown_request가 이미 전송됨).
       PASS  # tmux kill-pane 스킵
     ELIF member.tmuxPaneId:
       Bash("tmux kill-pane -t {member.tmuxPaneId} 2>/dev/null || true")
     # tmuxPaneId 없는 경우 (in-process 모드): CC 자체 정리에 의존

   # config.json에서 isActive: false 미설정 멤버 수동 보정:
   # (TeamDelete가 active 멤버 있으면 거부하므로) — 모든 플랫폼 공통
   FOR each member in team_config.members (리드 제외):
     IF member.isActive != false:
       config.json에서 해당 member의 isActive = false 설정

4. Results 보고서 자동 전송 (MANDATORY — TeamDelete 전에 실행!):
   # TeamDelete 후에는 team config가 삭제되어 정보 수집 불가.
   # 반드시 TeamDelete 전에 Results를 전송합니다.

   # 4a. da_review 필드 기본값 보장 (undefined 방지 — Bug 5 수정)
   IF da_review == undefined OR da_timeout_reached == true:
     report.da_review = {
       "enabled": devil_advocate.enabled,
       "recommendation": "N/A",
       "note": da_timeout_reached ? "DA did not respond (timeout)" : "DA not active"
     }

   # 4b. spawnPrompts 수집 (.team-os/spawn-prompts/ 파일에서)
   spawnPrompts = []
   spawn_files = Glob(".team-os/spawn-prompts/*.md")
   IF spawn_files is empty:
     # spawn-prompts 파일 없음: graceful degradation (Results에 Prompts 탭 미표시)
     TEAM_BULLETIN.md에 Append: "Note: spawn-prompts 파일 없음. Results Spawn Prompts 탭이 비어있을 수 있습니다."
   ELSE:
     FOR each file in spawn_files:
       content = Read(file)
       IF content is empty:
         CONTINUE  # 빈 파일 건너뛰기
       agent_name = file에서 파일명 추출 (확장자 제거)
       # team 배열에서 해당 에이전트의 role, model 조회
       member = team 배열에서 name == agent_name인 항목
       spawnPrompts.append({
         "agent": agent_name,
         "role": member.role || "Worker",
         "model": member.model || "unknown",
         "prompt": content
       })

   # 4c. report JSON 구성
   report = {
     "id": "{timestamp}-{team_name}",
     "timestamp": "{ISO 8601}",
     "teamName": "{team_name}",
     "subject": "{purpose}",
     "complexity": "{complexity_level}",
     "duration": "{실행 소요 시간}",
     "sourceCommand": "/tofu-at",
     "team": [각 role의 { name, role, model, status }],
     "steps": [각 step의 { id, step, assignee, status }],
     "checkpoints": [각 checkpoint의 { name, done }],
     "bulletin": [{최근 bulletin 항목들}],
     "results": { "summary": "...", "details": "...", "artifacts": [...] },
     "ralph": { "enabled": ..., "iterations": {...}, "verdict": "..." },
     "da_review": report.da_review || { "enabled": false },
     "spawnPrompts": spawnPrompts,
     "messageLog": message_log
   }

   # 4d. JSON 파일로 저장 후 curl 전송 (escape 문제 방지 — Bug 5 수정)
   Bash("mkdir -p .team-os/reports")
   Write(".team-os/reports/_pending.json", JSON.stringify(report, null, 2))

   # 4d-1. JSON 유효성 검증 (Windows 인코딩 깨짐 대비)
   validation = Bash("node -e \"try{JSON.parse(require('fs').readFileSync('.team-os/reports/_pending.json','utf-8'));console.log('valid')}catch(e){console.log('invalid')}\" 2>/dev/null || echo 'invalid'")
   IF validation starts with "invalid":
     # JSON 깨짐 감지 시 재생성 시도 (한국어 제외 영어 필드만 포함)
     Write(".team-os/reports/_pending.json", JSON.stringify(report, null, 2))

   result = Bash("curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3747/api/reports -H 'Content-Type: application/json; charset=utf-8' -d @.team-os/reports/_pending.json --connect-timeout 5 || echo 'fail'")

   # 4e. 전송 결과 확인
   IF result == "200" OR result == "201":
     Bash("rm .team-os/reports/_pending.json 2>/dev/null || true")
   ELSE:
     # 파일이 이미 저장되어 있으므로 rename (fallback 보존)
     Bash("mv .team-os/reports/_pending.json .team-os/reports/{report.id}.json 2>/dev/null || true")

   # 성공 여부와 무관하게 다음 단계로 진행

5. TeamDelete()

6. 대시보드 아티팩트 정리:
   Bash("curl -s -X POST http://localhost:3747/api/session/clear --connect-timeout 2 || true")
   → .team-os/artifacts/TEAM_*.md 삭제 (MEMORY.md 유지)
   → 대시보드가 stale 팀 데이터 표시하지 않도록 방지
   → 실패해도 무시 (Agent Office 미실행 시)
```

Why: shutdown_request만 보내고 TeamDelete를 시도하면, 응답 안 한 팀원의 tmux pane이 orphan으로 남아
CC가 계속 "scurrying" 상태를 표시합니다. tmux pane 강제 kill + isActive 보정으로 깨끗하게 정리.

---

## STEP 8: 검증 + 보고 + Results 저장

```markdown
## 실행 결과

### 팀 라이프사이클
| 단계 | 상태 | 비고 |
|------|------|------|
| TeamCreate | ✅/❌ | {team_name} |
| Task 스폰 ({N}개) | ✅/❌ | 병렬 실행 |
| 워커 완료 | {N}개 중 {M}개 ✅ | {완료/실패 목록} |
| 결과 통합 | ✅/❌ | |
| 산출물 생성 | ✅/❌ | {파일 목록} |
| TeamDelete | ✅/❌ | |

### 산출물
| 파일 | 상태 | 검증 |
|------|------|------|
| {출력파일1} | ✅ 생성됨 | Glob 확인 |
| {출력파일2} | ✅ 생성됨 | Read 확인 |

### 사용 리소스
| 항목 | 값 |
|------|---|
| 팀원 수 | {N} |
| 모델 사용 | Opus:{n}, Sonnet:{n}, Haiku:{n} |
| MCP 서버 | {사용된 목록} |
| CLI 도구 | {사용된 목록} |
```

### 8-1. Results 보고서 자동 저장 (Agent Office 연동)

**실행 완료 후 보고서를 JSON으로 저장하여 Agent Office Results 탭에서 조회 가능하게 합니다.**

```
# 보고서 JSON 구성
report = {
  "id": "{timestamp}-{team_name}",
  "timestamp": "{ISO 8601}",
  "teamName": "{team_name}",
  "subject": "{purpose}",
  "complexity": "{complexity_level}",
  "duration": "{실행 소요 시간}",
  "sourceCommand": "/tofu-at",
  "team": [
    { "name": "{role_name}", "role": "{Lead/Worker}", "model": "{Opus 4.6 [1M]}", "status": "{completed}" }
  ],
  "steps": [
    { "id": "1", "step": "{step_description}", "assignee": "{worker_name}", "status": "done" }
  ],
  "checkpoints": [
    { "name": "All workers spawned", "done": true },
    { "name": "All workers completed", "done": true },
    { "name": "Artifacts generated", "done": true }
  ],
  "bulletin": [{최근 bulletin 항목들}],
  "results": {
    "summary": "{결과 요약}",
    "details": "{상세 내용}",
    "artifacts": ["{생성된 파일 목록}"]
  },
  "ralph": {
    "enabled": {ralph_loop.enabled},
    "iterations": { "{worker_name}": {iteration_count} },
    "verdict": "{SHIP/REVISE}"
  }
}

# Agent Office 서버로 전송 (실행 중인 경우)
Bash("curl -s -X POST http://localhost:3747/api/reports -H 'Content-Type: application/json' -d '{report JSON}'")

# 실패 시 fallback: 직접 파일 저장
IF curl 실패:
  Write(".team-os/reports/{report.id}.json", JSON.stringify(report))
```

---

## STEP 9: 원클릭 재실행 커맨드 생성

**팀 실행 완료 후, 동일 워크플로우를 한 단어로 재실행할 수 있는 슬래시 커맨드를 자동 생성합니다.**

> ⛔ **AskUserQuestion으로 커맨드 이름을 반드시 수집합니다.**

### 자동 이름 생성 규칙

team_id에서 핵심 키워드를 추출하여 짧고 기억하기 쉬운 이름을 자동 생성합니다:

```
team_id: "persona.tofukyung.article.v3" → 추천: "tofukyung-team"
team_id: "km.ai-benchmark.vault.v1"     → 추천: "ai-benchmark"
team_id: "research.prompt-writing.v2"   → 추천: "prompt-research"

규칙:
1. team_id에서 가장 구별되는 세그먼트 1-2개 추출
2. "persona", "km", "research" 등 범주 접두어 제거
3. 2-3단어 이내, 하이픈 연결
4. 기존 .claude/commands/ 파일명과 충돌 방지 확인
```

```
AskUserQuestion({
  "questions": [
    {
      "question": "재실행 커맨드 이름을 선택해주세요",
      "header": "커맨드명",
      "options": [
        {"label": "/{auto_name} (Recommended)", "description": "자동 생성 이름 — 다음부터 /{auto_name} 한 줄로 실행"},
        {"label": "건너뛰기", "description": "커맨드 생성 안 함 (기존처럼 /tofu-at spawn ... 사용)"}
      ],
      "multiSelect": false
    }
  ]
})
```

**"건너뛰기" 선택 시**: 기존처럼 `/tofu-at spawn {team_id}` 안내 후 종료.
**추천 이름 또는 사용자 지정 이름 선택 시**: 아래 절차로 `.claude/commands/{name}.md` 파일 자동 생성.

### 9-1. 커맨드 파일 생성

```
command_name = 사용자 지정 이름 (소문자, 하이픈 허용, 공백/특수문자 제거)

Write(".claude/commands/{command_name}.md"):
```

**생성되는 커맨드 파일 템플릿:**

```markdown
---
description: {subject 또는 description} (tofu-at 생성 — /{command_name})
allowedTools: Task, Read, Write, Bash, Glob, Grep, AskUserQuestion, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, SendMessage, ToolSearch
---

# /{command_name}

> tofu-at 자동 생성 커맨드. 원본 team_id: `{team_id}`

$ARGUMENTS

## 팀 설정

- **team_id**: {team_id}
- **설명**: {description}
- **팀원**: {N}명 ({roles 요약})
- **모델 믹스**: {Lead: opus, Workers: sonnet/haiku}
- **생성일**: {YYYY-MM-DD}

## 실행

> Agent Office 대시보드가 자동으로 실행됩니다 (port 3747).
> 서버 헬스체크 → 포트 정리 → 서버 시작 → 브라우저 오픈이 자동으로 처리됩니다.

이 커맨드는 `/tofu-at spawn {team_id}`와 동일한 워크플로우를 실행합니다.

Skill("tofu-at", args: "spawn {team_id}")
```

### 9-2. 사용자 안내

```markdown
## 재실행 커맨드 생성 완료

`/{command_name}` 커맨드가 생성되었습니다.

| 항목 | 값 |
|------|---|
| 커맨드 | `/{command_name}` |
| 파일 | `.claude/commands/{command_name}.md` |
| 원본 | `/tofu-at spawn {team_id}` |

다음부터는 아래 명령어로 동일한 팀을 즉시 실행할 수 있습니다:

  /{command_name}

인자를 전달하면 워크플로우 대상을 변경할 수 있습니다:

  /{command_name} [새로운 대상/옵션]
```

---

## 모드별 흐름 요약

| 모드 | STEP 순서 |
|------|----------|
| 인터랙티브 | 0 → 0.5 → (모드 선택) → 해당 모드 |
| scan | 0 → **2-A → 2-B** → 0.5 → 1 → 3 → 4 → 5 → 6 → (선택) → 7 → 8 → 9 |
| inventory | 0.5 → 1 → (출력 후 종료) |
| spawn | 0.5 → 1 (간략) → 7 → 8 → 9 |
| catalog | 0.5 → 1 → 4 → (registry.yaml 저장) |
| clone | 0.5 → (기존 팀 설정 읽기) → (스냅샷 저장) |
| setup | 0-SETUP → (완료 후 종료 또는 원래 모드 복귀) |
| 첫 실행 | 0 → 0-SETUP (자동) → 원래 모드 |

---

## 참조 스킬

| 기능 | 참조 스킬 |
|------|----------|
| 리소스 탐색 + 분석 알고리즘 | `tofu-at-workflow.md` |
| YAML 스키마 + 예시 | `tofu-at-registry-schema.md` |
| 스폰 프롬프트 템플릿 | `tofu-at-spawn-templates.md` |
| CE 체크리스트 | `context-engineering-collection.md` |
| /prompt 파이프라인 내재화 | `prompt.md` (목적감지, 요소확장, 전문가토론, CE) |
| 전문가 도메인 프라이밍 | `tofu-at-spawn-templates.md` §7.5 (27도메인 137명 전문가 DB 내장) |
| Claude 최적화 전략 | `claude-4.5-prompt-strategies.md` (default_to_action 등) |
| Agent Teams 참조 구현 | `knowledge-manager.md` (STEP 3-6) |

---

## 제약 사항

| 제약 | 대응 |
|------|------|
| Task 에이전트 파일 쓰기 불가 (Bug-2025-12-12-2056) | 모든 Write는 Main/리드가 직접 수행 |
| 중첩 팀 불가 | 카테고리 리드는 teammate로만. 추가 워커 요청은 SendMessage |
| Split Pane = tmux 필수 | STEP 0.5에서 검증 + 플랫폼별 안내 |
| MCP 도구 정규화 이름 | `mcp__{서버명}__{도구명}` 형식 강제 |
| CLI 우선 정책 | Playwright CLI >> MCP (10-100x 토큰 절약) |
| Obsidian vault 경로 | AI_Second_Brain/ prefix 금지 |
| Dashboard Split Pane 불필요 | ops.dashboard.* → teammate_mode: "auto" |
| WSL tmux에서 platform은 "linux" | env_profile.platform으로 WSL 별도 감지 (`uname -r` 검사) |
| WSL에서 xdg-open 불가 | `cmd.exe /c start` 사용 (WSL→Windows interop) |
| WSL에서 agent-office 경로 | env_profile.agent_office_path로 자동 감지 (STEP 0.5 4.5단계) |
| Agent Office 서버 시작 (모든 플랫폼) | 항상 `AGENT_OFFICE_ROOT=$(pwd)` 설정 — config.js가 정확한 프로젝트 루트를 찾도록 보장 |
| 아티팩트 파일은 `.team-os/artifacts/` | 소문자 memory/ 아닌 artifacts/ 에 저장 |
| 대시보드 파서 포맷 고정 | TEAM_PROGRESS.md `## Status Board` + 5열 테이블 필수 |
| TEAM_BULLETIN.md 형식 고정 | `## [YYYY-MM-DD HH:MM] - Agent Name` 형식 필수 |
| Agent Office 필수 | 미설치 시 /tofu-at setup으로 설치 안내. 대시보드 없이도 핵심 기능은 작동하나, 설치 권장 |
| 첫 실행 자동 setup | settings 또는 .team-os/ 미비 시 STEP 0-SETUP 자동 실행 |

---

## 수정 시 자동 동기화 규칙 (CRITICAL)

**/tofu-at 수정 시 아래 항목을 반드시 함께 확인·업데이트합니다.**

| 수정 대상 | 함께 확인할 파일/섹션 | 이유 |
|----------|-------------------|------|
| STEP 0.5 (환경 감지) | WSL/tmux/브라우저 매트릭스, 제약 사항 테이블 WSL 항목 | env_profile 변경 시 제약 사항과 불일치 방지 |
| STEP 5 (프롬프트 생성) | `tofu-at-spawn-templates.md` CE 체크리스트, 6-Tier 토큰 한도 | 커맨드↔스킬 간 토큰 정책 동기화 |
| STEP 7 (실행/대시보드) | `.team-os/artifacts/` 파일명·포맷, 제약 사항 테이블 | 대시보드 파서 호환 유지 |
| 제약 사항 테이블 | STEP 0.5-3 env_profile, STEP 7-2.1, STEP 7-2.5 | 제약 추가 시 해당 STEP에도 반영 |
| 참조 스킬 테이블 | `tofu-at-workflow.md`, `tofu-at-spawn-templates.md` | 스킬 파일 변경 시 커맨드 참조 업데이트 |

---

## AskUserQuestion 필수 호출 규칙 (CRITICAL — 문서 말미 재확인)

<mandatory_interaction_reminder rule="NEVER_SKIP">
이 커맨드의 AskUserQuestion 호출은 워크플로우 필수 입력입니다.

**bypassPermissions = true여도 AskUserQuestion은 반드시 호출합니다.**
**$ARGUMENTS가 제공되어도 해당 STEP의 AskUserQuestion은 반드시 호출합니다.**
**plan mode에서도 각 ⛔ STOP 지점에서 반드시 AskUserQuestion을 호출합니다.**

| STEP | 질문 내용 | ⛔ STOP | 전제 조건 | 스킵 가능 조건 |
|------|----------|---------|----------|--------------|
| STEP 2-A | 팀 규모, 모델 믹스, 품질 게이트, 출력 형식 | ⛔ (AskUserQuestion 1/2) | STEP 0 완료 (라우팅 직후) | spawn/catalog 모드일 때만 |
| STEP 2-B | Ralph 루프, Devil's Advocate | ⛔ (AskUserQuestion 2/2) | STEP 2-A 응답 수신 | spawn/catalog 모드일 때만 |
| STEP 3 | 팀 구성안 확인/수정/재분석 | ⛔ | STEP 1 완료 + STEP 2-B 응답 수신 | 스킵 불가 |
| STEP 6 | 즉시 실행/registry 저장/프롬프트 출력/수정 | ⛔ | STEP 3 응답 수신 | 스킵 불가 |
| STEP 9 | 재실행 커맨드 이름 지정 | ⛔ | STEP 8 완료 | 스킵 불가 |

**실행 흐름 (scan 모드, plan mode / 일반 mode 공통):**
STEP 0 (라우팅) → [첫 실행 감지 시: STEP 0-SETUP 자동 실행 → 완료 후 복귀] → ⛔ STEP 2-A AskUserQuestion 1/2 → 응답 대기 → ⛔ STEP 2-B AskUserQuestion 2/2 → 응답 대기 → STEP 0.5-1 (환경 감지+리소스 스캔, 자동) → STEP 3 분석 → ⛔ STEP 3 AskUserQuestion → 응답 대기 → STEP 4-5 → ⛔ STEP 6 AskUserQuestion → 응답 대기 → STEP 7-8 → ⛔ STEP 9 AskUserQuestion → 응답 대기 → 커맨드 생성

**실행 흐름 (setup 모드):**
STEP 0 (라우팅) → STEP 0-SETUP → (완료 후 종료)

Why: STEP 0.5+1의 20-30회 자동 도구 호출이 "자동 실행 관성(Momentum Effect)"을 만들어 STEP 2의 AskUserQuestion을 스킵시킴. STEP 2의 질문은 환경/리소스 정보에 의존하지 않으므로 라우팅 직후 수집.

**도구 제약 준수**: AskUserQuestion은 1회 호출당 최대 4개 질문, 질문당 최대 4개 선택지.
STEP 2의 6가지 질문은 반드시 2회(4+2)로 분할 호출해야 합니다.

bypassPermissions는 Bash, Write 등 시스템 변경 도구의 승인만 생략합니다.
AskUserQuestion은 시스템 변경이 아닌 사용자 선호도 수집이므로 bypass 대상이 아닙니다.
여러 STEP의 AskUserQuestion을 한꺼번에 묶어서 질문하지 마세요 — 각 STEP에서 개별 호출합니다.
</mandatory_interaction_reminder>