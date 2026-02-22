# Tofu-AT (Tofu Agent Teams)

> 🇰🇷 한국어 설명입니다. [English guide is below ↓](#tofu-at-english)

워크플로우를 Claude Code의 Agent Teams (Split Pane / Swarm)로 자동 변환하는 오케스트레이션 프레임워크.

> 💡 Claude Code에 아래 메시지를 그대로 전달하면 가장 정확하게 설치됩니다:
> ```
> https://github.com/treylom/tofu-at 설치해줘.
> ```

---

**Tofu-AT**는 기존 스킬, 에이전트, 커맨드를 분석하여 병렬화된 Agent Teams 구성을 자동 생성합니다. 스폰 프롬프트·품질 게이트·공유 메모리를 포함한 최적 팀 구성안을 즉시 실행할 수 있습니다.

### 주요 기능

- **동적 리소스 스캔** - 스킬, 에이전트, MCP 서버, CLI 도구 자동 발견
- **워크플로우 분석** - 병렬화 가능한 에이전트 단위로 자동 분해
- **전문가 도메인 프라이밍** - 27개 도메인, 137명의 전문가 페르소나
- **Ralph Loop** - 반복적 리뷰-피드백-재작업 품질 보장 사이클
- **Devil's Advocate** - 팀 전체 일관성을 위한 교차 리뷰
- **3계층 공유 메모리** - Markdown + SQLite WAL + MCP Memory
- **Agent Office 대시보드** - 실시간 진행 상황 추적 (선택)
- **원클릭 재실행** - 자동 슬래시 커맨드 생성으로 팀 즉시 재실행

### 필수 요구사항

| 항목 | 요구사항 | 설치 방법 |
|------|---------|----------|
| Claude Code | v2.1.45+ | [공식 문서](https://docs.anthropic.com/ko/docs/claude-code) |
| tmux | Split Pane 필수 | `sudo apt install tmux` (Linux/WSL) / `brew install tmux` (macOS) |
| Agent Teams | 실험적 기능 활성화 | 아래 설정 참조 |
| Node.js | v18+ (선택) | https://nodejs.org |

### 설치

#### 방법 1: Claude Code에게 요청 (권장)

아래 메시지를 Claude Code에 그대로 붙여넣으세요:

```
https://github.com/treylom/tofu-at 설치해줘.
```

#### 방법 2: install.sh 스크립트

```bash
curl -fsSL https://raw.githubusercontent.com/treylom/tofu-at/main/install.sh | bash
```

또는 클론 후 실행:

```bash
git clone https://github.com/treylom/tofu-at.git /tmp/tofu-at
cd /tmp/tofu-at && bash install.sh
```

#### 방법 3: .skill ZIP (Claude.ai)

[Releases](https://github.com/treylom/tofu-at/releases)에서 `tofu-at.skill` 다운로드 후 Claude.ai에 업로드.

### Agent Teams 활성화

`.claude/settings.local.json`에 추가:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

또는 자동 설정:

```
/tofu-at setup
```

### 사용 명령어

| 명령어 | 설명 |
|--------|------|
| `/tofu-at` | 인터랙티브 메뉴 |
| `/tofu-at scan <경로>` | 워크플로우 분석 → 팀 구성안 생성 |
| `/tofu-at inventory` | 사용 가능한 리소스 전체 조회 |
| `/tofu-at spawn <team_id>` | 등록된 팀 즉시 실행 |
| `/tofu-at setup` | 환경 검증 + 필수 설정 자동 구성 |
| `/tofu-at catalog <team_id>` | 팀 템플릿 저장/갱신 |
| `/tofu-at-codex` | GPT-Codex 하이브리드 팀 (Opus + Codex) |

---

# tofu-at (English) {#tofu-at-english}

Convert workflows into Agent Teams (Split Pane / Swarm) for Claude Code.

**tofu-at** analyzes your existing skills, agents, and commands, then generates optimized Agent Teams configurations with spawn prompts, quality gates, and shared memory.

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
