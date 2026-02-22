const fs = require('fs');
const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const { PROJECT_ROOT, CLAUDE_DIR, CLAUDE_HOME, TEAM_OS_DIR, MCP_CONFIG, SETTINGS_FILE, PORT, isWSL } = require('./config');
const { getAgents, getSkills, getCommands } = require('./lib/scanner');
const { getTeamOSStatus, getKMWorkflow, clearArtifacts } = require('./lib/team-os-parser');
const { discoverTeamsCached, getTeamDetail, getTeamHomes, invalidateCache } = require('./lib/team-discovery');
const { getMCPServers, getSettings } = require('./lib/settings-parser');
const { bootstrapTeamOS } = require('./lib/team-os-bootstrap');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- SSE ---
const clients = new Set();

app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

function broadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`;
  for (const client of clients) {
    try { client.write(msg); }
    catch { clients.delete(client); }
  }
}

// --- Session suppress flag ---
// When user clicks Clear, suppress native team data until a new team change is detected
let _nativeSuppressed = false;

// --- API ---
function mergeProgressOverlay(km) {
  if (!km?.progress?.agents || Object.keys(_progressOverlay).length === 0) return km;
  const now = Date.now();
  for (const agent of km.progress.agents) {
    const cleanName = (agent.agent || '').replace(/^@/, '');
    const overlay = _progressOverlay[cleanName] || _progressOverlay[`@${cleanName}`];
    if (overlay && (now - overlay.ts) < 600000) { // 10-minute TTL
      // Overlay always wins (explicit API push is authoritative over inferred data)
      agent.progress = overlay.progress;
      if (overlay.task) agent.task = overlay.task;
      if (overlay.note) agent.note = overlay.note;
      agent.updated = new Date(overlay.ts).toISOString();
    }
  }
  return km;
}

function getFullStatus() {
  return {
    project: PROJECT_ROOT,
    agents: getAgents(),
    skills: getSkills(),
    commands: getCommands(),
    mcpServers: getMCPServers(),
    teamOS: getTeamOSStatus(),
    kmWorkflow: mergeProgressOverlay(getKMWorkflow({ suppressNative: _nativeSuppressed })),
    settings: getSettings(),
    timestamp: new Date().toISOString(),
  };
}

app.get('/api/status', (_req, res) => res.json(getFullStatus()));
app.get('/api/agents', (_req, res) => res.json(getAgents()));
app.get('/api/skills', (_req, res) => res.json(getSkills()));
app.get('/api/commands', (_req, res) => res.json(getCommands()));
app.get('/api/mcp', (_req, res) => res.json(getMCPServers()));
app.get('/api/team-os', (_req, res) => res.json(getTeamOSStatus()));
app.get('/api/km-workflow', (_req, res) => {
  res.json(mergeProgressOverlay(getKMWorkflow({ suppressNative: _nativeSuppressed })));
});

// --- Native Team APIs ---
app.get('/api/teams/discover', (_req, res) => {
  const teams = discoverTeamsCached();
  res.json(teams.map(t => ({
    name: t.name, platform: t.platform, distro: t.distro,
    memberCount: t.memberCount, hasInboxes: t.hasInboxes,
    description: t.config?.description || '',
    mtime: new Date(t.mtime).toISOString(),
  })));
});

app.get('/api/teams/:name/live', (req, res) => {
  const detail = getTeamDetail(req.params.name);
  if (!detail) return res.status(404).json({ error: 'Team not found' });
  // Strip large config data, return summary
  const { config, inboxes, tasks, ...meta } = detail;
  const members = (config?.members || []).map(m => ({
    name: m.name, agentType: m.agentType, model: m.model,
    isActive: m.isActive, backendType: m.backendType || '',
    tmuxPaneId: m.tmuxPaneId || '',
  }));
  const inboxSummary = {};
  for (const [name, msgs] of Object.entries(inboxes || {})) {
    inboxSummary[name] = { count: msgs.length, lastTimestamp: msgs.length > 0 ? msgs[msgs.length - 1].timestamp : null };
  }
  res.json({ ...meta, members, inboxSummary, taskCount: (tasks || []).length });
});
app.get('/api/settings', (_req, res) => res.json(getSettings()));

app.post('/api/team-os/bootstrap', (req, res) => {
  try {
    const repair = req.query.repair === 'true';
    const report = bootstrapTeamOS(PROJECT_ROOT, { repair });
    broadcast('team_os_updated', { event: 'bootstrap', file: 'team-os' });
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/session/clear', (_req, res) => {
  try {
    const cleared = clearArtifacts();
    _progressOverlay = {}; // Clear progress overlay on session clear
    _nativeSuppressed = true; // Suppress native data until new team activity
    invalidateCache();
    broadcast('team_os_updated', { event: 'session_clear', file: 'artifacts' });
    res.json({ success: true, cleared, nativeSuppressed: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Real-time Progress API (overlay) ---
let _progressOverlay = {};

app.post('/api/progress', (req, res) => {
  const { agent, progress, task, note } = req.body;
  if (!agent) return res.status(400).json({ error: 'agent required' });

  _progressOverlay[agent] = {
    agent,
    progress: parseInt(progress) || 0,
    task: task || '',
    note: note || '',
    ts: Date.now(),
  };
  broadcast('progress_push', _progressOverlay[agent]);

  // Auto-expire after 10 minutes
  setTimeout(() => { delete _progressOverlay[agent]; }, 600000);

  res.json({ success: true });
});

app.get('/api/progress/overlay', (_req, res) => {
  res.json(_progressOverlay);
});

// Batch: set all agents to Done (100%)
app.post('/api/progress/done', (_req, res) => {
  for (const key of Object.keys(_progressOverlay)) {
    _progressOverlay[key].progress = 100;
    _progressOverlay[key].task = 'completed';
    _progressOverlay[key].note = 'all done';
    _progressOverlay[key].ts = Date.now();
  }
  broadcast('progress_push', { batch: true, allDone: true });
  res.json({ success: true, count: Object.keys(_progressOverlay).length });
});

// --- Browser Recovery API ---
app.post('/api/open-browser', (_req, res) => {
  const { exec } = require('child_process');
  const url = `http://localhost:${PORT}`;

  function tryOpen(cmds, i) {
    if (i >= cmds.length) return;
    exec(cmds[i], { timeout: 5000 }, (err) => { if (err) tryOpen(cmds, i + 1); });
  }

  const cmds = process.platform === 'win32'
    ? [`start "" "${url}"`]
    : process.platform === 'darwin'
    ? [`open "${url}"`]
    : isWSL()
    ? [`cmd.exe /c start "${url}"`, `explorer.exe "${url}"`, `wslview "${url}"`, `xdg-open "${url}"`]
    : [`xdg-open "${url}"`, `wslview "${url}"`];

  tryOpen(cmds, 0);
  res.json({ success: true, url });
});

