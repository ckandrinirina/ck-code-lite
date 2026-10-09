---
name: start
description: Use when a project needs its ck-code-lite artifacts — creating docs/ARCHITECTURE.md and tasks/PLAN.md for a new idea, adopting an existing codebase into the workflow, or adding new tasks to an existing plan. Argument is an optional feature description or spec-file path.
argument-hint: "[feature description | path/to/spec.md]"
effort: medium
allowed-tools: Bash(git status*) Bash(git ls-files*) Bash(git rev-parse*) Bash(mkdir*) Bash(ls*) Bash(head*) Bash(node -e*) Bash(ck-lite*) Bash(npm view*) Bash(pip index*) Bash(cargo search*) Bash(go list*) Bash(gem search*) Bash(npx -y ctx7*) WebSearch mcp__context7__resolve-library-id mcp__context7__query-docs mcp__plugin_context7_context7__resolve-library-id mcp__plugin_context7_context7__query-docs Skill
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
Versions and idioms: [stack-research.md](../../references/stack-research.md).
Design state and the design-first offer: [design-system.md](../../references/design-system.md).
Output filtering (optional): [rtk.md](../../references/rtk.md).

## INPUT

`$ARGUMENTS` is an optional feature description or a path to a spec file.

- **A path that exists** — read it as the source of requirements.
- **Free text** — treat it as the requirement itself.
- **Empty** — `docs/design-brief.md` exists → it is the requirement (the user described the
  project in `/ck-code-lite:design` first). Otherwise ask for the goal in Phase 3, or in
  EXTEND mode list what is already planned and ask what to add.

## PHASE 0: PLUGIN GUARD

ck-code markers: !`cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && ls -d tasks/VERSION.md docs/architecture 2>/dev/null | grep . || echo none`

`none` → continue. Anything else (`tasks/VERSION.md` is ck-code's layout stamp,
`docs/architecture` its feature docs) is a full ck-code project, whose state ck-code-lite
cannot read or keep in step. Print exactly this, then **stop** before any read, write or
command, with no offer to continue anyway:

```
⛔ This is a ck-code project, not a ck-code-lite one.
   /ck-code-lite:start would write a second plan in tasks/PLAN.md beside the stories.
   Use /ck-code:plan (or /ck-code:guide to pick the step) instead.
```

## PHASE 1: MODE DETECT

```bash
ls docs/ARCHITECTURE.md tasks/PLAN.md 2>/dev/null
ls -d docs/design-system docs/design-brief.md 2>/dev/null; grep -h 'Claude Design:' docs/ARCHITECTURE.md 2>/dev/null
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

**NEW** — read the spec file if `$ARGUMENTS` was a path, else `docs/design-brief.md` when it
exists, plus `docs/design-system/index.md` when linked. Nothing else exists to read.

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

### 2.1 Stack research

Follow [stack-research.md](../../references/stack-research.md) for this mode: registry for the
version, context7 for the idioms, one lookup per technology, run in parallel. **NEW** runs it
once Phase 3 has settled the stack (straight away when `$ARGUMENTS` already names it); **ADOPT**
uses the installed versions; **EXTEND** only covers new technologies and lines that are not fresh (older than 90 days, or
marked `unverified`). These lookups do not count toward the five-read cap.

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
round is a defect, not diligence — with one exception, below.

### 3.1 Design first — always offered once

When the project has a human-facing visual surface (a web page, an app screen, a desktop UI —
not a CLI, library, daemon or pure API) and the design state from Phase 1 is `undecided`
([§ Design state](../../references/design-system.md#design-state)), the round **always**
includes this question, in every mode, even when nothing else is asked:

```
Question: Design the UI with Claude Design before building it?
Header:   Design
Options:
  - Design first (Recommended) — after the plan, I describe the product with you and write the
    prompt for claude.ai/design. UI tasks then build against its exact tokens and components.
  - I already have one — link my claude.ai/design design system (paste its URL as Other).
  - Skip — build the UI from the architecture doc alone.
