---
name: build
description: Use when a task from tasks/PLAN.md needs implementing end-to-end with tests, or when a task left in progress needs finishing. Argument is an optional task ID such as T-03; with no argument, picks the next ready task interactively.
argument-hint: "[T-NN]"
disable-model-invocation: false
effort: high
---

# Build — One Task, Test First

Implements a single task from `tasks/PLAN.md`: failing test, minimum code, cleanup,
isolated QA, manual sign-off, done. Four gates are non-negotiable and appear below in
bold: **clarify**, **RED**, **QA**, **manual test**.

Format contract: [plan-format.md](../../references/plan-format.md).
Command resolution: [stack-commands.md](../../references/stack-commands.md).

## INPUT

`$ARGUMENTS` is an optional task ID such as `T-03`.

- **Provided** — build that task. Validate it is ready; if it is blocked, name the
  blocking task and stop.
- **Empty** — list ready tasks and ask which one.

## PHASE 1: TASK SELECTION

Read the table only:

```bash
grep -n '^| T-' tasks/PLAN.md
```

No `tasks/PLAN.md` at all → stop and point at `/ck-code-lite:start`.

A task is **ready** when its status is `todo` and every ID in its `needs` list has status
`done`. Statuses come from the table rows just read — no other source.

- **Explicit `T-NN`** — skip the menu. If it is not ready, report which `needs` entries
  are outstanding and stop.
- **No argument, one ready task** — announce it and continue, no prompt.
- **No argument, several ready** — one `AskUserQuestion` listing them with size and title.
- **None ready** — report each `todo` task with its unfinished `needs`, and if every task
  is `done`, say so and suggest `/ck-code-lite:start` to add more.

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
- **Never commit or push here** — that is `/ck-code-lite:ship`.