// --- Artifacts API ---
const ARTIFACTS_DIR = path.join(TEAM_OS_DIR, 'artifacts');
const ALLOWED_ARTIFACTS = [
  'TEAM_PLAN.md', 'TEAM_BULLETIN.md', 'TEAM_FINDINGS.md',
  'TEAM_PROGRESS.md', 'MEMORY.md',
  'team_plan.md', 'team_bulletin.md', 'team_findings.md',
  'team_progress.md',
  'agents_memory.md',
];

function isAllowedArtifact(filename) {
  return ALLOWED_ARTIFACTS.includes(filename);
}

app.get('/api/artifacts', (_req, res) => {
  try {
    if (!fs.existsSync(ARTIFACTS_DIR)) return res.json([]);
    const files = fs.readdirSync(ARTIFACTS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(ARTIFACTS_DIR, f));
        return { name: f, size: stat.size, lastModified: stat.mtime.toISOString() };
      });
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/artifacts/:filename', (req, res) => {
  const { filename } = req.params;
  if (!isAllowedArtifact(filename)) return res.status(403).json({ error: 'Not allowed' });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);
    res.json({ filename, content, lastModified: stat.mtime.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/artifacts/:filename', (req, res) => {
  const { filename } = req.params;
  if (!isAllowedArtifact(filename)) return res.status(403).json({ error: 'Not allowed' });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  try {
    if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    fs.writeFileSync(filePath, req.body.content || '', 'utf-8');
    broadcast('team_os_updated', { event: 'change', file: filename });
    res.json({ success: true, filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Reports API (Results Tab) ---
const REPORTS_DIR = path.join(TEAM_OS_DIR, 'reports');

app.get('/api/reports', (_req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) return res.json([]);
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(REPORTS_DIR, f);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return {
            id: f.replace('.json', ''),
            filename: f,
            timestamp: data.timestamp || null,
            teamName: data.teamName || '',
            subject: data.subject || '',
            complexity: data.complexity || '',
            duration: data.duration || '',
            sourceCommand: data.sourceCommand || '',
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/reports/:id', (req, res) => {
  try {
    const filePath = path.join(REPORTS_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Report not found' });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reports', (req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const report = req.body;
    // Ensure valid ISO 8601 UTC timestamp
    if (!report.timestamp || isNaN(new Date(report.timestamp).getTime())) {
      report.timestamp = new Date().toISOString();
    }
    const id = report.id || `${new Date().toISOString().replace(/[:.]/g, '-')}-${(report.teamName || 'unknown').slice(0, 40)}`;
    report.id = id;
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Metrics API ---
app.get('/api/metrics', (_req, res) => {
  try {
    const memoryPath = path.join(ARTIFACTS_DIR, 'MEMORY.md');
    if (!fs.existsSync(memoryPath)) return res.json({ agents: [], totalSessions: 0 });
    const content = fs.readFileSync(memoryPath, 'utf-8');
    const sections = content.split(/^## /m).filter(Boolean);
    const agentMap = {};
    for (const section of sections) {
      const agentMatches = section.match(/@([\w-]+)/g) || [];
      for (const match of agentMatches) {
        const name = match.slice(1);
        if (!agentMap[name]) agentMap[name] = { name, taskCount: 0 };
        agentMap[name].taskCount++;
      }
    }
    res.json({ agents: Object.values(agentMap), totalSessions: sections.length });
  } catch (e) {
    res.json({ agents: [], totalSessions: 0 });
  }
});

// --- Global error middleware (must be after all routes, before listen) ---
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: err.message });
});

// --- File watcher (cross-platform) ---
let debounceTimer = null;
const TEAM_ROOT_GLOB = path.join(PROJECT_ROOT, 'TEAM_*.md');

// CLAUDE_DIR already covers PROJECT_ROOT/.claude/ with depth:3
// On Windows, WSL UNC paths cannot be watched — WSL team data fetched on-demand via 2s cache TTL
const allWatchPaths = [CLAUDE_DIR, TEAM_OS_DIR, MCP_CONFIG, SETTINGS_FILE, TEAM_ROOT_GLOB];

// Watch CLAUDE_HOME teams/ and tasks/ for native team changes.
// Critical when CLAUDE_HOME !== CLAUDE_DIR (common in WSL, Docker, global installs).
// Claude Code always creates teams in $HOME/.claude/teams/, so we must watch there.
if (CLAUDE_HOME !== CLAUDE_DIR) {
  for (const sub of ['teams', 'tasks']) {
    const p = path.join(CLAUDE_HOME, sub);
    try {
      if (fs.existsSync(p) && !allWatchPaths.some(w => p.startsWith(String(w)))) {
        allWatchPaths.push(p);
      }
    } catch { /* skip if inaccessible */ }
  }
}

const watcher = chokidar.watch(allWatchPaths, { ignoreInitial: true, depth: 3 });

watcher.on('error', (err) => {
  // Silently handle watch errors (e.g. UNC paths, permission issues)
  if (err.code !== 'EISDIR' && err.code !== 'EPERM') {
    console.error('  Watcher error:', err.message);
  }
});

watcher.on('all', (event, filePath) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Invalidate team cache on any teams/ change
    if (filePath.includes(path.join('.claude', 'teams')) || filePath.includes('inboxes')) {
      invalidateCache();
      // New team activity detected — unsuppress native data
      if (_nativeSuppressed && (event === 'add' || event === 'change')) {
        _nativeSuppressed = false;
      }
    }

    // Detect team deletion (config.json removed = team deleted)
    if (event === 'unlink' && filePath.endsWith('config.json') && filePath.includes('teams')) {
      invalidateCache();
      // Auto-clear stale artifacts when last team is deleted
      const remaining = discoverTeamsCached();
      if (remaining.length === 0) {
        try { clearArtifacts(); } catch { /* ignore */ }
      }
    }

    let type = 'unknown';
    if (filePath.includes('agents')) type = 'agents';
    else if (filePath.includes('skills')) type = 'skills';
    else if (filePath.includes('commands')) type = 'commands';
    else if (filePath.includes('reports')) type = 'reports';
    else if (filePath.includes('.team-os') || /TEAM_\w+\.md$/.test(filePath)) type = 'team_os';
    else if (filePath.includes(path.join('.claude', 'teams')) || filePath.includes('inboxes')) type = 'team_os';
    else if (filePath.includes('.mcp.json')) type = 'mcp';
    else if (filePath.includes('settings')) type = 'settings';
    broadcast(`${type}_updated`, { event, file: path.basename(filePath) });
  }, 200);
});

// --- Start ---
const server = app.listen(PORT, () => {
  console.log(`\n  Agent Office Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Project: ${PROJECT_ROOT}`);
  console.log(`  Watching: .claude/, .team-os/, .mcp.json\n`);

  // SSE heartbeat every 30s — cleans up dead connections
  setInterval(() => {
    for (const client of clients) {
      try { client.write(':keepalive\n\n'); }
      catch { clients.delete(client); }
    }
  }, 30000);

  // 20-second periodic refresh broadcast (supplements file-watcher SSE)
  setInterval(() => {
    if (clients.size > 0) broadcast('periodic_refresh', { reason: 'scheduled' });
  }, 20000);

  if (process.argv.includes('--open')) {
    const { exec } = require('child_process');
    const url = `http://localhost:${PORT}`;

    function tryOpen(cmds, i) {
      if (i >= cmds.length) { console.log(`  Open ${url} in your browser manually.`); return; }
      exec(cmds[i], { timeout: 5000 }, (err) => { if (err) tryOpen(cmds, i + 1); });
    }

    const cmds = process.platform === 'win32'
      ? [`start "" "${url}"`]
      : process.platform === 'darwin'
      ? [`open "${url}"`]
      : isWSL()
      ? [`cmd.exe /c start "${url}"`, `explorer.exe "${url}"`, `wslview "${url}"`, `xdg-open "${url}"`]
      : [`xdg-open "${url}"`];

    tryOpen(cmds, 0);
  }
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Error: Port ${PORT} already in use.`);
    console.error(`  Set AGENT_OFFICE_PORT env var to use a different port.\n`);
  } else {
    console.error(`\n  Server error: ${err.message}\n`);
  }
  process.exit(1);
});
