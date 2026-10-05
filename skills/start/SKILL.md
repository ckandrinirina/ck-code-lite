---
name: start
description: Use when a project needs its ck-code-lite artifacts — creating docs/ARCHITECTURE.md and tasks/PLAN.md for a new idea, adopting an existing codebase into the workflow, or adding new tasks to an existing plan. Argument is an optional feature description or spec-file path.
argument-hint: "[feature description | path/to/spec.md]"
effort: medium
allowed-tools: Bash(git status*) Bash(git ls-files*) Bash(git rev-parse*) Bash(mkdir*) Bash(ls*) Bash(head*) Bash(node -e*) Bash(ck-lite*) Skill
---

# Start — Architecture and Plan in One Pass

Produces the only two files this workflow needs: `docs/ARCHITECTURE.md` (stack,
structure, decisions, commands) and `tasks/PLAN.md` (a flat list of small tasks with
acceptance criteria). One pass, one question round, no subagents.

This skill writes two files in the checkout it was invoked from. It never branches, never
dispatches, and **never creates or enters a git worktree** — see
[worktree-policy.md](../../references/worktree-policy.md).

Format contract: [plan-format.md](../../references/plan-format.md) — every plan read and
write is a `ck-lite` call; this skill never `Read`s or `Edit`s `tasks/PLAN.md`.
Command resolution: [stack-commands.md](../../references/stack-commands.md).
Output filtering (optional): [rtk.md](../../references/rtk.md).

## INPUT

`$ARGUMENTS` is an optional feature description or a path to a spec file.

- **A path that exists** — read it as the source of requirements.
- **Free text** — treat it as the requirement itself.
- **Empty** — ask for the goal in Phase 3, or in EXTEND mode list what is already planned
  and ask what to add.

## PHASE 1: MODE DETECT

```bash
ls docs/ARCHITECTURE.md tasks/PLAN.md 2>/dev/null
ls package.json Cargo.toml pyproject.toml setup.py requirements.txt go.mod Gemfile composer.json CMakeLists.txt 2>/dev/null
```

| Condition | Mode |
|---|---|
| Both exist | **EXTEND** — append tasks to the existing plan |
| `tasks/PLAN.md` only | **EXTEND** — but Phase 2 runs the ADOPT survey too and Phase 4 writes `docs/ARCHITECTURE.md` from the template, since `build` cannot run without it |
| `docs/ARCHITECTURE.md` only | **EXTEND** — the doc is `Edit`ed, never rewritten; Phase 5 starts the plan with `ck-lite init` |
| No artifacts, a manifest or tracked source exists | **ADOPT** — describe what is already there, then plan forward |
| Neither | **NEW** — greenfield |

Announce the mode in one line, e.g. `Mode: ADOPT — package.json found, no plan yet.`

## PHASE 2: CONTEXT SCAN

Scope depends on the mode. **Hard cap: 5 file reads in this phase.**

**NEW** — read the spec file if `$ARGUMENTS` was a path. Nothing else exists to read.

**ADOPT** — a bounded survey, no more:

```bash
git ls-files | head -60
```

Then read the manifest, `README.md`, and at most one config file that materially changes
the picture (`tsconfig.json`, `pyproject.toml`, a framework config). Stop at five reads
even if curiosity says otherwise — the goal is an accurate `## Stack` and `## Commands`,
not a full understanding of the codebase.

**EXTEND** — read `docs/ARCHITECTURE.md` (the core only — an area doc is read when a new
task will work in that area; with no doc yet, run the ADOPT survey above instead), then, when
`tasks/PLAN.md` exists:

```bash
ck-lite open
ck-lite stats
```

Open work is everything needed to avoid planning what is already queued; `done` tasks are
never read. `stats` reports the core's size — past 150 lines, Phase 4 splits an area out.

In every mode, resolve `test` / `test-one` / `build` / `lint` using
[stack-commands.md](../../references/stack-commands.md), including the lockfile and
declared-scripts refinements.

## PHASE 3: CLARIFY — HARD GATE

**Exactly one `AskUserQuestion` call, at most 4 questions, and only on genuine ambiguity.**
It happens after the scan (so the questions are informed) and before anything is written.

Ask only where two reasonable readings would produce materially different work. Good
candidates:

- The scope boundary — what is explicitly out of this first pass
- A stack choice with no manifest to settle it (NEW mode only)
- Which of several plausible feature sets to build first
- A data or persistence decision the requirement leaves open

Never ask:

- Anything the manifest, lockfile, `README.md`, or an existing `docs/ARCHITECTURE.md`
  already answers
- For confirmation of something already stated in `$ARGUMENTS`
- Preference questions with an obvious default — pick the default and say so

**If nothing is genuinely ambiguous, skip this phase silently.** A ceremonial question
round is a defect, not diligence.

## PHASE 4: WRITE ARCHITECTURE

**NEW / ADOPT** — write `docs/ARCHITECTURE.md` from
[architecture-template.md](references/architecture-template.md), with `## Commands`
filled from the Phase 2 resolution.

In ADOPT mode, `## Stack` and `## Folder structure` describe what the survey actually
found. Do not invent structure the repository does not have, and do not propose a
restructure — this skill records reality, it does not reorganise it.

**EXTEND** — targeted `Edit` of the affected sections only (with no `docs/ARCHITECTURE.md` yet,
write it as NEW / ADOPT does). A new feature typically adds
one line under `## Decisions` and sometimes a directory under `## Folder structure`.
Never `Write` over the file.

A decision that **reverses** an existing one folds into that line rather than appending
beside it, and one the toolchain now enforces is deleted — see the Decisions rules in
[architecture-template.md](references/architecture-template.md). A decision only one area's
code obeys goes into that area's doc, not the core.

