'use strict';
// Tests for .team-os/hooks/task-completed-gate.js
//
// Run:  node --test tests/hooks/task-completed-gate.test.js
//
// The hook runs as a real child process against a temporary project
// directory. Inputs mirror the documented TaskCompleted payload from the
// Claude Code hooks docs (common fields + task_id, task_subject, and the
// optional task_description / teammate_name / team_name). There is no
// summary, files or quality_gates field in that payload.
//
// TASK_COMPLETED_GATE=<path> runs the same suite against another copy of
// the hook (used to show the 40% regression on an older version).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GATE =
  process.env.TASK_COMPLETED_GATE ||
  path.join(__dirname, '..', '..', '.team-os', 'hooks', 'task-completed-gate.js');

const BOARD_40 = [
  '# Team Progress',
  '',
  '## Status Board',
  '',
  '| Teammate | Current Task | Progress | Last Update | Note |',
  '|----------|-------------|----------|-------------|------|',
  '| implementer | auth | 40% | 2026-09-24 08:00 | working |',
  '| decoy-other | docs | 10% | 2026-09-24 08:00 | working |',
  '',
  '## Checkpoints',
  '',
  '| # | Checkpoint | Condition | Done |',
  '|---|-----------|-----------|------|',
  '| 1 | Auth ready | implementer | [ ] |',
  '',
].join('\n');

const BOARD_FILES = [
  '# Team Progress',
  '',
  '## Status Board',
  '',
  '| Teammate | Current Task | Progress | Last Update | Files | Note |',
  '|---|---|---|---|---|---|',
  '| implementer | auth | 40% | 2026-09-24 08:00 | src/auth.js, src/db.js | working |',
  '| reviewer | review | 60% | 2026-09-24 08:00 | src/db.js | working |',
  '| finished-dev | docs | 100% | 2026-09-24 08:00 | src/auth.js | completed |',
  '',
].join('\n');

const DONE_ROW = /^\| implementer \| auth \| 100% \| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| completed \|$/;

// --- test utilities -------------------------------------------------------

function project(t, board) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-gate-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (board !== null) {
    fs.mkdirSync(path.join(dir, '.team-os', 'artifacts'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.team-os', 'artifacts', 'TEAM_PROGRESS.md'), board);
  }
  return dir;
}

function touch(dir, rel) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x');
}

function readBoard(dir) {
  return fs.readFileSync(path.join(dir, '.team-os', 'artifacts', 'TEAM_PROGRESS.md'), 'utf8');
}

function row(board, prefix) {
  return board.split('\n').find((l) => l.startsWith(prefix));
}

// Documented TaskCompleted payload (hooks docs example), cwd = the temp project.
function realInput(dir, overrides = {}) {
  return {
    session_id: 'abc123',
    transcript_path: '/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl',
    cwd: dir,
    permission_mode: 'default',
    hook_event_name: 'TaskCompleted',
    task_id: 'task-001',
    task_subject: 'Implement user authentication',
    task_description: 'Add login and signup endpoints',
    teammate_name: 'implementer',
    team_name: 'session-a1b2c3d4',
    ...overrides,
  };
}

