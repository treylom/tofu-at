# teamify

Convert workflows into Agent Teams (Split Pane / Swarm) for Claude Code.

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
- Agent Teams enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Recommended: `claude --model=opus[1m]` for 1M context

## Installation

### Method 1: GitHub Link (Recommended)

Share this repo link with Claude Code:

```
Install teamify from https://github.com/treylom/teamify
```

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

## File Structure After Installation

```
your-project/
├── .claude/
│   ├── commands/
│   │   └── teamify.md          # /teamify command
│   └── skills/
│       ├── teamify-workflow.md
│       ├── teamify-registry-schema.md
│       └── teamify-spawn-templates.md
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
