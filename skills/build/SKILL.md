---
name: build
description: Use when a task from tasks/PLAN.md needs implementing end-to-end with tests, when a task left in progress needs finishing, when several independent tasks can be built at once in isolated worktrees, or when the remaining plan should run in dependency-ordered waves. Argument is an optional task ID such as T-03, several IDs, or `--waves`; with no argument, picks interactively.
argument-hint: "[T-NN | T-NN T-NN … | --waves]"
effort: high
allowed-tools: Bash(git status*) Bash(git diff*) Bash(git log*) Bash(git branch*) Bash(git rev-parse*) Bash(git checkout*) Bash(git switch*) Bash(git add*) Bash(git commit*) Bash(git merge*) Bash(git worktree*) Bash(ck-lite*) Skill
---

# Build — One Task, Test First

Implements a task from `tasks/PLAN.md`: failing test, minimum code, cleanup, isolated QA,
manual sign-off, done. Four gates are non-negotiable and appear below in bold:
**clarify**, **RED**, **QA**, **manual test**.

**Two or more tasks** — two IDs, `--waves`, or a batch answer at Phase 1 — run through
PARALLEL MODE: `Read` [parallel-mode.md](references/parallel-mode.md) and follow it in place of
Phases 2–7. Every gate above still applies there.

**A single task never gets a worktree.** Phases 2–7 run inline, in the checkout this skill was
invoked from, on a branch created in place. Isolation is cut only for tasks that run
concurrently ([worktree-policy.md](../../references/worktree-policy.md)).

