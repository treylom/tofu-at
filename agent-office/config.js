const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Detect project root using a reliable priority chain.
 * Works across: macOS, Linux, WSL (symlinks), Docker, npm global installs.
 *
 * Priority:
 *   1. AGENT_OFFICE_ROOT env var (explicit, always correct)
 *   2. CWD walk-up (most reliable — server started from project root)
 *   3. __dirname → realpathSync → walk-up (resolves symlinks first)
 *   4. HOME fallback (Docker/CI where .claude lives in HOME only)
 */
function detectProjectRoot() {
  // 1. Explicit override — teamify always sets this on spawn
  if (process.env.AGENT_OFFICE_ROOT) {
    const root = process.env.AGENT_OFFICE_ROOT;
    if (fs.existsSync(path.join(root, '.claude'))) return root;
  }

  // 2. Walk up from CWD (most reliable cross-platform)
  let current = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 3. Resolve symlinks on __dirname, then walk up
  //    Handles: WSL symlinks, node_modules installs, etc.
  let realDir;
  try { realDir = fs.realpathSync(__dirname); } catch { realDir = __dirname; }
  current = realDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(current, '.claude'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 4. HOME fallback (Docker/CI — .claude only in HOME)
  if (process.env.HOME && fs.existsSync(path.join(process.env.HOME, '.claude'))) {
    return process.env.HOME;
  }

  // 5. Last resort
  return path.resolve(__dirname, '..');
}

function isWSL() {
  if (process.platform !== 'linux') return false;
  try {
    return /microsoft/i.test(os.release());
  } catch {
    return false;
  }
}

const PROJECT_ROOT = detectProjectRoot();
const CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');

/**
 * CLAUDE_HOME: HOME-based .claude directory.
 * In WSL, Claude Code creates teams in $HOME/.claude/teams/ which may differ
 * from PROJECT_ROOT/.claude/ when the project is on a Windows mount (/mnt/c/...).
 * This ensures team discovery always checks the correct HOME path.
 */
const HOME_CLAUDE = process.env.HOME ? path.join(process.env.HOME, '.claude') : null;
const CLAUDE_HOME = (HOME_CLAUDE && fs.existsSync(HOME_CLAUDE)) ? HOME_CLAUDE : CLAUDE_DIR;

/**
 * Detect WSL distro HOME paths accessible from Windows via \\wsl$\ UNC paths.
 * Called once at startup. Returns array of { distro, wslHome, winPath }.
 */
function getWSLHomes() {
  if (process.platform !== 'win32') return [];
  try {
    const { execSync } = require('child_process');
    // wsl --list outputs UTF-16LE with null bytes between chars — read as buffer then clean
    const buf = execSync('wsl --list --quiet', { timeout: 5000 });
    const raw = buf.toString('utf16le').replace(/\r/g, '');
    const distros = raw.split('\n').map(s => s.trim()).filter(s => s.length > 0 && !/^\s*$/.test(s));
    return distros.map(d => {
      try {
        const home = execSync(`wsl -d ${d} -- bash -c "echo $HOME"`, { encoding: 'utf-8', timeout: 5000 }).trim();
        // Build UNC path: \\wsl$\{distro}\{home path components}
        const homeParts = home.split('/').filter(Boolean); // ['home', 'tofu']
        const winPath = path.join('\\\\wsl$', d, ...homeParts);
        return { distro: d, wslHome: home, winPath };
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

const WSL_HOMES = getWSLHomes();

// Startup diagnostic (only when DEBUG or first run)
if (process.env.AGENT_OFFICE_DEBUG) {
  console.log('[config] PROJECT_ROOT:', PROJECT_ROOT);
  console.log('[config] CLAUDE_DIR:', CLAUDE_DIR);
  console.log('[config] CLAUDE_HOME:', CLAUDE_HOME);
  console.log('[config] isWSL:', isWSL());
  console.log('[config] WSL_HOMES:', WSL_HOMES.length);
}

module.exports = {
  PROJECT_ROOT,
  CLAUDE_DIR,
  CLAUDE_HOME,
  TEAM_OS_DIR: path.join(PROJECT_ROOT, '.team-os'),
  MCP_CONFIG: path.join(PROJECT_ROOT, '.mcp.json'),
  SETTINGS_FILE: path.join(PROJECT_ROOT, '.claude', 'settings.local.json'),
  PORT: parseInt(process.env.AGENT_OFFICE_PORT || '3747', 10),
  isWSL,
  getWSLHomes,
  WSL_HOMES,
  WINDOWS_HOME: process.env.USERPROFILE || '',
};
