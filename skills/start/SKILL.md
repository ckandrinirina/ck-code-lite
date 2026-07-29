---
name: start
description: Use when a project needs its ck-code-lite artifacts — creating docs/ARCHITECTURE.md and tasks/PLAN.md for a new idea, adopting an existing codebase into the workflow, or adding new tasks to an existing plan. Argument is an optional feature description or spec-file path.
argument-hint: "[feature description | path/to/spec.md]"
effort: medium
---

# Start — Architecture and Plan in One Pass

Produces the only two files this workflow needs: `docs/ARCHITECTURE.md` (stack,
structure, decisions, commands) and `tasks/PLAN.md` (a flat list of small tasks with
acceptance criteria). One pass, one question round, no subagents.

Format contract: [plan-format.md](../../references/plan-format.md).
Command resolution: [stack-commands.md](../../references/stack-commands.md).

## INPUT

`$ARGUMENTS` is an optional feature description or a path to a spec file.

- **A path that exists** — read it as the source of requirements.
- **Free text** — treat it as the requirement itself.
- **Empty** — ask for the goal in Phase 3, or in EXTEND mode list what is already planned
  and ask what to add.

## PHASE 1: MODE DETECT

```bash
ls docs/ARCHITECTURE.md tasks/PLAN.md 2>/dev/null
ls package.json Cargo.toml pyproject.toml go.mod Gemfile composer.json CMakeLists.txt 2>/dev/null
```

| Condition | Mode |
|---|---|
| `tasks/PLAN.md` exists | **EXTEND** — append tasks to the existing plan |
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

**EXTEND** — read `docs/ARCHITECTURE.md`, then the plan's **open rows only**:

```bash
grep -nE '^\| T-[0-9]+ \|.*\| (todo|doing|blocked) \|' tasks/PLAN.md
```

That is everything needed to avoid planning work already queued. `done` tasks are not
read: their titles cost a line each and change nothing about what to add next. Never read
`tasks/PLAN.md` whole, and never read the whole table.

In every mode, resolve `test` / `build` / `lint` using
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

**EXTEND** — targeted `Edit` of the affected sections only. A new feature typically adds
one line under `## Decisions` and sometimes a directory under `## Folder structure`.
Never `Write` over the file.

A decision that **reverses** an existing one folds into that line rather than appending
beside it, and one the toolchain now enforces is deleted — see the Decisions rules in
[architecture-template.md](references/architecture-template.md). This keeps the section
proportional to live choices, which matters because `build` reads the whole file every run.

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

**NEW / ADOPT** — write `tasks/PLAN.md` in the format from
[plan-format.md](../../references/plan-format.md).

**EXTEND** — find the highest existing ID and continue from it:

```bash
grep -o '^## T-[0-9]*' tasks/PLAN.md | tail -1
```

Append new rows to the end of the table and new sections to the end of the file. Never
renumber, never reorder, never rewrite an existing section — a task already in `doing`
or `done` is history.

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

### Graduation check

Both artifacts are read on every `build` run, so their size is a running cost. Measure
once, here:

```bash
grep -cE '^\| T-[0-9]+ \|.*\| (todo|doing|blocked) \|' tasks/PLAN.md
wc -l < docs/ARCHITECTURE.md
```

More than **40 open tasks**, or an architecture doc over **150 lines**, means the project
has outgrown a flat plan and a single doc. Add one line to the report saying so and naming
`/ck-code:migrate`, which converts both artifacts in place. Under both thresholds, print
nothing — a size notice on a small project is noise.

This is a notice, never a block. The user decides when to graduate.

## RULES

- **Never `Write` over an existing `docs/ARCHITECTURE.md` or `tasks/PLAN.md`** — always `Edit`.
  This single rule makes every re-run safe.
- **Never dispatch a subagent.** This skill is one pass; a dispatch costs more than the
  five reads it would save, and the clarify round needs that context resident.
- **Never ask more than one round of questions**, and never more than 4 questions in it.
- **Never ask what the manifest, README, or an existing architecture doc already answers.**
- **Never create a file under `tasks/` other than `PLAN.md`.** No epics, no per-task files,
  no index. If the project needs that structure, it has outgrown lite — install `ck-code`
  and run `/ck-code:migrate`, which converts this plan and architecture doc in place.
- **Never renumber or reorder existing tasks.** New IDs continue from the highest present.
- **Never write a task larger than M.** Split it.
- **Never write an acceptance criterion a test cannot assert.**
- **Never invent a command a manifest does not declare** — `(none)` is the correct answer
  when there is no command.
- **Never read `tasks/PLAN.md` whole, and never read the whole table** — open rows via the
  status-filtered `grep`, a single section via the `awk` extractor in
  [plan-format.md](../../references/plan-format.md).