**Every plan access goes through `ck-lite`** — never `Read` or `Edit` `tasks/PLAN.md`
([plan-format.md](../../references/plan-format.md)). Every test, build and lint run goes
through `ck-lite-qa` ([tdd-cycle.md](../../references/tdd-cycle.md#running-tests)).

## INPUT

`$ARGUMENTS` is empty, one task ID, several task IDs, or `--waves`.

- **One `T-NN`** — Phases 1–7.
- **Two or more IDs, or `--waves`** — PARALLEL MODE. `--waves` always orchestrates, even when
  one task remains: that wave is dispatched solo, never built inline here.
- **Empty** — the Phase 1 menu.

## PHASE 1: TASK SELECTION

```bash
ck-lite open
```

One line per open task — `READY`, `wait(T-…)`, `doing`, `blocked` or `CORRUPT(…)` — then a
count line, and a `graduation:` line past 40 open tasks: relay it once, as a notice, and carry
on. No `tasks/PLAN.md` → point at `/ck-code-lite:start` and stop. `open 0` → every task is
done; suggest `/ck-code-lite:start` to add more. A `CORRUPT` task is reported with
`ck-lite check`'s detail and never built.

- **An explicit `READY` ID** — continue.
- **An explicit `doing` ID** — a task left in progress: resume it. Phase 2.3 is skipped, and
  Phase 3 starts by running the task's tests — criteria already covered by a test stay as
  they are, RED applies to every criterion not yet covered.
- **An explicit ID waiting or blocked** — name what it waits on and stop.
- **No argument, one `READY`** — announce it and continue, no prompt.
- **No argument, several `READY`** — one `AskUserQuestion` listing each with size and title,
  plus **build all N ready tasks in parallel** and **build the whole plan in waves**. Either
  batch answer enters PARALLEL MODE.
- **None ready** — report each `todo` task with what it waits on.

## PHASE 2: CONTEXT AND BRANCH

### 2.1 Load context — one call

```bash
ck-lite context T-05
```

It prints `docs/ARCHITECTURE.md`, the area docs whose paths the task's `files:` touch, and
the task's section. `## Commands` supplies every command used below. If it is missing,
resolve it now via [stack-commands.md](../../references/stack-commands.md) and write it into
`docs/ARCHITECTURE.md`.

Then read the files in `files:` that already exist, plus the nearest existing test file —
its conventions govern the tests written in Phase 3.

### 2.2 Branch — decided, announced, not asked

| Current branch | Action |
|---|---|
| `main`, `master`, `develop`, `release/*` | `git checkout -b task/T-NN-<slug>` |
| `task/T-NN-*` for this task | stay |
| anything else | stay — the user put the checkout there |

Announce it in one line: `Branch: task/T-05-missing-file (created from main)`. Nothing else
moves the working tree for the rest of the run.

### 2.3 Clarify — HARD GATE, only on genuine ambiguity

**At most one `AskUserQuestion`, at most 4 questions**, and only where two readings of the
acceptance criteria would produce materially different code. Unambiguous criteria → no
question at all; a ceremonial round is a defect.

### 2.4 Mark it started

```bash
ck-lite set doing T-05
```

## PHASES 3–4: RED, GREEN, CLEANUP

`Read` [tdd-cycle.md](../../references/tdd-cycle.md) and follow it whole: **RED** (no
implementation file before an observed failing test), GREEN, the bounded cleanup pass, and the
closing full `test` run. Inline, each touched path not yet in `files:` is recorded with
`ck-lite files T-05 <path>…`.

`test: (none)` stops at RED. Ask (`AskUserQuestion`): name a test command — record it in
`## Commands` and continue — or record a documented exception with `ck-lite note T-05 "<reason>"`
and proceed without RED. Never pick the exception on the user's behalf.

## PHASE 5: QA — isolated

Delegate to `ck-code-lite:qa-validator`, supplying inline:

- the task ID and its acceptance criteria as literal text
- its `files:` list
- the `## Commands` as ordered `label=command` pairs — `test`, `build`, `lint`, dropping `(none)`
- the working directory, and `reuse: yes`

`reuse: yes` lets it report the closing `test` run as `REUSED` when not a byte of code changed
since — that suite already passed on this exact state. Build and lint always run, and every
criterion is still mapped to its covering test.

**Iteration cap 3.** On `QA: FAIL`, fix the specific failure, re-run the task's tests and the
closing full `test`, and re-delegate. At the third failure, escalate (`AskUserQuestion`):

- `FIX MANUALLY` — hand back, task stays `doing`
- `ACCEPT AS-IS` — `ck-lite note T-05 "<the shortfall>"`, then continue
- `ABORT` — `ck-lite set todo T-05` and stop

Run the commands inline **only** if the qa-validator agent type is unregistered — still
through `ck-lite-qa` — and say so.

## PHASE 6: MANUAL TEST GATE

QA proves the tests pass, not that the feature is usable. Present 2–4 concrete steps derived
from the criteria, plus one edge case worth poking:

```
## Try it

1. Run `pnpm run dev` and open http://localhost:3000/login
2. Sign in with a valid account — you should land on the dashboard
3. Sign in with a wrong password — you should see an inline error, not a redirect
4. Edge case: submit with an empty password field
```

Then **one `AskUserQuestion` carrying both questions** — "Manual test result?" `PASS` /
`ISSUES`, and "Ship now?" `SHIP` / `SKIP` (used only on `PASS`).

`ISSUES` → `ck-lite note T-05 "<what the user saw>"`, write a regression test that reproduces
it, confirm it fails, apply the minimum fix, close with the full `test`, then **re-run Phase
5** — QA is mandatory after every fix. Back to this gate. **Cap 3 cycles**, then escalate with
Phase 5's three options.

## PHASE 7: COMPLETE

QA `PASS` and manual `PASS` — every criterion is met:

```bash
ck-lite done T-05
```

It ticks every box in the section and flips the task to `done`, verified. After `ACCEPT
AS-IS`, use `ck-lite set done T-05` instead: unmet boxes stay unticked, so the plan says what
was not delivered.

Print a short summary: what was built, files changed, tests added, QA verdict. Then apply the
ship answer without asking again — `SHIP` invokes `/ck-code-lite:ship T-NN`, `SKIP` prints
that command as the next step.

## RULES

- **Never edit or create an implementation file before a test run has been observed
  failing.** No test runner → stop and ask; never assume the exception.
- **Never mark a task `done` without a `QA: PASS`** or an explicitly recorded ACCEPT AS-IS.
- **Never skip the manual-test gate**, and never split its two questions into two calls.
- **Never proceed past an `ISSUES` answer without re-running QA.**
- **Never ask more than one clarify round**, never more than 4 questions, and never ask
  which branch — Phase 2.2 decides it.
- **Never build on `main`, `master`, `develop`, or `release/*`.**
- **Never create or enter a git worktree for a single task.** Isolation is only ever cut by
  the PARALLEL MODE orchestrator, for a wave of ≥ 2.
- **Never `Read` or `Edit` `tasks/PLAN.md`** — every read and write is a `ck-lite` call, whose
  cost is the same at any plan size and which keeps the row and meta line in step.
- **Never run a test, build or lint command outside `ck-lite-qa`**, and never pipe one into
  `tail`/`grep` — the log already holds the output; a second run to slice it is pure waste.
- **Never run the full suite in this context once QA is delegated** — beyond the one closing
  run, the subagent absorbs that output.
- **Never write code beyond the acceptance criteria.** Anything extra is a new task.
- **Never create a file under `tasks/` other than `PLAN.md`.**
- **Never commit or push here** — that is `/ck-code-lite:ship`.
