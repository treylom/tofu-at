# Tofu-AT (Tofu Agent Teams)

> 🇰🇷 한국어 설명입니다. [English guide is below ↓](#tofu-at-english)

워크플로우를 Claude Code의 Agent Teams (Split Pane / Swarm)로 자동 변환하는 오케스트레이션 프레임워크.

---

> ## 💡 Claude Code에 아래 메시지를 그대로 전달하면 가장 정확하게 설치됩니다
>
> ```
> https://github.com/treylom/tofu-at 설치해줘. https://tofu-at.manus.space 를 참고하면 더 도움이 될거야.
> ```

---

**Tofu-AT**는 기존 스킬, 에이전트, 커맨드를 분석하여 병렬화된 Agent Teams 구성을 자동 생성합니다. 스폰 프롬프트·품질 게이트·공유 메모리를 포함한 최적 팀 구성안을 즉시 실행할 수 있습니다.

## 빠른 시작

```bash
# 1. 클론
git clone https://github.com/treylom/tofu-at.git /tmp/tofu-at

# 2. 프로젝트 디렉토리로 이동
cd ~/my-project

# 3. 설치
bash /tmp/tofu-at/install.sh

# 4. Claude Code 실행
claude --model=opus[1m]

# 5. Tofu-AT 실행
# 입력: /tofu-at
```

## 원클릭 설치

```bash
cd ~/my-project
curl -fsSL https://raw.githubusercontent.com/treylom/tofu-at/main/install.sh | bash
```

설치 스크립트가 모든 과정을 자동으로 처리합니다: 필수 요건 확인, 파일 복사, `settings.local.json` 설정, hooks 설치.

## 주요 기능

- **동적 리소스 스캔** — 스킬, 에이전트, MCP 서버, CLI 도구 자동 발견
- **워크플로우 분석** — 병렬화 가능한 에이전트 단위로 자동 분해
- **전문가 도메인 프라이밍** — 27개 도메인, 137명의 전문가 페르소나 내장
- **Ralph Loop** — 반복적 리뷰-피드백-재작업 품질 보장 사이클
- **Devil's Advocate** — 팀 전체 일관성을 위한 교차 리뷰
- **3계층 공유 메모리** — Markdown + SQLite WAL + MCP Memory
- **Agent Office 대시보드** — 실시간 진행 상황 추적 (선택)
- **원클릭 재실행** — 자동 슬래시 커맨드 생성으로 팀 즉시 재실행

## 필수 요구사항

| 항목 | 최소 버전 | 확인 명령어 |
|------|----------|------------|
| Claude Code | v2.1.45+ | `claude --version` |
| Node.js | v18+ | `node --version` |
| tmux | 2.0+ | `tmux -V` |
| git | 2.0+ | `git --version` |

> `install.sh`가 자동으로 확인하고 누락된 의존성 설치를 안내합니다.

## 설치

### 자동 설치 (권장)

`install.sh`가 7단계를 자동 처리합니다:

1. 필수 요건 확인 (Node.js, tmux, git, Claude Code)
2. OS 감지 (WSL, macOS, Linux)
3. 파일 설치 (commands, skills)
4. `.team-os` 인프라 설정 (hooks, artifacts, registry)
5. `settings.local.json` 자동 설정 (env vars, hooks, teammateMode)
6. 설치 검증
7. 다음 단계 안내

```bash
bash install.sh
```

### 수동 설치

직접 설치를 원하는 경우:

```bash
# 1. 커맨드 복사
mkdir -p .claude/commands
cp commands/tofu-at.md .claude/commands/

# 2. 스킬 복사 (flat files + directories)
mkdir -p .claude/skills
cp skills/*.md .claude/skills/ 2>/dev/null || true
cp -r skills/*/ .claude/skills/ 2>/dev/null || true

# 3. .team-os 복사
cp -r .team-os .

# 4. settings.local.json 설정
# .claude/settings.local.json에 아래 내용 추가:
# {
#   "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
#   "teammateMode": "tmux",
#   "hooks": {
#     "TeammateIdle": [{"hooks": [{"type": "command", "command": "node .team-os/hooks/teammate-idle-gate.js"}]}],
#     "TaskCompleted": [{"hooks": [{"type": "command", "command": "node .team-os/hooks/task-completed-gate.js"}]}]
#   }
# }
```

### Claude.ai (.skill ZIP)

[Releases](https://github.com/treylom/tofu-at/releases)에서 `tofu-at.skill` 다운로드 후 Claude.ai에 업로드. 스킬만 포함되며, `.team-os` 인프라는 첫 실행 시 자동 생성됩니다.

## OS별 설치 안내

### WSL (Windows)

- WSL 먼저 설치: PowerShell(관리자)에서 `wsl --install`
- Windows 경로(`/mnt/c/...`) 대신 Linux 파일시스템(`~/project`) 사용 권장 (성능)
- `install.sh`가 WSL을 자동 감지하여 `apt` 사용
- 전체 WSL 설치 가이드: [docs/installation-guide.md](docs/installation-guide.md)

### macOS

- tmux 설치에 Homebrew 필요: `brew install tmux`
- `install.sh`가 macOS를 자동 감지하여 `brew` 사용

### Linux (Debian/Ubuntu)

```bash
sudo apt install -y tmux git
```

### Linux (RHEL/Fedora)

```bash
sudo dnf install -y tmux git
```

## ai / ain 단축 명령어 (선택)

tmux 세션에서 Claude Code를 빠르게 실행하는 쉘 단축키입니다:

```bash
bash setup-bashrc.sh ~/my-project                    # 기본 (auto-push OFF)
bash setup-bashrc.sh ~/my-project --with-auto-push   # 종료 시 git 자동 동기화
bash setup-bashrc.sh ~/my-project --shell=zsh        # zsh 사용자
```

### 명령어 목록

| 명령어 | 설명 |
|--------|------|
| `ai` | tmux 세션 "claude"에서 Claude Code 실행 |
| `ai pass` | `--dangerously-skip-permissions` 옵션으로 실행 |
| `ain [이름]` | 이름 지정 tmux 세션 (tmux 내부면 window) |
| `ain pass [이름]` | 이름 지정 세션 + skip-permissions |
| `cleanup` | 모든 tmux 세션 목록 확인 및 종료 (확인 후) |
| `cleanup <이름>` | 특정 tmux 세션 종료 |
| `ai-sync` | 수동 git 동기화 (add → commit → pull → push) |

### 동작 방식

1. `_ai_setup()` 먼저 실행: 최신 코드 pull, `settings.local.json` 점검
2. Claude Code opus[1m]으로 tmux 세션 생성
3. Claude 종료 시: git 동기화 (--with-auto-push 옵션 사용 시)

## 사용법

### 인터랙티브 모드

```
/tofu-at
```

액션 메뉴 표시: Scan, Inventory, Spawn, Catalog.

### 워크플로우 분석

```
/tofu-at scan .claude/skills/my-workflow.md
```

워크플로우를 분석하여 팀 구성안을 제안하고, 선택 시 팀을 즉시 스폰합니다.

### 리소스 조회

```
/tofu-at inventory
```

사용 가능한 스킬, 에이전트, MCP 서버, CLI 도구 전체 목록을 표시합니다.

### 등록된 팀 즉시 실행

```
/tofu-at spawn km.ingest.web.standard --url https://example.com
```

`registry.yaml`에 등록된 팀을 즉시 생성하고 실행합니다.

### 팀 템플릿 저장

```
/tofu-at catalog my-team-id
```

팀 구성을 `.team-os/registry.yaml`에 저장/갱신합니다.

## 아키텍처

```
/tofu-at 커맨드 (진입점)
    |
    +-- tofu-at-workflow.md      (분석 엔진)
    |     - 리소스 스캔 (MCP, CLI, 스킬)
    |     - 워크플로우 분해
    |     - 에이전트 단위 식별
    |     - 공유 메모리 설계
    |
    +-- tofu-at-registry-schema.md  (YAML 스키마)
    |     - 팀 템플릿 구조
    |     - 검증 규칙
    |     - 30+ team_id 카탈로그
    |
    +-- tofu-at-spawn-templates.md  (스폰 프롬프트)
          - Lead / Category Lead / Worker 템플릿
          - 전문가 도메인 프라이밍 (137명)
          - /prompt 파이프라인 연동
          - CE 최적화 체크리스트

.team-os/                        (런타임 인프라)
    +-- registry.yaml            (팀 정의)
    +-- hooks/                   (품질 게이트 스크립트)
    +-- artifacts/               (공유 메모리 파일)
```

## 팀 역할

| 역할 | 모델 | 목적 |
|------|------|------|
| Lead (Main) | Opus 1M | 오케스트레이션, 파일 쓰기, 최종 결정 |
| Category Lead | Opus / Sonnet | 카테고리 조율, 워커 리뷰 |
| Worker (General) | Sonnet | 구현, 분석 |
| Worker (Explore) | Haiku / Sonnet | 읽기 전용 탐색 및 분석 |
| Devil's Advocate | 설정 가능 | 교차 리뷰 |

## 품질 게이트

- **TeammateIdle Hook** — idle 전 bulletin 업데이트 강제 (3회 위반 시 에스컬레이션)
- **TaskCompleted Hook** — 진행률 추적으로 완료 검증
- **Ralph Loop** — Lead가 워커 결과 리뷰: SHIP 또는 REVISE (최대 10회 반복)
- **Devil's Advocate** — 모든 워커 완료 후 2-Phase 교차 리뷰

## 설치 후 파일 구조

```
your-project/
├── .claude/
│   ├── commands/
│   │   └── tofu-at.md          # /tofu-at 커맨드
│   ├── skills/
│   │   ├── tofu-at-workflow.md
│   │   ├── tofu-at-registry-schema.md
│   │   └── tofu-at-spawn-templates.md
│   └── settings.local.json     # 자동 설정됨
└── .team-os/
    ├── registry.yaml
    ├── hooks/
    │   ├── teammate-idle-gate.js
    │   └── task-completed-gate.js
    └── artifacts/
        ├── TEAM_PLAN.md
        ├── TEAM_BULLETIN.md
        ├── TEAM_FINDINGS.md
        ├── TEAM_PROGRESS.md
        └── MEMORY.md
```

## 문제 해결

### "Agent Teams not available"

`.claude/settings.local.json`에 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`이 있는지 확인:
```bash
cat .claude/settings.local.json | grep AGENT_TEAMS
```
없으면 `bash install.sh`를 다시 실행하세요.

### tmux를 찾을 수 없음

```bash
# WSL/Ubuntu
sudo apt install -y tmux

# macOS
brew install tmux

# RHEL/Fedora
sudo dnf install -y tmux
```

### hooks 오류

```bash
# hooks 존재 확인
ls -la .team-os/hooks/

# 권한 수정
chmod +x .team-os/hooks/*.js

# hooks 재설치
bash install.sh
```

### settings.local.json 충돌

```bash
# JSON 유효성 검사
python3 -c "import json; json.load(open('.claude/settings.local.json'))"

# 백업 후 재설치
cp .claude/settings.local.json .claude/settings.local.json.bak
bash install.sh
```

## 상세 가이드

WSL 초기 설정부터 전체 설치 과정을 담은 한국어 가이드:

**[docs/installation-guide.md](docs/installation-guide.md)**

---

# Tofu-AT (English)

> 🇰🇷 한국어 가이드는 위에 있습니다. [Korean guide is above ↑](#tofu-at-tofu-agent-teams)

Convert workflows into Agent Teams (Split Pane / Swarm) for Claude Code.

---

> ## 💡 Paste the message below into Claude Code for the most accurate installation
>
> ```
> Install from https://github.com/treylom/tofu-at. You can also refer to https://tofu-at.manus.space for help.
> ```

---

**Tofu-AT** analyzes your existing skills, agents, and commands, then generates optimized Agent Teams configurations with spawn prompts, quality gates, and shared memory.

## Quick Start

```bash
# 1. Clone
git clone https://github.com/treylom/tofu-at.git /tmp/tofu-at

# 2. Go to your project
cd ~/my-project

# 3. Install
bash /tmp/tofu-at/install.sh

# 4. Launch Claude Code
claude --model=opus[1m]

# 5. Run tofu-at
# Type: /tofu-at
```

## One-Liner Install

```bash
cd ~/my-project
curl -fsSL https://raw.githubusercontent.com/treylom/tofu-at/main/install.sh | bash
```

The installer handles everything: prerequisite checks, file copying, `settings.local.json` configuration, and hooks setup.

## Features

- **Dynamic Resource Scanning** — Auto-discovers skills, agents, MCP servers, CLI tools
- **Workflow Analysis** — Breaks down workflows into parallelizable agent units
- **Expert Domain Priming** — 27 domains, 137 experts embedded for role-based prompts
- **Ralph Loop** — Iterative review-feedback-rework cycle for quality assurance
- **Devil's Advocate** — Cross-cutting review for team-wide consistency
- **3-Layer Shared Memory** — Markdown + SQLite WAL + MCP Memory
- **Agent Office Dashboard** — Real-time progress tracking (optional)
- **One-Click Re-run** — Auto-generates slash commands for instant team replay

## Requirements

| Requirement | Minimum Version | Check Command |
|-------------|-----------------|---------------|
| Claude Code | v2.1.45+ | `claude --version` |
| Node.js | v18+ | `node --version` |
| tmux | 2.0+ | `tmux -V` |
| git | 2.0+ | `git --version` |

> `install.sh` will check these automatically and offer to install missing dependencies.

## Installation

### Automatic Install (Recommended)

`install.sh` handles all 7 steps automatically:

1. Prerequisites check (Node.js, tmux, git, Claude Code)
2. OS detection (WSL, macOS, Linux)
3. File installation (commands, skills)
4. `.team-os` infrastructure setup (hooks, artifacts, registry)
5. `settings.local.json` auto-configuration (env vars, hooks, teammateMode)
6. Installation verification
7. Summary with next steps

```bash
bash install.sh
```

### Manual Install

If you prefer manual setup:

```bash
# 1. Copy command
mkdir -p .claude/commands
cp commands/tofu-at.md .claude/commands/

# 2. Copy skills
mkdir -p .claude/skills
cp skills/*.md .claude/skills/

# 3. Copy .team-os
cp -r .team-os .

# 4. Configure settings.local.json
# Add to .claude/settings.local.json:
# {
#   "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
#   "teammateMode": "tmux",
#   "hooks": {
#     "TeammateIdle": [{"hooks": [{"type": "command", "command": "node .team-os/hooks/teammate-idle-gate.js"}]}],
#     "TaskCompleted": [{"hooks": [{"type": "command", "command": "node .team-os/hooks/task-completed-gate.js"}]}]
#   }
# }
```

### Claude.ai (.skill ZIP)

Download `tofu-at.skill` from [Releases](https://github.com/treylom/tofu-at/releases) and upload to Claude.ai. Skills only; `.team-os` infra is auto-created on first run.

## OS-Specific Notes

### WSL (Windows)

- Install WSL first: `wsl --install` in PowerShell (Admin)
- Use Linux filesystem (`~/project`), not Windows (`/mnt/c/...`) for performance
- `install.sh` auto-detects WSL and uses `apt`
- For complete WSL setup guide, see [docs/installation-guide.md](docs/installation-guide.md)

### macOS

- Requires Homebrew for tmux: `brew install tmux`
- `install.sh` auto-detects macOS and uses `brew`

### Linux (Debian/Ubuntu)

```bash
sudo apt install -y tmux git
```

### Linux (RHEL/Fedora)

```bash
sudo dnf install -y tmux git
```

## ai / ain Commands (Optional)

Shell shortcuts for launching Claude Code in tmux sessions. Install with:

```bash
bash setup-bashrc.sh ~/my-project                    # default (auto-push OFF)
bash setup-bashrc.sh ~/my-project --with-auto-push   # auto git sync on exit
bash setup-bashrc.sh ~/my-project --shell=zsh        # for zsh users
```

### Command Reference

| Command | Description |
|---------|-------------|
| `ai` | Launch Claude Code in tmux session "claude" |
| `ai pass` | Launch with `--dangerously-skip-permissions` |
| `ain [name]` | Named tmux session (or window if already in tmux) |
| `ain pass [name]` | Named session with skip-permissions |
| `cleanup` | List & kill all tmux sessions (with confirmation) |
| `cleanup <name>` | Kill specific tmux session |
| `ai-sync` | Manual git sync (add → commit → pull → push) |

### How It Works

1. `_ai_setup()` runs first: pulls latest code, fixes `settings.local.json`
2. Creates tmux session with Claude Code opus[1m]
3. On Claude exit: optionally syncs git (if `--with-auto-push`)

## Usage

### Interactive Mode

```
/tofu-at
```

Presents an action menu: Scan, Inventory, Spawn, Catalog.

### Scan a Workflow

```
/tofu-at scan .claude/skills/my-workflow.md
```

Analyzes the workflow, proposes a team composition, and optionally spawns the team.

### View Resources

```
/tofu-at inventory
```

Lists all available skills, agents, MCP servers, and CLI tools.

### Spawn a Registered Team

```
/tofu-at spawn km.ingest.web.standard --url https://example.com
```

Instantly creates and runs a pre-registered team from `registry.yaml`.

### Register a Team Template

```
/tofu-at catalog my-team-id
```

Saves/updates a team configuration in `.team-os/registry.yaml`.

## Architecture

```
/tofu-at command (entry point)
    |
    +-- tofu-at-workflow.md      (analysis engine)
    |     - Resource scanning (MCP, CLI, Skills)
    |     - Workflow decomposition
    |     - Agent unit identification
    |     - Shared memory design
    |
    +-- tofu-at-registry-schema.md  (YAML schema)
    |     - Team template structure
    |     - Validation rules
    |     - 30+ team_id catalog
    |
    +-- tofu-at-spawn-templates.md  (spawn prompts)
          - Lead / Category Lead / Worker templates
          - Expert Domain Priming (137 experts)
          - /prompt pipeline integration
          - CE optimization checklist

.team-os/                        (runtime infrastructure)
    +-- registry.yaml            (team definitions)
    +-- hooks/                   (quality gate scripts)
    +-- artifacts/               (shared memory files)
```

## Team Roles

| Role | Model | Purpose |
|------|-------|---------|
| Lead (Main) | Opus 1M | Orchestration, file writes, final decisions |
| Category Lead | Opus / Sonnet | Category coordination, worker review |
| Worker (General) | Sonnet | Implementation, analysis |
| Worker (Explore) | Haiku / Sonnet | Read-only search and analysis |
| Devil's Advocate | Configurable | Cross-cutting review |

## Quality Gates

- **TeammateIdle Hook** — Enforces bulletin updates before idle (3-strike escalation)
- **TaskCompleted Hook** — Validates completion with progress tracking
- **Ralph Loop** — Lead reviews worker output: SHIP or REVISE (up to 10 iterations)
- **Devil's Advocate** — 2-phase cross-cutting review after all workers complete

## File Structure After Installation

```
your-project/
├── .claude/
│   ├── commands/
│   │   └── tofu-at.md          # /tofu-at command
│   ├── skills/
│   │   ├── tofu-at-workflow.md
│   │   ├── tofu-at-registry-schema.md
│   │   └── tofu-at-spawn-templates.md
│   └── settings.local.json     # auto-configured
└── .team-os/
    ├── registry.yaml
    ├── hooks/
    │   ├── teammate-idle-gate.js
    │   └── task-completed-gate.js
    └── artifacts/
        ├── TEAM_PLAN.md
        ├── TEAM_BULLETIN.md
        ├── TEAM_FINDINGS.md
        ├── TEAM_PROGRESS.md
        └── MEMORY.md
```

## tofu-at-codex v2 (Hybrid Mode)

OpenAI Codex를 **선택적으로** 통합하는 하이브리드 모드. Codex CLI 설치 여부를 자동 감지합니다.

### How It Works (v2)

```
Leader (Opus 4.8)  ──── Anthropic Direct API
                         |
Workers (Sonnet)   ──── Anthropic Direct API
                         |
DA (codex exec)    ──── Codex CLI → GPT-5.6  (adversarial review, optional)
```

Workers는 항상 Anthropic Direct. Codex는 DA(adversarial review) 역할에만 선택적으로 사용됩니다. DA는 팀원이 아니라 Lead가 `codex exec`를 직접 호출하는 방식입니다.

### 2 Modes

| Mode | Workers | DA | Requires |
|------|---------|-----|----------|
| **Standard** | Anthropic | Anthropic (teammate) | tmux only |
| **Codex DA** (recommended) | Anthropic | `codex exec` adversarial | + Codex CLI |

자동 감지: Codex CLI 설치 여부에 따라 사용 가능한 모드만 표시됩니다. Codex 없이도 Standard 모드로 동일한 팀 워크플로우를 사용할 수 있습니다.

### Install (Codex addon, optional)

```bash
npm install -g @openai/codex
codex login
```

Codex 없이 Standard 모드만 사용하려면 추가 설치 불필요.

### Usage

```
/tofu-at-codex
```

환경을 자동 감지하고 사용 가능한 모드를 선택할 수 있습니다.

### Why v2? (Benchmark Results)

autoresearch 실험(동일 태스크 4회 반복)으로 검증:

| Strategy | Score | Duration |
|----------|-------|----------|
| v1 baseline | 6.5 | 63 min |
| **v2 Codex DA (recommended)** | **11.0** | **4.3 min** |

v2 Codex DA 모드는 품질 +69%, 속도 -93%, 의존성 -60%.

## Troubleshooting

### "Agent Teams not available"

Ensure `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is in `.claude/settings.local.json`:
```bash
cat .claude/settings.local.json | grep AGENT_TEAMS
```
If missing, re-run `bash install.sh`.

### tmux not found

```bash
# WSL/Ubuntu
sudo apt install -y tmux

# macOS
brew install tmux

# RHEL/Fedora
sudo dnf install -y tmux
```

### hooks errors

```bash
# Verify hooks exist
ls -la .team-os/hooks/

# Fix permissions
chmod +x .team-os/hooks/*.js

# Re-install hooks
bash install.sh
```

### settings.local.json conflicts

```bash
# Validate JSON
python3 -c "import json; json.load(open('.claude/settings.local.json'))"

# Backup and re-install
cp .claude/settings.local.json .claude/settings.local.json.bak
bash install.sh
```

## Detailed Guide

For a step-by-step visual guide (Korean), including WSL setup from scratch:

**[docs/installation-guide.md](docs/installation-guide.md)**

## License

MIT
