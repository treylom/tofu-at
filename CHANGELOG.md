# Changelog

## [2.2.0] - 2026-02-22

### Changed
- **Project renamed**: `teamify` → `Tofu-AT` (Tofu-Agent Teams)
- Command: `/teamify` → `/tofu-at`
- Command: `/teamify_codex` → `/tofu-at-codex`
- Skills: `teamify-*.md` → `tofu-at-*.md`
- GitHub repo: `treylom/teamify` → `treylom/tofu-at`
- All internal references updated

## [2.1.1] - 2026-02-19

### Added
- **Prerequisite Context Loading** in `/tofu-at scan` (Step 2-1.5)
  - Auto-reads CHANGELOG.md, BUGS.md from target file's directory
  - Auto-reads matching Bug_Reports/ by component name (max 3 files)
  - Scoped search only (no full-codebase scan)
  - ~800 token budget for all prerequisite context
- **Known Context injection** in spawn prompts (Step 5-5)
  - Lead gets full prerequisites (recent changes, known issues, risk notes)
  - Workers get only issues relevant to their assigned area
  - Devil's Advocate gets "known bug regression" check criterion
- `prerequisites` field in STEP 3 team composition output

## [2.1.0] - 2026-02-19

### Added
- **`setup-bashrc.sh`** — Shell function installer for ai/ain/cleanup/ai-sync commands
  - Supports bash and zsh (`--shell=zsh`)
  - Idempotent: marker-based duplicate prevention (`# >>> tofu-at >>>`)
  - `--with-auto-push` flag for optional auto git sync on Claude exit
  - Project path parameterized (no hardcoding)
- **`docs/installation-guide.md`** — Step-by-step Korean installation guide for Notion
  - Covers WSL setup from scratch (Part 0)
  - Visual guide with screenshot references
  - FAQ/troubleshooting section
- **`docs/screenshots/`** — Directory for installation guide screenshots

### Changed
- **`install.sh`** — Major rewrite (63 → ~300 lines)
  - OS auto-detection (WSL, macOS, Linux Debian/RHEL)
  - Interactive prerequisite check with auto-install offers (tmux)
  - `settings.local.json` auto-configuration (env, teammateMode, hooks)
  - JSON merge via Python3 with Node.js fallback
  - Colored output with step counter ([1/7] format)
  - Bilingual messages (English + Korean)
  - Installation verification phase (file existence + JSON validity)
  - Completion summary with environment info
- **`README.md`** — Full rewrite
  - Quick Start (3-line copy-paste)
  - One-liner install command
  - OS-specific setup notes (WSL, macOS, Linux)
  - ai/ain command documentation
  - Troubleshooting/FAQ section
  - Link to detailed Korean guide

## [2.0.0] - 2026-02-19

### Initial Release

- `/tofu-at` command with 6 modes: interactive, scan, inventory, spawn, catalog, clone
- 3 skill files: workflow engine, registry schema, spawn templates
- `.team-os` infrastructure: registry, hooks, artifacts
- Dynamic resource scanning (MCP, CLI, Skills, Agents)
- Ralph Loop (iterative review-feedback-rework)
- Devil's Advocate (cross-cutting review)
- 3-layer shared memory (Markdown + SQLite WAL + MCP Memory)
- Expert Domain Priming (27 domains, 137 experts)
- /prompt pipeline integration for spawn prompts
- Agent Office dashboard integration
- One-click re-run command generation (STEP 9)
- Cross-platform support (WSL, macOS, Linux)
- install.sh for easy installation
- .skill ZIP build for Claude.ai upload
