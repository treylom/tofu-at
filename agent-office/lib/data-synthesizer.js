/**
 * data-synthesizer.js — Multi-source data merger for Agent Office
 *
 * Merges data from two sources:
 *   Primary: Claude Code native team infrastructure (~/.claude/teams/)
 *   Secondary: .team-os/artifacts/TEAM_*.md (optional enrichment)
 *
 * When artifacts exist → use them (richer data with steps, bulletin history)
 * When artifacts missing → auto-generate from native team data
 * When both exist → artifacts primary, native data augments real-time fields
 */

const { inferAgentStatus, generateBulletinFromInboxes } = require('./inbox-parser');

// Model name mapping: short/internal names → display names
function formatModelName(raw) {
  if (!raw) return '';
  const s = raw.toLowerCase().trim();
  const map = {
    'opus': 'Opus 4.6',
    'sonnet': 'Sonnet 4.6',
    'haiku': 'Haiku 4.5',
    'claude-opus-4-6': 'Opus 4.6',
    'claude-sonnet-4-6': 'Sonnet 4.6',
    'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
    'claude-haiku-4-5-20251001': 'Haiku 4.5',
    // Display names (already formatted — prevent double [1M])
    'opus 4.6': 'Opus 4.6',
    'sonnet 4.6': 'Sonnet 4.6',
    'sonnet 4.5': 'Sonnet 4.5',
    'haiku 4.5': 'Haiku 4.5',
  };
  const has1m = /\[1m\]/i.test(raw);
  const clean = s.replace(/\s*\[1m\]/i, '').trim();
  const name = map[clean] || raw.replace(/\s*\[1m\]/i, '').trim();
  return has1m ? `${name} [1M]` : name;
}

function synthesize(nativeTeam, artifacts) {
  // artifacts = { plan, progress, bulletin, findings, memory } from parseTeamXxx()
  // nativeTeam = { config, inboxes, tasks, name, platform, mtime, ... } from team-discovery

  return {
    plan: synthesizePlan(nativeTeam, artifacts?.plan),
    progress: synthesizeProgress(nativeTeam, artifacts?.progress),
    bulletin: synthesizeBulletin(nativeTeam, artifacts?.bulletin),
    findings: artifacts?.findings || null,
    memory: artifacts?.memory || null,
    liveTeam: buildLiveTeamMeta(nativeTeam),
  };
}

// --- Plan ---

function synthesizePlan(nativeTeam, artifactPlan) {
  // Artifact plan has richer data (steps, subject, complexity)
  if (artifactPlan && !artifactPlan.isEmpty) {
    // Augment with native real-time status
    if (nativeTeam?.config?.members && artifactPlan.team) {
      for (const member of artifactPlan.team) {
        const native = nativeTeam.config.members.find(m =>
          m.name === (member.name || '').replace('@', '')
        );
        if (native) {
          member._isActive = native.isActive;
          member._backendType = native.backendType || '';
          member._tmuxPaneId = native.tmuxPaneId || '';
        }
      }
    }
    return artifactPlan;
  }

  // Generate from native config
  if (!nativeTeam?.config) return null;

  const config = nativeTeam.config;
  const members = config.members || [];

  return {
    modified: new Date(nativeTeam.mtime).toISOString(),
    size: 0,
    isEmpty: false,
    subject: config.description || config.name || '',
    complexity: `${members.length} agents`,
    team: members.map(m => ({
      name: m.name || '',
      role: m.agentType || '',
      model: formatModelName(m.model || ''),
      status: m.isActive ? 'active' : (m.backendType === 'tmux' ? 'tmux' : 'idle'),
      _isActive: m.isActive,
      _backendType: m.backendType || '',
      _tmuxPaneId: m.tmuxPaneId || '',
    })),
    steps: [], // Native has no step data
    _source: 'native',
  };
}

// --- Task-based Progress Calculator (priority source — overrides inbox inference) ---

function calculateTaskProgress(tasks, agentName) {
  if (!tasks || !tasks.length) return null;
  const agentTasks = tasks.filter(t =>
    t.owner && t.owner.toLowerCase() === agentName.toLowerCase()
  );
  if (agentTasks.length === 0) return null;
  const completed = agentTasks.filter(t => t.status === 'completed').length;
  const inProgress = agentTasks.filter(t => t.status === 'in_progress').length;
  const total = agentTasks.length;
  // in_progress tasks count as 50% weight
  const progress = Math.round(((completed + inProgress * 0.5) / total) * 100);
  return {
    progress,
    completedTasks: completed,
    totalTasks: total,
    currentTask: agentTasks.find(t => t.status === 'in_progress')?.subject || null,
  };
}

// --- Build team grouping from native team data ---
// Groups agents by their team_name for multi-team dashboard support

function buildTeamGroups(agents, nativeTeam) {
  // If only one team (most common case), return single group
  const teamName = nativeTeam?.name || 'default';
  const teamLead = agents.find(a => {
    const name = (a.agent || '').toLowerCase();
    return name.includes('lead') || name.includes('main');
  });

  return {
    [teamName]: {
      agents: agents,
      teamLead: teamLead?.agent || null,
      activeCount: agents.filter(a => a.progress > 0 && a.progress < 80).length,
      avgProgress: agents.length > 0
        ? Math.round(agents.reduce((sum, a) => sum + (a.progress || 0), 0) / agents.length)
        : 0,
    }
  };
}