**Split when the core outgrows a page.** `ck-lite stats` past 150 lines → move the largest
self-contained area out, verbatim, into `docs/areas/<area>.md` and add its `## Areas` row,
following [architecture-template.md § Areas](references/architecture-template.md#areas). One
area per run, announced in the report. Never split below the threshold.

## PHASE 5: WRITE OR EXTEND PLAN

Break the work into tasks that are **S or M only**. A task is one coherent outcome a
single build run can finish: a failing test, the code, a QA pass. If a task needs more
than about eight implementation steps, split it before writing it.

Each task carries:

- A plain-language title describing the outcome, not the mechanism
- `### Acceptance` — checkboxes that are observably true or false. Every criterion must
  be something a test can assert.
- `### Tasks` — the implementation steps, first of which is always the failing tests
- `files:` — the paths expected to change, as a starting estimate

Order tasks so dependencies flow forward, and record them in `needs`.

**Order demo-first.** The first task makes the app run — its entry point (the `bin/`
script, the server, the page) is in that task's `files:` — and its user-facing surface (a
page, a screen, a command) show real-looking output from **fixture data behind one
adapter module** — no backend yet. Every remaining surface task comes next, each reading
its own fixture through that same seam. Backend tasks (API, datastore, external service)
come last, one per seam: each `needs` the surface task it serves, its acceptance re-runs
that surface's click path or command and sees real data, and the fixture is removed. A
fixture task with no replacing task in the same plan is a mock shipped to production —
add the replacement or drop the fixture. A criterion a human can only check with a manual
API client (Postman, curl) is a planning defect: the check belongs in the task's automated
tests, and the human check goes through the surface. A project with no human-facing
surface (a library, a daemon, a pure API) says so in one line and orders core code first.

Write the sections in the format from [plan-format.md](../../references/plan-format.md) and
hand them to `ck-lite`, which generates the table rows:

```bash
ck-lite init "Word count CLI"     # only when there is no tasks/PLAN.md yet — heading and empty table
ck-lite next-id                   # first free ID: T-01 on a new plan
ck-lite add <<'EOF'
## T-01 Count words in a file

T-01 · status: todo · size: S · needs: — · files: src/count.js, test/count.test.js

### Acceptance
- [ ] A file of three words reports 3

### Tasks
- [ ] Failing tests for the criterion
- [ ] Implement the counter
EOF
```

IDs continue from `next-id` in creation order, and a new task may `need` another new one. `add`
refuses the whole batch on a duplicate or out-of-order ID, an unknown `needs`, or a size other
than `S`/`M`, a title holding `|`, a self- or circular `needs`, or a body line shaped like a
plan row — fix the batch and pipe it again; nothing is written. Never renumber, never reorder,
never rewrite an existing section: a task already `doing` or `done` is history. A task added by
mistake that is still `todo` and that nothing `needs` is removed with `ck-lite drop T-NN`.

## PHASE 6: REPORT

Print:

```
## Started

**Mode:** NEW | ADOPT | EXTEND
**Architecture:** docs/ARCHITECTURE.md — created | updated (<sections touched>)
**Plan:** tasks/PLAN.md — <n> tasks created | <n> tasks appended (T-04 … T-07)
**Commands:** test: <cmd> · build: <cmd> · lint: <cmd>

Next: /ck-code-lite:build
```

If any command resolved to `(none)`, say so plainly here and note that `test: (none)`
will stop the first build until a test runner is chosen.

### Size check

`ck-lite stats` (already run in EXTEND; run it once now in NEW/ADOPT). Relay a `graduation:`
line (past 40 open tasks) as one line naming `/ck-code:migrate`; a `split:` line was acted on
in Phase 4 — report the area moved. Under both thresholds, print nothing: a size notice on a
small project is noise. Never a block — the user decides when to graduate.

## RULES

- **Never `Write` over an existing `docs/ARCHITECTURE.md`** — always `Edit` — and never
  `Read`, `Write` or `Edit` `tasks/PLAN.md`: `ck-lite init|add` are its only writers. This makes
  every re-run safe.
- **Never dispatch a subagent.** This skill is one pass; a dispatch costs more than the
  five reads it would save, and the clarify round needs that context resident.
- **Never create or enter a git worktree, and never create or switch a branch.** No
  `git worktree add`, no `EnterWorktree`, no isolation offered by any general worktree
  convention. Writing two files in the current checkout has nothing to isolate from, and a
  worktree here strands both artifacts on a branch the next `build` run never reads
  ([worktree-policy.md](../../references/worktree-policy.md)).
- **Never ask more than one round of questions**, and never more than 4 questions in it.
- **Never ask what the manifest, README, or an existing architecture doc already answers.**
- **Never create a file under `tasks/` other than `PLAN.md`.** No epics, no per-task files,
  no index, no archive. If the project needs that structure, it has outgrown lite — install `ck-code`
  and run `/ck-code:migrate`, which converts this plan and architecture doc in place.
- **Never renumber or reorder existing tasks.** New IDs continue from the highest present.
- **Never write a task larger than M.** Split it.
- **Never write an acceptance criterion a test cannot assert.**
- **Never plan a backend task before the surface that exercises it** (Phase 5) — the app
  runs on fixtures first; each backend task replaces one fixture and is verified through
  the surface already built, never through a manual API client.
- **Never invent a command a manifest does not declare** — `(none)` is the correct answer
  when there is no command.
- **Never split the core below 150 lines, never rewrite text while moving it to an area doc,
  and never put an area doc under `docs/architecture/`** — that directory marks a ck-code
  project.
