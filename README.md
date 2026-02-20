# teamify

<!-- 한국어 설명이 아래에 있습니다 · Korean description below (after English) -->

워크플로우를 Claude Code의 Agent Teams (Split Pane / Swarm)로 자동 변환하는 오케스트레이션 프레임워크.

> 💡 Claude Code에 아래 메시지를 그대로 전달하면 가장 정확하게 설치됩니다:
> ```
> https://github.com/treylom/teamify 설치해줘. https://teamify-docs-jviqkn6x.manus.space/ 를 참고하면 더 도움이 될거야.
> ```

---

**teamify**는 기존 스킬, 에이전트, 커맨드를 분석하여 병렬화된 Agent Teams 구성을 자동 생성합니다. 스폰 프롬프트·품질 게이트·공유 메모리를 포함한 최적 팀 구성안을 즉시 실행할 수 있습니다.

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
https://github.com/treylom/teamify 설치해줘. https://teamify-docs-jviqkn6x.manus.space/ 를 참고하면 더 도움이 될거야.
```

> GitHub URL과 설치 가이드 URL을 함께 제공하는 것이 가장 정확한 설치 방법입니다.

#### 방법 2: install.sh 스크립트

```bash
curl -fsSL https://raw.githubusercontent.com/treylom/teamify/main/install.sh | bash
```

또는 클론 후 실행:

```bash
git clone https://github.com/treylom/teamify.git /tmp/teamify
cd /tmp/teamify && bash install.sh
```

#### 방법 3: .skill ZIP (Claude.ai)

[Releases](https://github.com/treylom/teamify/releases)에서 `teamify.skill` 다운로드 후 Claude.ai에 업로드.

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
/teamify setup
```

### 사용 명령어

| 명령어 | 설명 |
|--------|------|
| `/teamify` | 인터랙티브 메뉴 |
| `/teamify scan <경로>` | 워크플로우 분석 → 팀 구성안 생성 |
| `/teamify inventory` | 사용 가능한 리소스 전체 조회 |
| `/teamify spawn <team_id>` | 등록된 팀 즉시 실행 |
| `/teamify setup` | 환경 검증 + 필수 설정 자동 구성 |
| `/teamify catalog <team_id>` | 팀 템플릿 저장/갱신 |
| `/teamify_codex` | GPT-Codex 하이브리드 팀 (Opus + Codex) |

---

# teamify (English)

Convert workflows into Agent Teams (Split Pane / Swarm) for Claude Code.

> 💡 Paste this into Claude Code for the most accurate installation:
> ```
> Install https://github.com/treylom/teamify. https://teamify-docs-jviqkn6x.manus.space/ will help as a reference.
> ```

**teamify** analyzes your existing skills, agents, and commands, then generates optimized Agent Teams configurations with spawn prompts, quality gates, and shared memory.

## Features

- **Dynamic Resource Scanning** - Auto-discovers skills, agents, MCP servers, CLI tools
- **Workflow Analysis** - Breaks down workflows into parallelizable agent units
- **Expert Domain Priming** - 27 domains, 137 experts embedded for role-based prompts
- **Ralph Loop** - Iterative review-feedback-rework cycle for quality assurance
- **Devil's Advocate** - Cross-cutting review for team-wide consistency
- **3-Layer Shared Memory** - Markdown + SQLite WAL + MCP Memory
- **Agent Office Dashboard** - Real-time progress tracking (optional)
- **One-Click Re-run** - Auto-generates slash commands for instant team replay

## Requirements

- **Claude Code** v2.1.45+
- **tmux** (for Split Pane mode)
- Agent Teams enabled (see Setup below)
- Recommended: `claude --model=opus[1m]` for 1M context

## Installation

### Method 1: Ask Claude Code (Recommended)

Paste this message directly into Claude Code:

```
Install https://github.com/treylom/teamify. https://teamify-docs-jviqkn6x.manus.space/ will help as a reference.
```

> Providing both the GitHub URL and the install guide URL together gives Claude Code the most accurate context for installation.

### Method 2: install.sh

```bash
curl -fsSL https://raw.githubusercontent.com/treylom/teamify/main/install.sh | bash
```

Or clone and run:

```bash
git clone https://github.com/treylom/teamify.git /tmp/teamify
cd /tmp/teamify && bash install.sh
```

### Method 3: .skill ZIP (Claude.ai)

Download `teamify.skill` from [Releases](https://github.com/treylom/teamify/releases) and upload to Claude.ai. Skills only; `.team-os` infra is auto-created on first run.

## Setup

Enable Agent Teams in `.claude/settings.local.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

Or run the automated setup command:

```
/teamify setup
```

This verifies environment requirements and auto-configures settings (Agent Teams env var, tmux mode, hooks).

## Usage

### Interactive Mode

```
/teamify
```

Presents an action menu: Scan, Inventory, Spawn, Catalog.

### Scan a Workflow

```
/teamify scan .claude/skills/my-workflow.md
```

Analyzes the workflow, proposes a team composition, and optionally spawns the team.

### View Resources

```
/teamify inventory
```

Lists all available skills, agents, MCP servers, and CLI tools.

### Spawn a Registered Team

```
/teamify spawn km.ingest.web.standard --url https://example.com
```

Instantly creates and runs a pre-registered team from `registry.yaml`.

### Register a Team Template

```
/teamify catalog my-team-id
```

Saves/updates a team configuration in `.team-os/registry.yaml`.

### Auto-Setup Environment

```
/teamify setup
```

Verifies and configures your environment for first-time use.

### Codex Hybrid Mode

```
/teamify_codex
```

Runs a hybrid team where the Lead uses Claude Opus and teammates use GPT-Codex via CLIProxyAPI.

## Architecture

```
/teamify command (entry point)
    |
    +-- teamify-workflow.md      (analysis engine)
    |     - Resource scanning (MCP, CLI, Skills)
    |     - Workflow decomposition
    |     - Agent unit identification
    |     - Shared memory design
    |
    +-- teamify-registry-schema.md  (YAML schema)
    |     - Team template structure
    |     - Validation rules
    |     - 30+ team_id catalog
    |
    +-- teamify-spawn-templates.md  (spawn prompts)
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

- **TeammateIdle Hook** - Enforces bulletin updates before idle (3-strike escalation)
- **TaskCompleted Hook** - Validates completion with progress tracking
- **Ralph Loop** - Lead reviews worker output: SHIP or REVISE (up to 10 iterations)
- **Devil's Advocate** - 2-phase cross-cutting review after all workers complete

## Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| WSL (Ubuntu) | ✅ Best | Most stable |
| macOS | ✅ Full | `brew install tmux` |
| Linux | ✅ Full | `apt install tmux` |
| Windows native | ⚠️ Limited | WSL strongly recommended |

## File Structure After Installation

```
your-project/
├── .claude/
│   ├── commands/
│   │   ├── teamify.md          # /teamify command
│   │   └── teamify_codex.md    # /teamify_codex (Codex hybrid mode)
│   ├── skills/
│   │   ├── teamify-workflow.md
│   │   ├── teamify-registry-schema.md
│   │   └── teamify-spawn-templates.md
│   └── scripts/
│       └── setup-teamify-codex.sh
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

## License

MIT
