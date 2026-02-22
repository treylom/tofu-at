# tofu-at

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