function runGate(dir, input) {
  const r = spawnSync(process.execPath, [GATE], {
    cwd: dir,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// --- allow path -----------------------------------------------------------

test('documented input moves the teammate row from 40% to 100% completed', (t) => {
  // Break caught: returning before the Status Board update. The closed PR #2
  // blocked on a "summary" field that Claude Code never sends, so this row
  // stayed at 40% while the task itself still completed.
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
  const board = readBoard(dir);
  assert.match(row(board, '| implementer |'), DONE_ROW);
  assert.equal(row(board, '| decoy-other |'), '| decoy-other | docs | 10% | 2026-09-24 08:00 | working |');
});

test('an allowed completion prints nothing on stdout', (t) => {
  // Break caught: emitting a JSON "decision" object. TaskCompleted only
  // blocks on exit code 2; exit 0 alone means allow.
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});

test('rows outside the Status Board are never modified', (t) => {
  // Break caught: matching the teammate name anywhere in the file. The old
  // hook rewrote this checkpoint row's last cell to "completed".
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(row(readBoard(dir), '| 1 |'), '| 1 | Auth ready | implementer | [ ] |');
});

test('a Status Board row written as @name is updated', (t) => {
  // Break caught: dropping support for the "@name" style the old hook accepted.
  const board = BOARD_40.replace('| implementer | auth | 40% |', '| @implementer | auth | 40% |');
  const dir = project(t, board);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    row(readBoard(dir), '| @implementer |'),
    /^\| @implementer \| auth \| 100% \| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| completed \|$/
  );
});

test('without teammate_name the completion is allowed and the board is untouched', (t) => {
  // Break caught: crashing on the optional field, or updating a row for a
  // made-up name such as "unknown".
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir, { teammate_name: undefined }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readBoard(dir), BOARD_40);
});

test('a project without TEAM_PROGRESS.md still allows completion', (t) => {
  // Break caught: treating the missing board as an error.
  const dir = project(t, null);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
});

// --- check 1: required files named in task_description ---------------------

test('a missing required file blocks with exit 2 and names only the missing path', (t) => {
  // Break caught: allowing (exit 0), or signalling the block through JSON
  // on stdout instead of exit 2 + stderr.
  const dir = project(t, BOARD_40);
  touch(dir, 'src/auth.js');
  const r = runGate(dir, realInput(dir, {
    task_description: 'Add login and signup endpoints\nrequired_files: docs/auth.md, src/auth.js',
  }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /docs\/auth\.md/);
  assert.doesNotMatch(r.stderr, /src\/auth\.js/);
});

test('a blocked completion leaves the Status Board untouched', (t) => {
  // Break caught: updating the board before the checks. A blocked task is
  // not marked completed by Claude Code, so the board must not say it is.
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir, { task_description: 'required_files: docs/auth.md' }));
  assert.equal(r.status, 2);
  assert.equal(readBoard(dir), BOARD_40);
});

test('required files that all exist allow completion', (t) => {
  // Break caught: blocking whenever the marker is present.
  const dir = project(t, BOARD_40);
  touch(dir, 'docs/auth.md');
  touch(dir, 'src/auth.js');
  const r = runGate(dir, realInput(dir, {
    task_description: 'Add login and signup endpoints\nrequired_files: docs/auth.md, src/auth.js',
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(row(readBoard(dir), '| implementer |'), DONE_ROW);
});

test('the marker also works as a Markdown bullet with backticks', (t) => {
  // Break caught: a marker written in a common Markdown style being ignored.
  const dir = project(t, BOARD_40);
  touch(dir, 'out/a.md');
  const r = runGate(dir, realInput(dir, { task_description: '- Required files: `out/a.md`, `out/b.md`' }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /out\/b\.md/);
  assert.doesNotMatch(r.stderr, /out\/a\.md/);
});

test('required files are checked even without teammate_name', (t) => {
  // Break caught: running the checks only for team members.
  const dir = project(t, BOARD_40);
  const r = runGate(dir, realInput(dir, { teammate_name: undefined, task_description: 'required_files: docs/auth.md' }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /docs\/auth\.md/);
});

// --- check 2: same-file conflict on the Status Board Files column ----------

test('a file also held by an unfinished teammate blocks completion', (t) => {
  // Break caught: skipping the overlap check, or counting rows that are
  // already completed as conflicts.
  const dir = project(t, BOARD_FILES);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /src\/db\.js/);
  assert.match(r.stderr, /reviewer/);
  assert.doesNotMatch(r.stderr, /finished-dev/);
  assert.equal(readBoard(dir), BOARD_FILES);
});

test('files shared only with completed teammates do not block', (t) => {
  // Break caught: treating a completed row's files as still in use.
  const board = BOARD_FILES.replace(
    '| reviewer | review | 60% | 2026-09-24 08:00 | src/db.js | working |',
    '| reviewer | review | 100% | 2026-09-24 08:00 | src/db.js | completed |'
  );
  const dir = project(t, board);
  const r = runGate(dir, realInput(dir));
  assert.equal(r.status, 0, r.stderr);
  assert.match(
    row(readBoard(dir), '| implementer |'),
    /^\| implementer \| auth \| 100% \| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| src\/auth\.js, src\/db\.js \| completed \|$/
  );
});

// --- errors -----------------------------------------------------------------

test('malformed input is a non-blocking error (exit 1) and changes nothing', (t) => {
  // Break caught: exit 2 on an internal error would block every completion;
  // exit 0 would hide the error.
  const dir = project(t, BOARD_40);
  const r = runGate(dir, '{not json');
  assert.equal(r.status, 1);
  assert.notEqual(r.stderr.trim(), '');
  assert.equal(readBoard(dir), BOARD_40);
});
