#!/usr/bin/env node
/**
 * TeammateIdle Hook - teammate-idle-gate.js
 *
 * Enforces that teammates update TEAM_BULLETIN.md before going idle.
 * Escalation mechanism:
 *   1st idle: warn + notify lead (exit 0)
 *   2nd idle (same agent): warn "wake-up needed" (exit 0)
 *   3rd idle: block with "force restart recommended" (exit 2)
 *
 * Idle counts are tracked in a temporary file per team session.
 *
 * Referenced by: .claude/settings.local.json hooks.TeammateIdle
 * Artifact path: .team-os/artifacts/TEAM_BULLETIN.md
 */

const fs = require("fs");
const path = require("path");

const BULLETIN_PATH = path.join(
  process.cwd(),
  ".team-os",
  "artifacts",
  "TEAM_BULLETIN.md"
);

const IDLE_TRACKER_PATH = path.join(
  process.cwd(),
  ".team-os",
  "artifacts",
  ".idle-tracker.json"
);

// --- Idle count persistence ---

function readIdleCounts() {
  try {
    if (fs.existsSync(IDLE_TRACKER_PATH)) {
      return JSON.parse(fs.readFileSync(IDLE_TRACKER_PATH, "utf8"));
    }
  } catch { /* corrupted file, start fresh */ }
  return {};
}

function writeIdleCounts(counts) {
  try {
    fs.writeFileSync(IDLE_TRACKER_PATH, JSON.stringify(counts, null, 2));
  } catch { /* non-critical, continue */ }
}

// Read hook input from stdin
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const hookData = JSON.parse(input);
    const agentName = hookData.agent_name || hookData.teammate_name || "unknown";
    const transcript = hookData.transcript_path || "";

    // Check if bulletin file exists
    if (!fs.existsSync(BULLETIN_PATH)) {
      // No bulletin file yet - allow idle (first run before team init)
      console.log(
        JSON.stringify({
          decision: "allow",
          reason: "TEAM_BULLETIN.md not yet initialized",
        })
      );
      process.exit(0);
    }

    const bulletinContent = fs.readFileSync(BULLETIN_PATH, "utf8");

    // Check if agent has posted in the bulletin recently
    // Pattern: ## [YYYY-MM-DD HH:MM] - {agentName}
    const agentPattern = new RegExp(
      `## \\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}\\] - ${escapeRegex(agentName)}`,
      "g"
    );
    const matches = bulletinContent.match(agentPattern);

    // --- Idle escalation tracking ---
    const idleCounts = readIdleCounts();
    const prevCount = idleCounts[agentName] || 0;
    const newCount = prevCount + 1;
    idleCounts[agentName] = newCount;
    writeIdleCounts(idleCounts);

    if (!matches || matches.length === 0) {
      // Agent never posted to bulletin
      if (newCount >= 3) {
        // 3rd idle without any bulletin entry: BLOCK
        console.error(
          `[teammate-idle-gate] BLOCKED: ${agentName} idle ${newCount} times with no bulletin entries. Force restart recommended.`
        );
        console.log(
          JSON.stringify({
            decision: "block",
            reason: `${agentName} idle ${newCount} times without posting to TEAM_BULLETIN.md. Consider shutting down and respawning this agent.`,
          })
        );
        process.exit(2);
      } else if (newCount === 2) {
        // 2nd idle: escalated warning (stdout JSON for consistency)
        console.error(
          `[teammate-idle-gate] WAKE-UP NEEDED: ${agentName} idle ${newCount} times with no bulletin entries. Lead should send wake-up message.`
        );
        console.log(
          JSON.stringify({
            decision: "allow",
            reason: `WAKE-UP NEEDED: ${agentName} idle ${newCount} times. Lead should send wake-up message.`,
          })
        );
        process.exit(0);
      } else {
        // 1st idle: basic warning (stdout JSON for consistency)
        console.error(
          `[teammate-idle-gate] WARNING: ${agentName} has no entries in TEAM_BULLETIN.md (idle #${newCount}). Consider posting findings before going idle.`
        );
        console.log(
          JSON.stringify({
            decision: "allow",
            reason: `${agentName} has no bulletin entries yet (idle #${newCount})`,
          })
        );
        process.exit(0);
      }
    }

    // Agent has posted — check if idle count is escalating despite having entries
    if (newCount >= 3) {
      // Even with bulletin entries, 3+ consecutive idles suggests stuck agent
      console.error(
        `[teammate-idle-gate] WARNING: ${agentName} idle ${newCount} consecutive times despite having ${matches.length} bulletin entries. May need attention.`
      );
      // Still allow — agent has been productive
    }

    // Reset idle count if agent has recent activity (bulletin entries exist)
    // This prevents false escalation for agents that are genuinely between tasks

    console.log(
      JSON.stringify({
        decision: "allow",
        reason: `${agentName} has ${matches.length} bulletin entries (idle #${newCount})`,
      })
    );
    process.exit(0);
  } catch (err) {
    // On parse error, allow idle (don't block on hook failures)
    console.error(`[teammate-idle-gate] Error: ${err.message}`);
    process.exit(0);
  }
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
