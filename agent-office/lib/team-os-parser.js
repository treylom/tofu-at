const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { TEAM_OS_DIR, PROJECT_ROOT } = require('../config');
const { formatModelName } = require('./data-synthesizer');

const artifactsDir = path.join(TEAM_OS_DIR, 'artifacts');

// Resolve artifact file path with fallback to project root
// Supports both .team-os/artifacts/TEAM_*.md and project root TEAM_*.md
function resolveArtifactPath(filename) {
  const primary = path.join(artifactsDir, filename);
  if (fs.existsSync(primary)) return primary;
  const fallback = path.join(PROJECT_ROOT, filename);
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

function getTeamOSStatus() {
  const registryPath = path.join(TEAM_OS_DIR, 'registry.yaml');
  const spawnDir = path.join(TEAM_OS_DIR, 'spawn-prompts');
  const hooksDir = path.join(TEAM_OS_DIR, 'hooks');

  const exists = fs.existsSync(registryPath);
  const spawnPrompts = safeReadDir(spawnDir, '.md');
  const artifacts = safeReadDir(artifactsDir, '.md');
  const hooks = safeReadDir(hooksDir, '.js');

  let status = 'inactive';
  if (exists && spawnPrompts.length >= 3) status = 'active';
  else if (exists) status = 'partial';

  let registry = null;
  if (exists) {
    try {
      registry = yaml.load(fs.readFileSync(registryPath, 'utf-8'));
    } catch { /* ignore parse errors */ }
  }

  return {
    status,
    registry: exists,
    spawnPrompts: spawnPrompts.map(f => f.replace('.md', '')),
    artifacts: artifacts.map(f => f.replace('.md', '')),
    hooks: hooks.map(f => f.replace('.js', '')),
    teams: registry?.teams ? Object.keys(registry.teams) : [],
    complexityMapping: registry?.complexity_mapping || null,
  };
}

// === Mission Control: Structured Markdown Parsing ===

function getKMWorkflow(options = {}) {
  const artifacts = {
    plan: parseTeamPlan(),
    progress: parseTeamProgress(),
    bulletin: parseTeamBulletin(),
    findings: parseTeamFindings(),
    memory: parseMemory(),
  };

  // Native-First: merge with live team data from ~/.claude/teams/
  try {
    const { discoverTeamsCached, getTeamDetail } = require('./team-discovery');
    const { synthesize } = require('./data-synthesizer');
    const teams = discoverTeamsCached();

    // If session was cleared but active teams exist, auto-unsuppress
    // (native team data should always be available for live monitoring)
    if (options.suppressNative && teams.length === 0) {
      return { plan: null, progress: null, bulletin: null, findings: null, memory: artifacts.memory, liveTeam: null };
    }

    const activeTeam = teams.length > 0 ? getTeamDetail(teams[0].name) : null;
    return synthesize(activeTeam, artifacts);
  } catch (err) {
    console.error('[getKMWorkflow] Native synthesis failed, falling back to artifacts:', err.message);
    return artifacts;
  }
}

function parseTeamPlan() {
  const filePath = resolveArtifactPath('TEAM_PLAN.md');
  const meta = fileMeta(filePath);
  if (!meta) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const subjectMatch = content.match(/\*\*주제\*\*:\s*(.+)/);
  const complexityMatch = content.match(/\*\*복잡도\*\*:\s*(.+)/);

  const teamResult = parseMarkdownTable(content, '## Team', { withHeaders: true });
  const stepsResult = parseMarkdownTable(content, '## Steps', { withHeaders: true });
  const hierarchyResult = parseMarkdownTable(content, '## Hierarchy', { withHeaders: true });
  const workflowResult = parseMarkdownTable(content, '## Workflow Flow', { withHeaders: true });

  // Header-based dynamic column mapping for Team table
  const th = teamResult.headers;
  const tNameIdx = th.findIndex(h => /agent|name/i.test(h));
  const tRoleIdx = th.findIndex(h => /role/i.test(h));
  const tModelIdx = th.findIndex(h => /model/i.test(h));
  const tStatusIdx = th.findIndex(h => /^mode$|status|^st\.?$/i.test(h));

  // Header-based dynamic column mapping for Hierarchy table
  const hh = hierarchyResult.headers;
  const hParentIdx = hh.findIndex(h => /parent/i.test(h));
  const hChildrenIdx = hh.findIndex(h => /children|child/i.test(h));

  // Header-based dynamic column mapping for Steps table
  const sh = stepsResult.headers;
  const sIdIdx = sh.findIndex(h => /^(id|#|no\.?)$/i.test(h));
  const sStepIdx = sh.findIndex(h => /^(step|task|name)$/i.test(h));
  const sAssigneeIdx = sh.findIndex(h => /assign|^agent$|^who$/i.test(h));
  const sDepIdx = sh.findIndex(h => /dep|depend|^after$/i.test(h));
  const sStatusIdx = sh.findIndex(h => /^status$|^st\.?$/i.test(h));

  return {
    ...meta,
    subject: subjectMatch ? subjectMatch[1].trim() : null,
    complexity: complexityMatch ? complexityMatch[1].trim() : null,
    team: teamResult.rows.map(row => ({
      name: (tNameIdx >= 0 ? row[tNameIdx] : row[1]) || '',
      role: (tRoleIdx >= 0 ? row[tRoleIdx] : row[0]) || '',
      model: formatModelName((tModelIdx >= 0 ? row[tModelIdx] : row[2]) || ''),
      status: (tStatusIdx >= 0 ? row[tStatusIdx] : row[3]) || '',
    })).filter(r => r.name),
    steps: stepsResult.rows.map(row => ({
      id: (sIdIdx >= 0 ? row[sIdIdx] : row[0]) || '',
      step: (sStepIdx >= 0 ? row[sStepIdx] : row[1]) || '',
      assignee: (sAssigneeIdx >= 0 ? row[sAssigneeIdx] : row[2]) || '',
      dependency: (sDepIdx >= 0 ? row[sDepIdx] : row[3]) || '',
      status: (sStatusIdx >= 0 ? row[sStatusIdx] : row[4]) || '',
    })).filter(r => r.step),
    hierarchy: hierarchyResult.rows.map(row => ({
      parent: (hParentIdx >= 0 ? row[hParentIdx] : row[0]) || '',
      children: (hChildrenIdx >= 0 ? row[hChildrenIdx] : row[1]) || '',
    })).filter(r => r.parent),
    workflowPhases: (() => {
      const wh = workflowResult.headers;
      const wPhaseIdx = wh.findIndex(h => /phase/i.test(h));
      const wAgentsIdx = wh.findIndex(h => /agent/i.test(h));
      const wModeIdx = wh.findIndex(h => /mode/i.test(h));
      const wInputIdx = wh.findIndex(h => /input/i.test(h));
      const wOutputIdx = wh.findIndex(h => /output/i.test(h));
      return workflowResult.rows.map(row => ({
        phase: (wPhaseIdx >= 0 ? row[wPhaseIdx] : row[0]) || '',
        agents: (wAgentsIdx >= 0 ? row[wAgentsIdx] : row[1]) || '',
        mode: (wModeIdx >= 0 ? row[wModeIdx] : row[2]) || '',
        input: (wInputIdx >= 0 ? row[wInputIdx] : row[3]) || '',
        output: (wOutputIdx >= 0 ? row[wOutputIdx] : row[4]) || '',
      })).filter(r => r.phase);
    })(),
  };
}

function parseTeamProgress() {
  const filePath = resolveArtifactPath('TEAM_PROGRESS.md');
  const meta = fileMeta(filePath);
  if (!meta) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  const statusBoard = parseMarkdownTable(content, '## Status Board');
  const agents = statusBoard.map(row => ({
    agent: (row[0] || '').trim(),
    task: (row[1] || '').trim(),
    progress: parseProgressStr(row[2]),
    updated: (row[3] || '').trim(),
    note: (row[4] || '').trim(),
  })).filter(r => r.agent);

  const checkpointsRaw = parseMarkdownTable(content, '## Checkpoints');
  const checkpoints = checkpointsRaw.map(row => ({
    id: (row[0] || '').trim(),
    name: (row[1] || '').trim(),
    condition: (row[2] || '').trim(),
    done: /\[x\]/i.test(row[3] || ''),
  })).filter(r => r.name);

  const blockersRaw = parseMarkdownTable(content, '## Blockers');
  const blockers = blockersRaw.map(row => ({
    id: (row[0] || '').trim(),
    reason: (row[1] || '').trim(),
    affected: (row[2] || '').trim(),
    resolution: (row[3] || '').trim(),
    status: (row[4] || '').trim(),
  })).filter(r => r.reason);

  return { ...meta, agents, checkpoints, blockers };
}

function parseTeamBulletin() {
  const filePath = resolveArtifactPath('TEAM_BULLETIN.md');
  const meta = fileMeta(filePath);
  if (!meta) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  const entryPattern = /## \[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\]\s*-\s*(.+)/g;
  const headers = [];
  let match;
  while ((match = entryPattern.exec(content)) !== null) {
    headers.push({ index: match.index, time: match[1].trim(), agent: match[2].trim(), headerEnd: match.index + match[0].length });
  }

  const entries = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].headerEnd;
    const end = i + 1 < headers.length ? headers[i + 1].index : content.length;
    const body = content.slice(start, end).trim();

    const taskMatch = body.match(/\*\*Task\*\*:\s*(.+)/);
    const findingsMatch = body.match(/\*\*Findings\*\*:\s*(.+)/);
    const linksMatch = body.match(/\*\*Links\*\*:\s*(.+)/);
    const statusMatch = body.match(/\*\*Status\*\*:\s*(.+)/);

    entries.push({
      time: headers[i].time,
      agent: headers[i].agent,
      task: taskMatch ? taskMatch[1].trim() : '',
      findings: findingsMatch ? findingsMatch[1].trim() : '',
      links: linksMatch ? linksMatch[1].trim() : '',
      status: statusMatch ? statusMatch[1].trim() : 'active',
    });
  }

  entries.reverse(); // newest first

  return { ...meta, entries, totalEntries: entries.length };
}

function parseTeamFindings() {
  const filePath = resolveArtifactPath('TEAM_FINDINGS.md');
  const meta = fileMeta(filePath);
  if (!meta) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  const crossValidation = parseMarkdownTable(content, '### Cross-Validation Summary').map(row => ({
    source: (row[0] || '').trim(), found: (row[1] || '').trim(),
    core: (row[2] || '').trim(), isolated: (row[3] || '').trim(),
  })).filter(r => r.source);

  const coreNotes = parseMarkdownTable(content, '### Core Notes').map(row => ({
    id: (row[0] || '').trim(), path: (row[1] || '').trim(),
    relevance: (row[2] || '').trim(), source: (row[3] || '').trim(),
  })).filter(r => r.path);

  const insightsMatch = content.match(/### Key Insights\s*\n([\s\S]*?)(?=\n###|\n---|\n$)/);
  const insights = [];
  if (insightsMatch) {
    for (const line of insightsMatch[1].split('\n')) {
      const m = line.match(/^\d+\.\s+(.+)/);
      if (m && m[1].trim() && m[1].trim() !== '(Lead가 기입)') insights.push(m[1].trim());
    }
  }

  return { ...meta, crossValidation, coreNotes, insights };
}

function parseMemory() {
  const filePath = resolveArtifactPath('MEMORY.md');
  const meta = fileMeta(filePath);
  if (!meta) return null;

  const content = fs.readFileSync(filePath, 'utf-8');
  const sessionLog = parseMarkdownTable(content, '## Session Log');

  return {
    ...meta,
    sessions: sessionLog.map(row => ({
      id: (row[0] || '').trim(), date: (row[1] || '').trim(), topic: (row[2] || '').trim(),
      complexity: (row[3] || '').trim(), notes: (row[4] || '').trim(),
      links: (row[5] || '').trim(), teammates: (row[6] || '').trim(),
    })).filter(r => r.date),
    totalSessions: sessionLog.length,
  };
}

// === Helpers ===

function fileMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  return { modified: stat.mtime.toISOString(), size: stat.size, isEmpty: content.trim().length < 50 };
}

function parseProgressStr(str) {
  if (!str) return 0;
  const m = str.toString().match(/(\d+)%?/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseMarkdownTable(content, sectionHeader, { withHeaders = false } = {}) {
  const headerIdx = content.indexOf(sectionHeader);
  if (headerIdx === -1) return withHeaders ? { headers: [], rows: [] } : [];

  const afterHeader = content.slice(headerIdx + sectionHeader.length);
  const lines = afterHeader.split('\n');
  const rows = [];
  let headers = [];
  let headerSkipped = false;
  let separatorSkipped = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (headerSkipped && separatorSkipped && rows.length > 0) break;
      if (trimmed === '' || trimmed === '---') continue;
      if (headerSkipped && separatorSkipped) break;
      continue;
    }
    if (!headerSkipped) {
      headers = trimmed.split('|').slice(1, -1).map(c => c.trim().toLowerCase());
      headerSkipped = true;
      continue;
    }
    if (!separatorSkipped) {
      if (/^[\s|:\-]+$/.test(trimmed)) { separatorSkipped = true; continue; }
    }
    const cells = trimmed.split('|').slice(1, -1);
    rows.push(cells.map(c => c.trim()));
  }

  return withHeaders ? { headers, rows } : rows;
}

function safeReadDir(dirPath, ext) {
  if (!fs.existsSync(dirPath)) return [];
  try {
    return fs.readdirSync(dirPath).filter(f => f.endsWith(ext));
  } catch {
    return [];
  }
}

function clearArtifacts() {
  const files = ['TEAM_PLAN.md', 'TEAM_BULLETIN.md', 'TEAM_FINDINGS.md',
                 'TEAM_PROGRESS.md',
                 'team_plan.md', 'team_bulletin.md', 'team_findings.md',
                 'team_progress.md'];
  const cleared = [];
  for (const f of files) {
    const fp = path.join(artifactsDir, f);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      cleared.push(f);
    }
  }
  return cleared;
}

module.exports = { getTeamOSStatus, getKMWorkflow, clearArtifacts };
