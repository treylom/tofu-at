/**
 * team-discovery.js — Cross-platform Claude Code team finder
 *
 * Probes Windows HOME + WSL HOME(s) to discover all active teams.
 * Primary data source for Agent Office "Native-First" architecture.
 */

const fs = require('fs');
const path = require('path');
const { WSL_HOMES, WINDOWS_HOME, isWSL } = require('../config');
const { readInboxes } = require('./inbox-parser');

// --- Cache ---
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 2000; // 2 seconds

function invalidateCache() { _cache = null; }

function discoverTeamsCached() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  _cache = discoverTeams();
  _cacheTime = Date.now();
  return _cache;
}

// --- HOME path probing (deduplicated via realpathSync) ---

function getTeamHomes() {
  const homes = [];
  const seen = new Set();

  /**
   * Add a HOME entry, deduplicating by canonical path.
   * Prevents the same teams directory from being probed twice
   * (e.g. /home/tofu/.claude/teams and /mnt/c/.../.claude/teams pointing to same place).
   */
  function addHome(entry) {
    let canonical;
    try {
      const teamsPath = path.join(entry.home, '.claude', 'teams');
      canonical = fs.existsSync(teamsPath) ? fs.realpathSync(teamsPath) : teamsPath;
    } catch {
      canonical = path.join(entry.home, '.claude', 'teams');
    }
    if (seen.has(canonical)) return;
    seen.add(canonical);
    homes.push(entry);
  }

  // Unix/macOS/WSL HOME first (most reliable — Claude Code always creates teams here)
  if (process.platform !== 'win32' && process.env.HOME) {
    addHome({ platform: isWSL() ? 'wsl' : 'unix', home: process.env.HOME });
  }

  // Windows HOME
  if (WINDOWS_HOME) {
    addHome({ platform: 'windows', home: WINDOWS_HOME });
  }

  // WSL HOMEs (detected at startup via config.js — for when running on Windows)
  for (const wsl of WSL_HOMES) {
    addHome({ platform: 'wsl', distro: wsl.distro, home: wsl.winPath, wslHome: wsl.wslHome });
  }

  return homes;
}

// --- Team discovery ---

function discoverTeams() {
  const homes = getTeamHomes();
  const teams = [];

  for (const entry of homes) {
    const teamsDir = path.join(entry.home, '.claude', 'teams');
    if (!safeExists(teamsDir)) continue;

    let dirs;
    try {
      dirs = fs.readdirSync(teamsDir).filter(d => {
        try { return fs.statSync(path.join(teamsDir, d)).isDirectory(); }
        catch { return false; }
      });
    } catch { continue; }

    for (const dir of dirs) {
      const configPath = path.join(teamsDir, dir, 'config.json');
      if (!safeExists(configPath)) continue;

      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        if (!raw || raw.trim().length < 5) continue; // Skip empty/corrupt config
        const config = JSON.parse(raw);
        if (!config || !config.members || config.members.length === 0) continue; // Skip teams with no members
        const stat = fs.statSync(configPath);

        teams.push({
          name: dir,
          platform: entry.platform,
          distro: entry.distro || null,
          home: entry.home,
          teamsDir,
          configPath,
          config,
          mtime: stat.mtimeMs,
          memberCount: (config.members || []).length,
          hasInboxes: safeExists(path.join(teamsDir, dir, 'inboxes')),
        });
      } catch { /* skip malformed config */ }
    }
  }

  // Sort newest first
  return teams.sort((a, b) => b.mtime - a.mtime);
}

// --- Team detail ---

function getTeamDetail(teamName) {
  const teams = discoverTeamsCached();
  const team = teamName
    ? teams.find(t => t.name === teamName)
    : teams[0]; // default to most recent

  if (!team) return null;

  // Read inboxes
  const inboxDir = path.join(team.teamsDir, team.name, 'inboxes');
  const inboxes = readInboxes(inboxDir);

  // Read tasks
  const tasksDir = path.join(team.home, '.claude', 'tasks', team.name);
  const tasks = readTasks(tasksDir);

  return { ...team, inboxes, tasks };
}

// --- Task reading ---

function readTasks(tasksDir) {
  if (!safeExists(tasksDir)) return [];
  try {
    return fs.readdirSync(tasksDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('.'))
      .map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf-8'));
        } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

// --- Helpers ---

function safeExists(p) {
  try { return fs.existsSync(p); }
  catch { return false; }
}

module.exports = {
  discoverTeams,
  discoverTeamsCached,
  getTeamDetail,
  getTeamHomes,
  invalidateCache,
};
