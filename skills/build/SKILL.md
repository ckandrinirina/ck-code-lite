---
name: build
description: Use when a task from tasks/PLAN.md needs implementing end-to-end with tests, when a task left in progress needs finishing, when several independent tasks can be built at once in isolated worktrees, or when the remaining plan should run in dependency-ordered waves. Argument is an optional task ID such as T-03, several IDs, or `--waves`; with no argument, picks interactively.
argument-hint: "[T-NN | T-NN T-NN … | --waves]"
disable-model-invocation: false
effort: high
---

# Build — One Task, Test First

Implements a task from `tasks/PLAN.md`: failing test, minimum code, cleanup, isolated QA,
manual sign-off, done. Four gates are non-negotiable and appear below in bold:
**clarify**, **RED**, **QA**, **manual test**.

Two or more tasks at once run through [PARALLEL MODE](#parallel-mode) — one worktree per
task, dependency-ordered waves — and every gate above still applies.

Format contract: [plan-format.md](../../references/plan-format.md).
Command resolution: [stack-commands.md](../../references/stack-commands.md).

## INPUT

`$ARGUMENTS` is empty, one task ID, several task IDs, or `--waves`.

- **One `T-NN`** — build that task through Phases 1–7. Validate it is ready; if it is
  blocked, name the blocking task and stop.
- **Two or more IDs** (`T-02 T-05`) — PARALLEL MODE, one wave.
- **`--waves`** — PARALLEL MODE over every non-`done` task, in dependency-ordered waves.
- **Empty** — list ready tasks and ask which one, offering the batch options when two or
  more are ready.

A dispatch prompt beginning `MODE: delegated` means this run **is** a worktree agent
inside someone else's parallel run — read DELEGATED MODE before Phase 2.

## PHASE 1: TASK SELECTION

Read the table only:

```bash
grep -n '^| T-' tasks/PLAN.md
```

No `tasks/PLAN.md` at all → stop and point at `/ck-code-lite:start`.

A task is **ready** when its status is `todo` and every ID in its `needs` list has status
`done`. Statuses come from the table rows just read — no other source.

- **Explicit IDs** — skip the menu. A single ID that is not ready → report which `needs`
  entries are outstanding and stop. Two or more IDs → PARALLEL MODE.
- **No argument, one ready task** — announce it and continue, no prompt.
- **No argument, several ready** — one `AskUserQuestion` listing each ready task with its
  size and title, plus two batch options: **build all N ready tasks in parallel** and
  **build the whole plan in waves**. Either batch answer enters PARALLEL MODE.
- **None ready** — report each `todo` task with its unfinished `needs`, and if every task
  is `done`, say so and suggest `/ck-code-lite:start` to add more.

One task in scope is never orchestrated — it takes Phases 2–7 below, inline.

## PHASE 2: CONTEXT AND THE PLAN/BRANCH GATE

### 2.1 Load context

Read `docs/ARCHITECTURE.md` — `## Commands` supplies the exact test, build and lint
commands used in Phases 3, 4 and 5. If `## Commands` is missing, resolve it now via
[stack-commands.md](../../references/stack-commands.md) and write it into the file.

Locate the chosen task's section and read **only** it:

```bash
grep -n '^## T-' tasks/PLAN.md
```

Read from that task's offset to the next `## T-` line. Never read the whole plan.

Then read the files listed in the task's `files:` field that already exist, plus the
nearest existing test file — its conventions govern the tests written in Phase 3.

### 2.2 The combined gate — ONE question call

**Exactly one `AskUserQuestion`, at most 4 questions**, carrying both concerns at once:

- Any genuine ambiguity in the acceptance criteria — only where two readings would
  produce materially different code. Skip if the criteria are unambiguous.
- The branch choice, always asked:
  - `New branch: task/T-NN-<slug>` (recommended)
  - `Stay on <current-branch>` — offered only when the current branch is not protected
  - `Adjust` — user names the branch

`main`, `master`, `develop` and `release/*` are **never** offered as a build target. If
the current branch is one of them, the only options are a new branch or an explicit
user-named branch.

Create the branch before writing anything:

```bash
git checkout -b task/T-NN-<slug>
```

### 2.3 Mark it started

Flip `todo → doing` in **both** the table row and the meta line, in one Edit pass, then
verify:

```bash
grep -n "T-NN" tasks/PLAN.md
```

Three hits, and the two status mentions agree.

## PHASE 3: RED — the failing test comes first

**No implementation file may be created or edited until a test run has been observed
failing.** This gate is absolute.

### 3.1 No test runner

If `## Commands` gives `test: (none)`, **stop here**. Present the choice:

- Name a test command for this project (then record it in `## Commands` and continue)
- Record a documented exception in the task's `### Notes` and proceed without RED

Never pick the second option on the user's behalf, and never proceed as though RED
happened when it did not.

### 3.2 Write the tests

At least one test per `### Acceptance` checkbox. Follow the conventions of the existing
test files — same framework, same naming, same directory layout. Add the obvious edge
case for each criterion (empty input, missing resource, boundary value) where one exists.

Tests assert observable behaviour, not implementation detail. A test that mirrors the
code line for line will pass a wrong implementation.

### 3.3 Confirm they fail

Run the `test` command. Report one line:

```
RED: 5 tests written, 5 failing — <first failure, one line>
```

A test that passes before any implementation exists is testing nothing. Fix it before
moving on.

## PHASE 4: GREEN AND CLEANUP

### 4.1 Green

Write the **minimum** code that makes the failing tests pass. Reuse what the codebase
already has before adding anything new — check for an existing helper, type or utility
first. Run the test command after each significant change. Stop as soon as everything
passes; do not build ahead of the criteria.

### 4.2 Track what was touched

Any file edited that is not already in the task's `files:` meta line gets appended to
that list, in the same Edit. The `files:` field is the record of what this task actually
changed, and QA reads it.

### 4.3 Cleanup

With tests green, one bounded pass: remove duplication introduced during 4.1, fix
misleading names, delete dead code, extract a function where one obviously wants to
exist. Re-run the tests after each change — green stays green throughout.

This is not an open refactor. Anything larger than a few minutes belongs in its own task.

## PHASE 5: QA — isolated

Delegate to the `ck-code-lite:qa-validator` subagent. Supply, inline in the prompt:

- The task ID and its acceptance criteria as literal text
- The task's `files:` list
- The exact ordered command list from `## Commands`, skipping any that are `(none)`
- The working directory

The agent returns a per-criterion verdict and one line: `QA: PASS` or
`QA: FAIL — <command> — <excerpt>`. Never ask it for full output; never run the suite
inline in this context — that is the entire point of delegating it.

**Iteration cap 3.** On `QA: FAIL`, fix the specific failure and re-delegate. At the
third failed pass, stop and escalate with `AskUserQuestion`:

- `FIX MANUALLY` — hand back, leaving the task in `doing`
- `ACCEPT AS-IS` — record the shortfall in the task's `### Notes` and continue
- `ABORT` — revert the task to `todo` in both places and stop

Run the commands inline **only** if the `ck-code-lite:qa-validator` subagent type is
unregistered, and say so explicitly when that happens.

## PHASE 6: MANUAL TEST GATE

QA proves the tests pass. It does not prove the feature is usable. Present 2–4 concrete
steps derived from the acceptance criteria, plus one edge case worth poking:

```
## Try it

1. Run `pnpm dev` and open http://localhost:3000/login
2. Sign in with a valid account — you should land on the dashboard
3. Sign in with a wrong password — you should see an inline error, not a redirect
4. Edge case: submit with an empty password field
```

Then **one `AskUserQuestion` carrying both questions**:

- "Manual test result?" → `PASS` / `ISSUES`
- "Ship now?" → `SHIP` / `SKIP`

The second answer is used only when the first is `PASS`. Never split these into two
separate calls.

On `ISSUES`: capture what the user saw in the task's `### Notes`, write a regression test
that reproduces it, confirm it fails, apply the minimum fix, then **re-run Phase 5** —
QA is mandatory after every fix. Return to this gate. **Cap 3 cycles**, then escalate
with the same three options as Phase 5.

## PHASE 7: COMPLETE

Tick every `### Acceptance` and `### Tasks` checkbox that is genuinely satisfied. A
checkbox left unticked is a task that is not done — say so rather than ticking it.

Flip `doing → done` in **both** the table row and the meta line in one Edit, then verify:

```bash
grep -n "T-NN" tasks/PLAN.md
```

Print a short summary: what was built, files changed, tests added, QA verdict.

Then apply the Phase 6 ship answer without asking again — `SHIP` invokes
`/ck-code-lite:ship T-NN`, `SKIP` prints that command as the next step.

## PARALLEL MODE

Several tasks at once, each in its own git worktree. This context **decides, verifies and
merges** — it never writes code, never runs a suite, and never opens a source file. The
expensive work happens in agents whose contexts are discarded; this one is re-paid every
turn.

Planning algorithm, dispatch prompt, verdict schema and report shapes:
[parallel-dispatch.md](references/parallel-dispatch.md).

### P1 Freeze the target

```bash
git status --porcelain && git branch --show-current
```

A dirty tree or a detached HEAD stops the run. The current branch becomes `$TARGET`, the
one branch every worktree is cut from and merged back into — never a hardcoded `main`.

Then sweep worktrees left by earlier runs — see [worktree lifecycle](references/parallel-dispatch.md#worktree-lifecycle).
Any whose branch is already fully merged into `$TARGET` is stale: remove it here. One
holding unmerged commits is reported with its task ID and kept, never removed silently.

If `$TARGET` would be `main`, `master`, `develop` or `release/*`, ask first
(`AskUserQuestion`): `New branch: batch/<slug>` (recommended) or a user-named branch.
Create it and use it as `$TARGET`. Merged worktrees land there, never on a protected branch.

### P2 Plan the waves

Resolve the scope set, order it into waves by `needs`, then split each wave so no two
tasks in it share a declared `files:` path. Print the wave plan and the unschedulable
tasks with the reason each was excluded.

### P3 Confirm — ONE question call

**Exactly one `AskUserQuestion`, at most 4 questions**, covering the wave plan
(`PROCEED` / `DROP A TASK` / `ABORT`) and any genuine ambiguity in the scheduled tasks'
acceptance criteria. The dispatched agents have no user to ask, so ambiguity is resolved
here or not at all.

### P4 Mark and dispatch

Flip `todo → doing` for this wave's tasks — table rows and meta lines, one Edit — then
`grep -n` each ID to confirm three hits with agreeing statuses. **This context is the only
writer of `tasks/PLAN.md` for the whole run.**

Then dispatch every task of the wave in a **single message**, one `Agent` call each, so
they run concurrently. Per call: `isolation: "worktree"`, `subagent_type:
"general-purpose"`, name `task-T-NN`, and the dispatch prompt from
[parallel-dispatch.md](references/parallel-dispatch.md) carrying the acceptance criteria
and the `## Commands` values inline.

Model tier by reasoning difficulty, never by `size`: inherit by default, `haiku` for a
mechanical change, `opus` for novel algorithms, concurrency, or a security-critical path.

### P5 Integrity — derive done from git

The failure to catch is an agent that did nothing and reported success. Per returned
branch, run the integrity gate and classify:

- **✓ complete** — non-empty diff, no unexpected deletion, verdict `done`. QA-eligible.
- **◐ partial** — real commits, criteria outstanding. Resume the same agent with
  `SendMessage`; **cap 2 rounds**, then keep the branch and report it as too large.
- **🚫 blocked** — empty diff or an unexpected deletion. Excluded, branch kept, reported.

### P6 QA — one validator per branch

Dispatch one `ck-code-lite:qa-validator` per ✓ branch, all in a single message, each with
the task's criteria, its returned `files:` list, the ordered `## Commands`, and the
branch's worktree path from `git worktree list` as the working directory. A branch without
`QA: PASS` is held back from the merge, never merged and fixed later.

### P7 Merge, sign off, complete

Dry-run each eligible branch onto `$TARGET`, merge the clean ones in that order:

```bash
git merge --no-ff "<branch>" -m "feat(T-NN): <task title>"
```

A conflicting branch is reported and kept, never force-merged. Then run the **Phase 6
manual gate once for the wave** on `$TARGET` — the only place the merged work sits
together. `ISSUES` records what was seen in the offending task's `### Notes`, leaves that
task `doing`, and names `/ck-code-lite:build T-NN` as the way to finish it.

For every merged, signed-off task: tick the satisfied checkboxes, append the agent's
reported paths to `files:`, and flip `doing → done` in both places — one Edit per task,
`grep -n` verified. A held or reverted task stays `doing` and holds its dependents.

Then **retire that task's worktree in the same phase** — a worktree outlives its wave only
by omission. Confirm the branch is fully merged into `$TARGET`, then force-remove the
worktree and delete the branch ([worktree lifecycle](references/parallel-dispatch.md#worktree-lifecycle)).
Force is safe only after that confirmation: every commit already lives in `$TARGET`, so
nothing but untracked build output is discarded. A branch that is held, conflicted,
blocked or reverted keeps its worktree — that is the only state a resume can read from.

### P8 Next wave

Re-resolve the following wave from the freshly updated table and loop from P3.

When none remain, sweep before reporting: `git worktree prune`, then list what still
stands. Every surviving worktree must map to a task the report names as held, blocked or
conflicted, with its removal command printed. A worktree nobody can account for is a bug
in P7 — remove it and say so. Then print the batch report and point at
`/ck-code-lite:ship` for the merged work.

## DELEGATED MODE

Active only when the dispatch prompt begins `MODE: delegated`. The harness has already
placed this run in its own worktree on its own branch, and there is no user to ask.

| Phase | Change |
|---|---|
| 1 | Skipped — the task ID is given. |
| 2.2 | No branch question, no clarify question — the orchestrator asked both. An ambiguity that blocks progress returns `status: blocked`, it never guesses. |
| 2.3 | No `tasks/PLAN.md` edit — the orchestrator owns every status change. |
| 3–4 | Unchanged. RED still gates GREEN. Touched paths are reported in the verdict instead of appended to the plan. |
| 5 | Run the `## Commands` inline in this context; never delegate to `qa-validator` — the orchestrator runs it per branch. |
| 6 | Skipped — manual sign-off happens once on the target after merge. |
| 7 | No status flip, no ship. Commit inside this worktree after RED and again after GREEN, then return the verdict block. |

Uncommitted work cannot be merged and cannot be resumed. Commit messages are conventional
(`test(T-NN):`, `feat(T-NN):`) with no AI references.

## RULES

- **Never edit or create an implementation file before a test run has been observed
  failing.** If there is no test runner, stop and ask — never assume the exception.
- **Never mark a task `done` without a `QA: PASS`** or an explicitly recorded
  ACCEPT AS-IS decision.
- **Never skip the manual-test gate**, and never merge its two questions into separate calls.
- **Never proceed past an `ISSUES` answer without re-running QA.**
- **Never ask more than one question round in Phase 2**, and never more than 4 questions.
- **Never build on `main`, `master`, `develop`, or `release/*`.**
- **Never read `tasks/PLAN.md` whole** — the table via `grep`, the chosen section by offset.
- **Never change a status in one place only.** The table row and the meta line move
  together in one Edit, verified by `grep` in the same phase.
- **Never create a file under `tasks/` other than `PLAN.md`.**
- **Never run the full test suite in this context once QA is delegated** — the subagent
  absorbs that output so this context does not carry it.
- **Never write code beyond the acceptance criteria.** Anything extra is a new task.
- **Never commit or push here** — that is `/ck-code-lite:ship`. The one exception is
  DELEGATED MODE, which commits inside its own worktree because that is the only state
  the orchestrator can merge or resume. Pushing is never an exception.

### Parallel mode

- **Never let a dispatched agent write `tasks/PLAN.md`.** Two branches editing adjacent
  table rows conflict on merge; the orchestrator is the sole writer for the whole run.
- **Never dispatch two tasks that share a declared `files:` path in the same wave.**
- **Never orchestrate a single task** — one task in scope takes Phases 2–7 inline.
- **Never build, test, lint, or read source in the orchestrator context.** It sees
  statuses, counts, branch names and verdicts only.
- **Never trust an agent's self-report** — done is a non-empty diff plus a `QA: PASS`.
- **Never re-dispatch a ◐ partial task from scratch** — resume the same agent with
  `SendMessage`; a fresh worktree is only for an empty or errored one.
- **Never merge a branch that failed QA or conflicted**, and never into a protected
  branch — merge into the `$TARGET` frozen in P1.
- **Never skip the manual gate in parallel mode** — it runs once per wave on `$TARGET`.
- **Never leave a merged task's worktree standing.** Removal happens in P7 beside the
  status flip, not deferred to the end of the run. `git worktree prune` is not removal —
  it only clears records for directories that are already gone.
- **Never remove a worktree whose branch is not fully merged into `$TARGET`**, and never
  force-remove before `git branch --merged` has confirmed it — that discards work no
  commit holds.
- **Never end a run with an unexplained worktree.** Each one still standing is named in
  the report with its task, its reason, and the command that removes it.
- **Never remove a worktree from inside DELEGATED MODE** — an agent never cleans up its
  own or any sibling's; the orchestrator owns the whole lifecycle.