```

It is one of the 4 questions, never a second round. `pending`, `linked` or `declined` → never
asked: the decision is made. The answer is applied in Phase 4 (`Skip`) and Phase 6 (the
other two).

## PHASE 4: WRITE ARCHITECTURE

**NEW / ADOPT** — write `docs/ARCHITECTURE.md` from
[architecture-template.md](references/architecture-template.md), with `## Commands`
filled from the Phase 2 resolution.

`## Stack` lines carry the version, the verified date and the idiom bullets from Phase 2.1, in
the format of [stack-research.md § The cache](../../references/stack-research.md#the-cache--stack).
EXTEND refreshes a stale line by `Edit`ing it in place.

In ADOPT mode, `## Stack` and `## Folder structure` describe what the survey actually
found. Do not invent structure the repository does not have, and do not propose a
restructure — this skill records reality, it does not reorganise it.

**`## Design`** — when the design state is not `undecided`, or Phase 3.1 was answered, the doc
carries the one-line `## Design` section after `## Conventions`, per
[§ Design state](../../references/design-system.md#design-state): `Skip` writes
`- Claude Design: none — declined at start`; an existing brief or cache writes `pending` or
`linked`. `Design first` and `I already have one` write nothing here — `/ck-code-lite:design`
sets the line in Phase 6.

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

Order tasks so dependencies flow forward, and record them in `needs`. A task that scaffolds
the project or adds a dependency names the version `## Stack` records in its acceptance — e.g.
`package.json declares react ^19.2` — so QA catches a scaffolder that pinned an older one.

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
**Stack:** <n> versions verified (<name> <version>, …) · <n> refreshed · <n> idioms unverified

**Design:** linked (<project>) | pending — brief docs/design-brief.md | none | n/a

Next: /ck-code-lite:build
```

### Design hand-off

Applies the Phase 3.1 answer, after the report, without asking again:

- **Design first** → invoke `/ck-code-lite:design` via the Skill tool, no argument. It reads the
  architecture and plan just written, describes the product with the user and writes the brief.
- **I already have one** → invoke `/ck-code-lite:design <the URL>` when the answer carried one,
  else `/ck-code-lite:design link` (the picker).
- **Skip**, not asked, or already decided → nothing. A `pending` design gets one line: the brief
  is at `docs/design-brief.md`, link it with `/ck-code-lite:design <url>` when ready.

If any command resolved to `(none)`, say so plainly here and note that `test: (none)`
will stop the first build until a test runner is chosen.

### Size check

`ck-lite stats` (already run in EXTEND; run it once now in NEW/ADOPT). Relay a `graduation:`
line (past 40 open tasks) as one line naming `/ck-code:migrate`; a `split:` line was acted on
in Phase 4 — report the area moved. Under both thresholds, print nothing: a size notice on a
small project is noise. Never a block — the user decides when to graduate.

## RULES

- **Never run in a full ck-code project** — Phase 0 stops on `tasks/VERSION.md` or
  `docs/architecture/` and names the `/ck-code:*` command to use instead.
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
- **Never skip the design-first question** (Phase 3.1) for a project with a visual surface and
  an `undecided` design state, and **never ask it again** once the state is `pending`, `linked`
  or `declined`.
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
- **Never write a version or an idiom from memory** — every `## Stack` version comes from the
  registry and every idiom bullet from context7 or the web (Phase 2.1). Neither reachable → mark
  the line `· idioms unverified` (or `— unverified` with no registry); a remembered "latest" is
  how a new project ships a major behind.
- **Never upgrade an installed dependency in ADOPT mode** — record the gap as a decision; the
  upgrade is a task the user asks for.
- **Never invent a command a manifest does not declare** — `(none)` is the correct answer
  when there is no command.
- **Never split the core below 150 lines, never rewrite text while moving it to an area doc,
  and never put an area doc under `docs/architecture/`** — that directory marks a ck-code
  project.
