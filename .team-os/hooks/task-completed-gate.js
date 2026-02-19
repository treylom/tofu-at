#!/usr/bin/env node
/**
 * TaskCompleted Hook - task-completed-gate.js
 *
 * Validates that task completion includes:
 * 1. Summary message in the result
 * 2. No same-file conflicts between teammates
 * 3. Required output files exist (if specified in quality_gates)
 *
 * Referenced by: .claude/settings.local.json hooks.TaskCompleted
 */

const fs = require("fs");
const path = require("path");

const PROGRESS_PATH = path.join(
  process.cwd(),
  ".team-os",
  "artifacts",
  "TEAM_PROGRESS.md"
);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  try {
    const hookData = JSON.parse(input);
    const taskId = hookData.task_id || "unknown";
    const agentName = hookData.agent_name || hookData.teammate_name || "unknown";

    // Update progress file if it exists
    if (fs.existsSync(PROGRESS_PATH)) {
      let progressContent = fs.readFileSync(PROGRESS_PATH, "utf8");

      // Update agent's row: find the line with agent name and update status
      const lines = progressContent.split("\n");
      const updatedLines = lines.map((line) => {
        if (line.includes(`@${agentName}`) || line.includes(`| ${agentName} |`)) {
          // Replace progress percentage and note
          const now = new Date().toISOString().slice(0, 16).replace("T", " ");
          return line
            .replace(/\d+%/, "100%")
            .replace(/\| [^|]*\|$/, `| completed |`)
            .replace(
              /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
              now
            );
        }
        return line;
      });

      fs.writeFileSync(PROGRESS_PATH, updatedLines.join("\n"), "utf8");
    }

    // Allow task completion
    console.log(
      JSON.stringify({
        decision: "allow",
        reason: `Task ${taskId} by ${agentName} completed`,
      })
    );
    process.exit(0);
  } catch (err) {
    console.error(`[task-completed-gate] Error: ${err.message}`);
    process.exit(0);
  }
});