// --- Progress ---

function synthesizeProgress(nativeTeam, artifactProgress) {
  // Artifact progress with actual data → use it (augmented with native)
  if (artifactProgress && !artifactProgress.isEmpty && artifactProgress.agents?.length > 0) {
    if (nativeTeam?.config?.members) {
      for (const agent of artifactProgress.agents) {
        const cleanName = (agent.agent || '').replace('@', '');
        const native = nativeTeam.config.members.find(m => m.name === cleanName);
        if (native) {
          agent._isActive = native.isActive;
          agent._backendType = native.backendType || '';
          agent._model = native.model || '';
        }
      }
    }
    // Merge task-based progress (higher value wins)
    if (nativeTeam?.tasks?.length > 0) {
      for (const agent of artifactProgress.agents) {
        const cleanName = (agent.agent || '').replace('@', '');
        const taskProg = calculateTaskProgress(nativeTeam.tasks, cleanName);
        if (taskProg && taskProg.progress > (agent.progress || 0)) {
          agent.progress = taskProg.progress;
          agent._taskProgress = taskProg;
        }
      }
    }
    return artifactProgress;
  }

  // Generate from native team data
  if (!nativeTeam?.config?.members) return null;

  const inboxes = nativeTeam.inboxes || {};
  const members = nativeTeam.config.members || [];

  const agents = members.map(m => {
    const agentStatus = inferAgentStatus(m.name, inboxes);
    const taskProg = calculateTaskProgress(nativeTeam?.tasks, m.name);
    // Task-based progress takes priority, but only if it's higher than inbox inference
    // (prevents taskProg=0 from overwriting inbox-derived progress like 30%)
    const progress = taskProg && taskProg.progress > agentStatus.progress
      ? taskProg.progress
      : agentStatus.progress;
    const task = taskProg?.currentTask || agentStatus.task || m.agentType || '';
    return {
      agent: m.name,
      task,
      progress,
      updated: agentStatus.lastActivity
        ? new Date(agentStatus.lastActivity).toISOString()
        : '',
      note: agentStatus.status,
      _isActive: m.isActive,
      _model: m.model || '',
      _backendType: m.backendType || '',
      _taskProgress: taskProg || null,
      _messageCount: agentStatus.messageCount,
    };
  });

  // Auto-generate checkpoints (Done = 80%+ since 100% only after TeamDelete)
  const nonLeadAgents = agents.filter(a => !a.agent.includes('team-lead'));
  const allSpawned = nonLeadAgents.length > 0 && nonLeadAgents.every(a => a.progress > 0);
  const allCompleted = nonLeadAgents.length > 0 && nonLeadAgents.every(a => a.progress >= 80);

  const checkpoints = [
    { id: '1', name: 'All workers spawned', condition: '모든 워커 Task 생성 완료', done: allSpawned },
    { id: '2', name: 'All workers completed', condition: '모든 워커 결과 수신', done: allCompleted },
    { id: '3', name: 'Artifacts generated', condition: '최종 산출물 생성', done: false },
  ];

  // Build team groups for multi-team dashboard support
  const teams = buildTeamGroups(agents, nativeTeam);

  return {
    modified: new Date().toISOString(),
    size: 0,
    isEmpty: false,
    agents,
    teams,  // NEW: team-grouped data for categorized display
    checkpoints,
    blockers: [],
    _source: 'native',
  };
}

// --- Bulletin ---

function synthesizeBulletin(nativeTeam, artifactBulletin) {
  // Artifact bulletin with entries → use it
  if (artifactBulletin && !artifactBulletin.isEmpty && artifactBulletin.entries?.length > 0) {
    return artifactBulletin;
  }

  // Generate from inbox messages
  if (!nativeTeam?.inboxes) return null;

  const entries = generateBulletinFromInboxes(nativeTeam.inboxes);
  if (entries.length === 0) return null;

  return {
    modified: new Date().toISOString(),
    size: 0,
    isEmpty: false,
    entries,
    totalEntries: entries.length,
    _source: 'native',
  };
}

// --- Live team metadata ---

function buildLiveTeamMeta(nativeTeam) {
  if (!nativeTeam) return null;

  const inboxes = nativeTeam.inboxes || {};
  const totalMessages = Object.values(inboxes).reduce((sum, msgs) => sum + (msgs?.length || 0), 0);
  const activeMembers = (nativeTeam.config?.members || []).filter(m => m.isActive).length;

  return {
    name: nativeTeam.name || null,
    platform: nativeTeam.platform || null,
    distro: nativeTeam.distro || null,
    description: nativeTeam.config?.description || '',
    memberCount: (nativeTeam.config?.members || []).length,
    activeMembers,
    totalMessages,
    lastActivity: nativeTeam.mtime ? new Date(nativeTeam.mtime).toISOString() : null,
  };
}

module.exports = { synthesize, formatModelName };
