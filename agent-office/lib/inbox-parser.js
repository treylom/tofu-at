/**
 * inbox-parser.js — Rich parsing of Claude Code team inbox messages
 *
 * Parses inbox JSON files to extract agent status, progress, and findings.
 * Inbox format: [{ from, text, timestamp, read }]
 * The `text` field can be plain text or a JSON string with structured data.
 */

const fs = require('fs');
const path = require('path');

// --- Read all inboxes from a directory ---

function readInboxes(inboxDir) {
  const result = {};
  if (!inboxDir || !safeExists(inboxDir)) return result;

  try {
    const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const agentName = file.replace('.json', '');
      try {
        const raw = fs.readFileSync(path.join(inboxDir, file), 'utf-8');
        const messages = JSON.parse(raw);
        result[agentName] = Array.isArray(messages) ? messages : [];
      } catch { result[agentName] = []; }
    }
  } catch { /* directory read error */ }

  return result;
}

// --- Parse structured data from text field ---

function parseMessageText(text) {
  if (!text || typeof text !== 'string') return { type: 'text', content: text || '' };

  // Try parsing as JSON (structured messages)
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return { type: parsed.type || 'structured', ...parsed, content: parsed.content || parsed.description || parsed.reason || parsed.subject || trimmed };
    } catch { /* not JSON, treat as text */ }
  }

  return { type: 'text', content: text };
}

// --- Infer agent status from all inboxes ---
// Progress scale (8-level granular):
//   0 = unknown, 5 = spawned, 10 = assigned, 20 = first_message,
//   30~70 = active_work (proportional to message count),
//   80 = results_sent, 90 = ralph_waiting, 95 = shutdown_received, 100 = team_deleted

function inferAgentStatus(agentName, allInboxes) {
  // Messages IN this agent's inbox (received by agent)
  const received = allInboxes[agentName] || [];

  // Messages in team-lead's inbox FROM this agent
  const leadInbox = allInboxes['team-lead'] || [];
  const fromAgent = leadInbox.filter(m => m.from === agentName);

  // All messages related to this agent
  const allMsgs = [
    ...received.map(m => ({ ...m, direction: 'received' })),
    ...fromAgent.map(m => ({ ...m, direction: 'sent_to_lead' })),
  ].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  const lastMsg = allMsgs[allMsgs.length - 1];

  // Status detection
  let status = 'pending';
  let progress = 0;
  let task = '';
  let findings = '';

  // Check for shutdown_request received by agent
  const hasShutdown = received.some(m => {
    const parsed = parseMessageText(m.text);
    return parsed.type === 'shutdown_request';
  });

  // Check for results sent to lead (agent completed work)
  const hasResults = fromAgent.length > 0 && fromAgent.some(m => {
    const text = (m.text || '').toLowerCase();
    return text.includes('완료') || text.includes('결과') || text.includes('분석') ||
           text.includes('completed') || text.includes('result') || text.length > 500;
  });

  // Check for RALPH/REVISE waiting (lead sent REVISE back)
  const hasRalphWaiting = received.some(m => {
    const text = (m.text || '').toLowerCase();
    return text.includes('revise') || text.includes('ralph');
  }) && hasResults;

  // Check for task assignment received
  const hasTaskAssignment = received.some(m => {
    const parsed = parseMessageText(m.text);
    return parsed.type === 'task_assignment' || (m.text || '').includes('## Task:');
  });

  // Check if agent has active work (sent messages to lead)
  const hasActiveWork = fromAgent.length > 0;

  // Determine status and progress (8-level granular scale)
  if (hasShutdown) {
    // shutdown_request received = 95% (NOT 100% — Done only after TeamDelete)
    status = 'shutdown';
    progress = 95;
  } else if (hasRalphWaiting) {
    // Results sent but RALPH/REVISE feedback pending
    status = 'ralph_waiting';
    progress = 90;
  } else if (hasResults) {
    // Results sent to lead but team not yet deleted
    status = 'results_sent';
    progress = 80;
  } else if (hasActiveWork) {
    const msgCount = fromAgent.length;
    if (msgCount === 1) {
      // First message to lead = 20% (first_message)
      status = 'first_message';
      progress = 20;
    } else {
      // Active work: 30~70% proportional to message count
      status = 'active';
      if (msgCount >= 5) progress = 70;
      else if (msgCount === 4) progress = 60;
      else if (msgCount === 3) progress = 50;
      else progress = 40; // 2 messages
    }
  } else if (hasTaskAssignment) {
    status = 'assigned';
    progress = 10;
  } else if (received.length > 0) {
    status = 'spawned';
    progress = 5;
  }

  // Extract task description
  for (const m of received) {
    const parsed = parseMessageText(m.text);
    if (parsed.type === 'task_assignment') {
      task = parsed.subject || parsed.description || '';
      break;
    }
    if ((m.text || '').includes('## Task:')) {
      const match = m.text.match(/## Task:\s*(.+)/);
      if (match) { task = match[1].trim(); break; }
    }
    // Fallback: use first message from lead as task description
    if (m.from === 'team-lead' && !task) {
      task = (m.text || '').slice(0, 120);
    }
  }

  // Extract findings from results sent to lead
  if (fromAgent.length > 0) {
    const lastResult = fromAgent[fromAgent.length - 1];
    findings = (lastResult.text || '').slice(0, 300);
  }

  return {
    agent: agentName,
    progress,
    status,
    task: task.slice(0, 150),
    findings,
    lastActivity: lastMsg?.timestamp || null,
    messageCount: allMsgs.length,
    hasResults,
  };
}

// --- Generate bulletin entries from inboxes ---

function generateBulletinFromInboxes(allInboxes) {
  const entries = [];

  for (const [agentName, messages] of Object.entries(allInboxes)) {
    for (const msg of messages) {
      const parsed = parseMessageText(msg.text);

      // Skip idle notifications and internal protocol messages
      if (parsed.type === 'idle_notification') continue;
      if (parsed.type === 'shutdown_request' || parsed.type === 'shutdown_response') continue;

      // Skip very short messages
      if ((msg.text || '').length < 20) continue;

      const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const timeStr = ts.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      const dateStr = ts.toLocaleDateString('sv-SE');

      entries.push({
        time: `${dateStr} ${timeStr}`,
        agent: msg.from || agentName,
        task: parsed.type === 'task_assignment'
          ? (parsed.subject || 'Task assignment')
          : (msg.text || '').slice(0, 80),
        findings: parsed.type === 'text'
          ? (msg.text || '').slice(0, 200)
          : (parsed.content || '').slice(0, 200),
        status: parsed.type === 'task_assignment' ? 'assigned' : 'active',
      });
    }
  }

  // Sort newest first
  return entries.sort((a, b) => b.time.localeCompare(a.time));
}

// --- Helpers ---

function safeExists(p) {
  try { return fs.existsSync(p); }
  catch { return false; }
}

module.exports = {
  readInboxes,
  parseMessageText,
  inferAgentStatus,
  generateBulletinFromInboxes,
};
