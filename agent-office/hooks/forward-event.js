#!/usr/bin/env node
/**
 * forward-event.js — Forwards Claude Code hook events to Agent Office dashboard.
 * Silently exits if Agent Office is not running.
 *
 * Usage in settings.local.json:
 *   { "type": "command", "command": "node agent-office/hooks/forward-event.js", "timeout": 3 }
 */

const http = require('http');
const PORT = process.env.AGENT_OFFICE_PORT || 3747;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const body = input.trim() || '{}';
    JSON.parse(body); // validate JSON
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/hooks/event',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 2000,
    }, () => process.exit(0));
    req.on('error', () => process.exit(0));
    req.on('timeout', () => { req.destroy(); process.exit(0); });
    req.write(body);
    req.end();
  } catch {
    process.exit(0);
  }
});

// Handle stdin close without data
setTimeout(() => process.exit(0), 2500);
