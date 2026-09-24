#!/usr/bin/env node
/**
 * TaskCompleted Hook - task-completed-gate.js
 *
 * Claude Code's TaskCompleted hook input is the documented payload: the
 * common fields (cwd, session_id, ...) plus task_id, task_subject, and the
 * optional task_description / teammate_name / team_name. It does NOT
 * include a summary, files, or quality_gates field — those do not exist on
 * this event, so this hook never reads them.
 *
 * Two independent, opt-in checks run before a completion is allowed:
 *
 *   1. Required files named in task_description. A line such as
 *        required_files: docs/a.md, src/b.js
 *      (optionally prefixed with "- " or "* ", case-insensitive key written
 *      with an underscore so ordinary prose like "Required files: see below"
 *      is not a marker, and each path optionally wrapped in backticks) lists
 *      paths that must exist before the task can be marked done. Relative
 *      paths are resolved under the project (process.cwd()); absolute paths
 *      are checked as written. No such line anywhere in task_description means this
 *      check does nothing.
 *
 *   2. Same-file conflicts on the Status Board. If TEAM_PROGRESS.md has a
 *      "## Status Board" table with a Files/File column, a completing
 *      teammate whose Files overlap with an unfinished teammate's Files is
 *      blocked. No Files column on the table means this check does
 *      nothing.
 *
 * There is no check on the result/summary of the work itself: the
 * TaskCompleted payload carries no result text to inspect. That kind of
 * review belongs in SendMessage / TEAM_FINDINGS.md, not in this hook.
 *
 * Exit codes:
 *   0 - allowed. The teammate's own Status Board row (if any) is updated
 *       to 100% / completed. Nothing is printed on stdout.
 *   2 - blocked. Claude Code does not mark the task completed and feeds
 *       stderr back to the model. The board is left untouched.
 *   1 - internal error (bad JSON, unreadable board, etc). Non-blocking;
 *       surfaces as a hook error notification. The board is left
 *       untouched.
 *
 * Referenced by: .claude/settings.local.json hooks.TaskCompleted
 */

"use strict";

const fs = require("fs");
const path = require("path");

const PROGRESS_PATH = path.join(
  process.cwd(),
  ".team-os",
  "artifacts",
  "TEAM_PROGRESS.md"
);

function stripAt(name) {
  return String(name || "").replace(/^@/, "").trim();
}

function stripBackticks(s) {
  return s.replace(/^`+/, "").replace(/`+$/, "").trim();
}

function parseFileList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => stripBackticks(s.trim()))
    .filter((s) => s.length > 0);
}

function findRequiredFiles(taskDescription) {
  const files = [];
  const re = /^\s*(?:[-*]\s+)?required_files\s*:\s*(.+)$/i;
  for (const line of taskDescription.split("\n")) {
    const m = line.match(re);
    if (m) {
      files.push(...parseFileList(m[1]));
    }
  }
  return files;
}

// Split a "| a | b | c |" row into ["a", "b", "c"], dropping the empty
// leading/trailing cells produced by the boundary pipes.
function parseCells(line) {
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length && parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isSeparatorRow(cells) {
  return cells.every((c) => c.length > 0 && /^[-:]+$/.test(c));
}

// Locate the "## Status Board" section: { headerIdx, header, rows } where
// rows are { idx, cells } for each "|"-prefixed line after the header/
// separator, idx is the line's index in `lines` (for in-place updates).
function findStatusBoard(lines) {
  let boardStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## Status Board") {
      boardStart = i;
      break;
    }
  }
  if (boardStart === -1) return null;

  let boardEnd = lines.length;
  for (let i = boardStart + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      boardEnd = i;
      break;
    }
  }

  const tableLines = [];
  for (let i = boardStart + 1; i < boardEnd; i++) {
    if (lines[i].startsWith("|")) {
      tableLines.push({ idx: i, cells: parseCells(lines[i]) });
    }
  }
  if (tableLines.length === 0) return null;

  const header = tableLines[0];
  const rows = tableLines.slice(1).filter((r) => !isSeparatorRow(r.cells));
  return { header, rows };
}

function updateRowLine(line) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  let updated = line.replace(/\d+%/, "100%");
  updated = updated.replace(/\|([^|]*)\|(\s*)$/, "| completed |$2");
  updated = updated.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/, now);
  return updated;
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch (err) {
    console.error(`[task-completed-gate] Invalid JSON input: ${err.message}`);
    process.exit(1);
    return;
  }

  try {
    const teammateName = hookData.teammate_name;
    const taskDescription = hookData.task_description;

    // Check 1: required files named in task_description.
    if (typeof taskDescription === "string") {
      const requiredFiles = findRequiredFiles(taskDescription);
      const missing = requiredFiles.filter(
        (f) => !fs.existsSync(path.resolve(process.cwd(), f))
      );
      if (missing.length > 0) {
        console.error(
          `[task-completed-gate] Missing required file(s) — create them before completing this task: ${missing.join(", ")}`
        );
        process.exit(2);
        return;
      }
    }

    const hasBoard = fs.existsSync(PROGRESS_PATH);
    let boardContent = null;
    let lines = null;
    let board = null;

    if (hasBoard) {
      boardContent = fs.readFileSync(PROGRESS_PATH, "utf8");
      lines = boardContent.split("\n");
      board = findStatusBoard(lines);
    }

    // Check 2: same-file conflicts on the Status Board Files column.
    if (teammateName && hasBoard && board) {
      const filesColIdx = board.header.cells.findIndex((c) => /^files?$/i.test(c));
      if (filesColIdx !== -1) {
        const progressColIdx = board.header.cells.findIndex((c) => /^progress$/i.test(c));
        const lastColIdx = board.header.cells.length - 1;

        const completerRow = board.rows.find(
          (r) => stripAt(r.cells[0]) === teammateName
        );

        if (completerRow) {
          const completerFiles = parseFileList(completerRow.cells[filesColIdx]);
          const conflicts = []; // { file, teammate }

          for (const r of board.rows) {
            const rowName = stripAt(r.cells[0]);
            if (rowName === teammateName) continue;

            const notDone =
              progressColIdx === -1 || r.cells[progressColIdx] !== "100%";
            const lastCell = r.cells[lastColIdx] || "";
            const isCompleted = /completed/i.test(lastCell);
            const unfinished = notDone && !isCompleted;
            if (!unfinished) continue;

            const rowFiles = parseFileList(r.cells[filesColIdx]);
            const overlap = rowFiles.filter((f) => completerFiles.includes(f));
            for (const f of overlap) {
              conflicts.push({ file: f, teammate: rowName });
            }
          }

          if (conflicts.length > 0) {
            const details = conflicts
              .map((c) => `${c.file} (held by ${c.teammate})`)
              .join(", ");
            console.error(
              `[task-completed-gate] File conflict — these files are still in progress with another teammate: ${details}`
            );
            process.exit(2);
            return;
          }
        }
      }
    }

    // Update: mark the completing teammate's own Status Board row done.
    if (teammateName && hasBoard && board) {
      let changed = false;
      for (const r of board.rows) {
        if (stripAt(r.cells[0]) === teammateName) {
          lines[r.idx] = updateRowLine(lines[r.idx]);
          changed = true;
        }
      }
      // Rewrite only when a row changed, so a teammate without a row never
      // races another teammate's update of the same file.
      if (changed) fs.writeFileSync(PROGRESS_PATH, lines.join("\n"), "utf8");
    }

    process.exit(0);
  } catch (err) {
    console.error(`[task-completed-gate] Error: ${err.message}`);
    process.exit(1);
  }
});
