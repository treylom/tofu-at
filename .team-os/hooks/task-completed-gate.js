#!/usr/bin/env node
/**
 * TaskCompleted Hook - task-completed-gate.js
 *
 * Validates that task completion includes:
 * 1. Summary message in the result
 * 2. No same-file conflicts between teammates
 * 3. Required output files exist (if specified in quality_gates)
 *
 * Decisions are always emitted as stdout JSON ({"decision": "allow"|"block", ...})
 * per the Claude Code hook protocol (hooks communicate via JSON, not exit code) —
 * so every path, including the catch block, exits 0.
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

    // --- Check 1: summary must be present and non-blank ---
    const summary = hookData.summary;
    if (typeof summary !== "string" || summary.trim().length < 1) {
      console.log(
        JSON.stringify({
          decision: "block",
          reason: "summary missing",
        })
      );
      process.exit(0);
      return;
    }

    // --- Check 2: quality_gates.required_files must all exist ---
    const requiredFiles =
      (hookData.quality_gates && hookData.quality_gates.required_files) || [];
    if (Array.isArray(requiredFiles) && requiredFiles.length > 0) {
      const missing = requiredFiles.filter(
        (f) => !fs.existsSync(path.join(process.cwd(), f))
      );
      if (missing.length > 0) {
        console.log(
          JSON.stringify({
            decision: "block",
            reason: `required files missing: ${missing.join(", ")}`,
          })
        );
        process.exit(0);
        return;
      }
    }

    // --- Check 3: no same-file conflict with other in-progress teammates ---
    const changedFiles = hookData.files || hookData.files_changed || [];
    let conflictNote = null;
    if (Array.isArray(changedFiles) && changedFiles.length > 0) {
      if (fs.existsSync(PROGRESS_PATH)) {
        const progressContent = fs.readFileSync(PROGRESS_PATH, "utf8");
        const board = parseStatusBoard(progressContent);

        if (!board.fileColumnIndex && board.fileColumnIndex !== 0) {
          conflictNote =
            "conflict check skipped: TEAM_PROGRESS.md Status Board has no file column";
        } else {
          const conflicts = new Set();
          for (const row of board.rows) {
            if (row.agent === agentName) continue; // only "other" teammates
            const status = (row.progressOrStatus || "").trim();
            if (/^100%$/.test(status) || /completed/i.test(status)) continue; // done rows excluded
            const otherFiles = (row.cells[board.fileColumnIndex] || "")
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean);
            for (const f of changedFiles) {
              if (otherFiles.includes(f)) conflicts.add(f);
            }
          }
          if (conflicts.size > 0) {
            console.log(
              JSON.stringify({
                decision: "block",
                reason: `file conflict with other teammate(s): ${Array.from(
                  conflicts
                ).join(", ")}`,
              })
            );
            process.exit(0);
            return;
          }
        }
      } else {
        conflictNote = "conflict check skipped: TEAM_PROGRESS.md not found";
      }
    }

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
    const reason = conflictNote
      ? `Task ${taskId} by ${agentName} completed (${conflictNote})`
      : `Task ${taskId} by ${agentName} completed`;
    console.log(
      JSON.stringify({
        decision: "allow",
        reason,
      })
    );
    process.exit(0);
  } catch (err) {
    console.error(`[task-completed-gate] Error: ${err.message}`);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `gate error: ${err.message}`,
      })
    );
    process.exit(0);
  }
});

// Parse the "## Status Board" markdown table in TEAM_PROGRESS.md.
// Returns { fileColumnIndex: number|null, rows: [{ agent, progressOrStatus, cells: [] }] }
function parseStatusBoard(progressContent) {
  const lines = progressContent.split("\n");
  const boardStart = lines.findIndex((l) => l.trim() === "## Status Board");
  if (boardStart === -1) return { fileColumnIndex: null, rows: [] };

  let nextSection = lines.length;
  for (let i = boardStart + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      nextSection = i;
      break;
    }
  }
  const sectionLines = lines
    .slice(boardStart + 1, nextSection)
    .filter((l) => l.trim().startsWith("|"));
  if (sectionLines.length < 1) return { fileColumnIndex: null, rows: [] };

  const splitRow = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const header = splitRow(sectionLines[0]);
  const fileColIdx = header.findIndex((h) => /^files?$/i.test(h));

  const rows = [];
  for (let i = 1; i < sectionLines.length; i++) {
    if (/^-+\s*(\|\s*-+\s*)*$/.test(sectionLines[i].replace(/\|/g, "|"))) continue; // separator row
    const cells = splitRow(sectionLines[i]);
    if (cells.every((c) => /^-*$/.test(c))) continue; // "---" separator
    const agentIdx = header.findIndex((h) => /^agent$/i.test(h));
    const progressIdx = header.findIndex((h) => /^progress$/i.test(h));
    rows.push({
      agent: agentIdx >= 0 ? cells[agentIdx] : "",
      progressOrStatus: progressIdx >= 0 ? cells[progressIdx] : "",
      cells,
    });
  }

  return { fileColumnIndex: fileColIdx >= 0 ? fileColIdx : null, rows };
}
