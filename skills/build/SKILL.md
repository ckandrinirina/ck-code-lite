---
name: build
description: Use when a task from tasks/PLAN.md needs implementing end-to-end with tests, when a task left in progress needs finishing, when several independent tasks can be built at once in isolated worktrees, or when the remaining plan should run in dependency-ordered waves. Argument is an optional task ID such as T-03, several IDs, or `--waves`; with no argument, picks interactively.
argument-hint: "[T-NN | T-NN T-NN … | --waves]"
effort: high
allowed-tools: Bash(git status*) Bash(git diff*) Bash(git log*) Bash(git branch*) Bash(git rev-parse*) Bash(git checkout*) Bash(git switch*) Bash(git add*) Bash(git commit*) Bash(git merge*) Bash(git worktree*) Skill
---

# Build — One Task, Test First

Implements a task from `tasks/PLAN.md`: failing test, minimum code, cleanup, isolated QA,
manual sign-off, done. Four gates are non-negotiable and appear below in bold:
**clarify**, **RED**, **QA**, **manual test**.

Two or more tasks at once run through [PARALLEL MODE](#parallel-mode) — dependency-ordered
waves, a worktree per task only where tasks run beside each other — and every gate above
still applies.

**A single task never gets a worktree.** Phases 2–7 run inline, in the checkout this skill
was invoked from, on a branch created in place. Isolation is only ever cut for tasks that
run *concurrently*, which is one wave shape of PARALLEL MODE and nothing else — the full
contract, including who returns where and what may never be left behind, is
[worktree-policy.md](../../references/worktree-policy.md).

Format contract: [plan-format.md](../../references/plan-format.md).
Command resolution: [stack-commands.md](../../references/stack-commands.md).

## INPUT

`$ARGUMENTS` is empty, one task ID, several task IDs, or `--waves`.

- **One `T-NN`** — build that task through Phases 1–7. Validate it is ready; if it is
  blocked, name the blocking task and stop.
- **Two or more IDs** (`T-02 T-05`) — PARALLEL MODE, one wave.
- **`--waves`** — PARALLEL MODE over every non-`done` task, in dependency-ordered waves.
  It **always** orchestrates, even when only one task remains: that wave is dispatched
  solo to an agent in the main checkout, never built inline here.
- **Empty** — list ready tasks and ask which one, offering the batch options when two or
  more are ready.

A dispatch prompt beginning `MODE: delegated` means this run **is** a worktree agent
inside someone else's parallel run — read DELEGATED MODE before Phase 2.

## PHASE 1: TASK SELECTION

Read the **open rows only** — never the whole table:

```bash
grep -nE '^\| T-[0-9]+ \|.*\| (todo|doing|blocked) \|' tasks/PLAN.md
```

No `tasks/PLAN.md` at all → stop and point at `/ck-code-lite:start`. No output → every
task is `done`; say so and suggest `/ck-code-lite:start` to add more.

A task is **ready** when its own row says `todo` and **no ID in its `needs` appears in the
open set** — by the open-set invariant in [plan-format.md](../../references/plan-format.md),
an ID absent from that set is `done`. This set is the only status source; never widen the
grep to recover `done` rows.

Before treating an absent `needs` ID as done, confirm it exists at all:

```bash
grep -cE "^(\| T-04 \||## T-04 |T-04 · )" tasks/PLAN.md
```

`3` is a satisfied dependency. `0` is a corrupt plan — report it and stop.

- **Explicit IDs** — skip the menu. A single ID that is not ready → report which `needs`
  entries are outstanding and stop. Two or more IDs → PARALLEL MODE.
- **No argument, one ready task** — announce it and continue, no prompt.
- **No argument, several ready** — one `AskUserQuestion` listing each ready task with its
  size and title, plus two batch options: **build all N ready tasks in parallel** and
  **build the whole plan in waves**. Either batch answer enters PARALLEL MODE.
- **None ready** — report each `todo` task with its unfinished `needs`.

One **explicitly chosen** task — a `T-NN` argument, or a single task picked from the menu —
takes Phases 2–7 below, inline. `--waves` is the exception: it orchestrates whatever it
finds, and a wave that holds one task is dispatched solo (P4), not built here.

**Graduation check.** If the open set holds more than 40 tasks, say so once, plainly:
lite carries the whole plan in one flat file, and past that size `ck-code`'s epics and
generated indexes cost less to work with. Point at `/ck-code:migrate`, then continue with
the build — this is a notice, never a block.

## PHASE 2: CONTEXT AND THE PLAN/BRANCH GATE

### 2.1 Load context

Read `docs/ARCHITECTURE.md` — `## Commands` supplies the exact test, build and lint
commands used in Phases 3, 4 and 5. If `## Commands` is missing, resolve it now via
[stack-commands.md](../../references/stack-commands.md) and write it into the file.

Extract the chosen task's section and nothing else — one command, no offsets, no `Read`:

```bash
awk '/^## T-05 /{f=1} f&&/^## T-/&&!/^## T-05 /{exit} f' tasks/PLAN.md
```

Substitute the real ID in both places, keeping the trailing space that separates `T-05`
from `T-050`. Never read the whole plan, and never list every `## T-` header to find an
offset — that output grows with every task ever written.

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

Create the branch **in place**, before writing anything — one command, no isolation step
before or after it:

```bash
git checkout -b task/T-NN-<slug>
```

Nothing else moves the working tree for the rest of the run. This is a single task with no
peer, so there is nothing to isolate from; a worktree here would only strand the work
where Phases 5–7 cannot reach it.

### 2.3 Mark it started

Flip `todo → doing` in **both** the table row and the meta line, in one Edit pass, then
verify with the anchored check:

```bash
grep -nE "^(\| T-05 \||## T-05 |T-05 · )" tasks/PLAN.md
```

Exactly three hits, and the table row and meta line report the same status.

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
grep -nE "^(\| T-05 \||## T-05 |T-05 · )" tasks/PLAN.md
```

Print a short summary: what was built, files changed, tests added, QA verdict.

Then apply the Phase 6 ship answer without asking again — `SHIP` invokes
`/ck-code-lite:ship T-NN`, `SKIP` prints that command as the next step.

## PARALLEL MODE

Tasks dispatched wave by wave. This context **decides, verifies and merges** — it never
writes code, never runs a suite, and never opens a source file. The expensive work happens
in agents whose contexts are discarded; this one is re-paid every turn.

**Every task in this mode is implemented by a dispatched agent — never inline here.**

**Isolation follows wave width, not mode.** A wave of **≥ 2** tasks fans out one worktree
agent per task (`isolation: "worktree"`), then merges the branches. A wave of **exactly
one** task is dispatched **solo**: one agent in the **main checkout** on `$TARGET`, no
worktree, no branch to merge. A worktree exists to keep concurrent agents off each other's
files; with no peer there is nothing to isolate from, and the cold dependency install it
forces is pure cost.

**This context never leaves the main checkout.** It dispatches isolation, it never enters
it: no `git worktree add`, no `EnterWorktree`, no `checkout` away from `$TARGET` for the
whole run. Every worktree it creates is merged and retired, or explicitly accounted for at
P8 — [worktree-policy.md](../../references/worktree-policy.md).

Planning algorithm, dispatch prompts, verdict schema and report shapes:
[parallel-dispatch.md](references/parallel-dispatch.md).

### P0 Context budget

A waves run is a loop, and everything this context reads stays in it for every later wave.
Four limits keep the run bounded, and all four are enforced, not advisory:

- **Wave width ≤ 4.** A wave resolving wider is split — the surplus tasks slide to the next
  wave in ID order. Announce the split.
- **Read criteria one wave at a time**, for that wave's IDs only, with the wave-scoped
  extractor in [parallel-dispatch.md](references/parallel-dispatch.md). Never pull the
  criteria of tasks scheduled for a later wave — most runs never reach them at their
  current shape.
- **One ledger line per finished task, then drop the detail.** A wave's verdicts, QA lines,
  merge output and worktree paths collapse into a single row each (see the ledger format in
  [parallel-dispatch.md](references/parallel-dispatch.md)). Never re-print a previous wave's
  table; the final report is built from the ledger.
- **Checkpoint every 3 waves.** After the third wave — and every third one after — print
  the ledger and ask (`AskUserQuestion`): `CONTINUE` or `STOP HERE`. Status lives in
  `tasks/PLAN.md`, so `/ck-code-lite:build --waves` resumes exactly where a stop left off,
  in a fresh context, with nothing lost.

### P1 Freeze the target

```bash
git status --porcelain && git branch --show-current && git rev-parse --show-toplevel
```

A dirty tree or a detached HEAD stops the run. The current branch becomes `$TARGET`, the
one branch every worktree is cut from and merged back into — never a hardcoded `main`. The
toplevel path becomes `$ROOT`, the directory this context must still be standing in at the
end of every wave. Both are recorded once and never re-derived: a value read again later
would report wherever the run has drifted to, which is exactly what the check exists to
catch.

Then sweep worktrees left by earlier runs — see [worktree lifecycle](references/parallel-dispatch.md#worktree-lifecycle).
Any whose branch is already fully merged into `$TARGET` is stale: remove it here. One
holding unmerged commits is reported with its task ID and kept, never removed silently.

If `$TARGET` would be `main`, `master`, `develop` or `release/*`, ask first
(`AskUserQuestion`): `New branch: batch/<slug>` (recommended) or a user-named branch.
Create it and use it as `$TARGET`. Merged worktrees land there, never on a protected branch.

### P2 Plan the waves

Resolve the scope set, order it into waves by `needs`, split each wave so no two tasks in
it share a declared `files:` path, then apply the **P0 width cap of 4**. Print the wave
plan and the unschedulable tasks with the reason each was excluded.

Plan the shape, not the content: this step reads the status/`needs`/`files` greps only.
Acceptance criteria are read per wave at P3, never here.

### P3 Confirm — ONE question call

Read **this wave's** acceptance criteria now — wave-scoped extractor, that wave's IDs only.
Then **exactly one `AskUserQuestion`, at most 4 questions**, covering the wave plan
(`PROCEED` / `DROP A TASK` / `ABORT`) and any genuine ambiguity in those criteria. The
dispatched agents have no user to ask, so ambiguity is resolved here or not at all.

### P4 Mark and dispatch

Flip `todo → doing` for this wave's tasks — table rows and meta lines, one Edit — then run
the anchored three-line check per ID to confirm three hits with agreeing statuses. **This
context is the only writer of `tasks/PLAN.md` for the whole run.**

Both shapes use `subagent_type: "general-purpose"`, the stable name `task-T-NN` so a
partial return can be resumed with `SendMessage`, and the dispatch prompt from
[parallel-dispatch.md](references/parallel-dispatch.md) carrying the acceptance criteria
and the `## Commands` values inline. Announce the decision before dispatching.

**Fan-out — wave of ≥ 2.** Dispatch every task in a **single message**, one `Agent` call
each with `isolation: "worktree"`, so they run concurrently.
`Fan-out: N tasks → dispatching N worktree agents.`

**Solo — wave of exactly 1.** No worktree and no task branch: the agent works in the main
checkout on `$TARGET`, which P1 already froze as unprotected and clean, so its commits land
where the merge would have put them anyway. Before dispatching, record the baseline —
`git rev-parse HEAD` — because P5 has no second branch to diff against. Then one `Agent`
call with **no `isolation` field** and the branch guard from
[parallel-dispatch.md](references/parallel-dispatch.md#solo-dispatch-wave-of-exactly-1).
`Solo: 1 task → dispatching 1 agent on <$TARGET> (no worktree).`

The branch is the agent's alone until it returns: never edit files in this context while a
solo agent runs, and never dispatch one while a fan-out wave is still in flight.

Model tier by reasoning difficulty, never by `size`: inherit by default, `haiku` for a
mechanical change, `opus` for novel algorithms, concurrency, or a security-critical path.

### P5 Integrity — derive done from git

The failure to catch is an agent that did nothing and reported success. Per returned
branch — or, solo, against the P4 baseline SHA — run the integrity gate and classify:

- **✓ complete** — non-empty diff, no unexpected deletion, verdict `done`. QA-eligible.
- **◐ partial** — real commits, criteria outstanding. Resume the same agent with
  `SendMessage`; **cap 2 rounds**, then keep the branch and report it as too large.
- **🚫 blocked** — empty diff or an unexpected deletion. Excluded, branch kept, reported.

Solo adds one check: `git rev-parse --abbrev-ref HEAD` must still print `$TARGET`, and the
tree must be clean. A solo agent that moved branch or left work uncommitted is **🚫
blocked** — a hard stop for the run, not a resume, because its commits are somewhere this
context did not authorise.

### P6 QA — one validator per completed task

Dispatch one `ck-code-lite:qa-validator` per ✓ task, all in a single message, each with the
task's criteria, its returned `files:` list, the ordered `## Commands`, and a working
directory: the branch's worktree path from `git worktree list` (fan-out), or the main
checkout (solo). A fan-out branch without `QA: PASS` is held back from the merge, never
merged and fixed later. A solo task without `QA: PASS` has its work already on `$TARGET`
with nothing to withhold — do not advance to P8 past it; its dependents would build on
broken code.

### P7 Return to base, merge, sign off, complete

**Return to base first.** Before reading a verdict or touching a branch, prove this context
is still where P1 left it — `git rev-parse --show-toplevel` equals `$ROOT` and
`git rev-parse --abbrev-ref HEAD` equals `$TARGET`. If either differs, `git checkout
"$TARGET"` from `$ROOT` and re-check; if it still differs, stop the run and report where
this context is standing. Merging from inside a worktree merges the wrong way round, and
writing `tasks/PLAN.md` there writes it onto a branch about to be deleted.

Dry-run each eligible branch onto `$TARGET`, merge the clean ones in that order:

```bash
git merge --no-ff "<branch>" -m "feat(T-NN): <task title>"
```

A conflicting branch is reported and kept, never force-merged. A solo wave skips this
entirely — the work is already on `$TARGET` — and says so in one line
(`Merge: none needed (solo on <$TARGET>).`). Then run the **Phase 6
manual gate once for the wave** on `$TARGET` — the only place the wave's work sits
together, solo waves included. `ISSUES` records what was seen in the offending task's `### Notes`, leaves that
task `doing`, and names `/ck-code-lite:build T-NN` as the way to finish it.

For every signed-off task — merged, or solo and already on `$TARGET` — tick the satisfied
checkboxes, append the agent's reported paths to `files:`, and flip `doing → done` in both
places — one Edit per task,
anchored-grep verified. A held or reverted task stays `doing` and holds its dependents.

Then record the task's ledger line and drop the wave's detail from this context (P0).

Then **retire that task's worktree in the same phase** — a worktree outlives its wave only
by omission. A solo wave has none: `Cleanup: none (solo on <$TARGET>).` Confirm the branch is fully merged into `$TARGET`, then force-remove the
worktree and delete the branch ([worktree lifecycle](references/parallel-dispatch.md#worktree-lifecycle)).
Force is safe only after that confirmation: every commit already lives in `$TARGET`, so
nothing but untracked build output is discarded. A branch that is held, conflicted,
blocked or reverted keeps its worktree — that is the only state a resume can read from,
and P8 will make the user decide its fate before the run ends.

Close the wave by re-running the two return-to-base checks and reporting one line:
`Base: <$ROOT> on <$TARGET> · worktrees standing: N`. A wave that dispatched isolation and
did not clean up after itself is visible here, one wave later, instead of at the end of a
long run.

### P8 Next wave

Re-resolve the following wave from a freshly re-read open set and loop from P3 — the
status greps only, and this wave's criteria when P3 asks for them. At every third wave,
run the P0 checkpoint before looping.

When none remain, **reconcile before reporting** — the run does not end with work sitting
outside `$TARGET`.

Return to base one last time, then sweep: `git worktree prune`, list what still stands, and
check each surviving branch against `git branch --merged "$TARGET"`.

- **Merged but still standing** — a P7 miss. Retire it here and say so.
- **Unmerged** — it must map to a task the ledger names **held**, **conflicted** or
  **blocked**. One that maps to nothing is unaccounted work: never delete it, and never
  let it pass silently into the report.

If anything is still unmerged after that, **one `AskUserQuestion`** listing each worktree
with its task, its state and its commit count, offering:

- `MERGE NOW` — re-run QA on that branch, then P7's dry-run and merge; a conflict comes
  straight back here
- `KEEP` — a deliberate hand-off; the report prints the branch, the worktree path and
  `/ck-code-lite:build T-NN` as the way to finish it
- `DISCARD` — only for a 🚫 blocked branch whose diff is empty; force-remove and delete

The run may end with a worktree standing only through an explicit `KEEP`. Reaching the
final report with an unmerged worktree nobody chose to keep is the failure
[worktree-policy.md](../../references/worktree-policy.md) exists to prevent — treat it as a
stop, not a footnote.

Then print the batch report, naming every kept worktree with its removal command, and point
at `/ck-code-lite:ship` for the merged work.

## DELEGATED MODE

Active only when the dispatch prompt begins `MODE: delegated`. The run is already on the
branch it must work on — its own harness-created worktree (fan-out), or the branch the
orchestrator checked out in the main checkout (solo, where the prompt names it and asks for
the branch guard first). Either way the branch is not this run's to choose, and there is no
user to ask.

| Phase | Change |
|---|---|
| 1 | Skipped — the task ID is given. |
| 2.2 | No branch question, no clarify question — the orchestrator asked both. An ambiguity that blocks progress returns `status: blocked`, it never guesses. |
| 2.3 | No `tasks/PLAN.md` edit — the orchestrator owns every status change. |
| 3–4 | Unchanged. RED still gates GREEN. Touched paths are reported in the verdict instead of appended to the plan. |
| 5 | Run the `## Commands` inline in this context; never delegate to `qa-validator` — the orchestrator runs it per branch. |
| 6 | Skipped — manual sign-off happens once on the target after merge. |
| 7 | No status flip, no ship. Commit after RED and again after GREEN, then return the verdict block. |

Uncommitted work cannot be merged, cannot be resumed, and (solo) leaves the shared branch
dirty for the orchestrator. Never run `git checkout -b`, `switch -c`, `rebase`, `reset` or
any `git worktree` command — the branch is the orchestrator's to choose. Commit messages
are conventional (`test(T-NN):`, `feat(T-NN):`) with no AI references.

## RULES

- **Never edit or create an implementation file before a test run has been observed
  failing.** If there is no test runner, stop and ask — never assume the exception.
- **Never mark a task `done` without a `QA: PASS`** or an explicitly recorded
  ACCEPT AS-IS decision.
- **Never skip the manual-test gate**, and never merge its two questions into separate calls.
- **Never proceed past an `ISSUES` answer without re-running QA.**
- **Never ask more than one question round in Phase 2**, and never more than 4 questions.
- **Never build on `main`, `master`, `develop`, or `release/*`.**
- **Never create or enter a git worktree for a single task.** Phases 2–7 run inline in the
  checkout the skill was invoked from, on a branch created in place with `git checkout -b`.
  Isolation is only ever cut by the PARALLEL MODE orchestrator, for a wave of ≥ 2
  ([worktree-policy.md](../../references/worktree-policy.md)).
- **Never read `tasks/PLAN.md` whole, and never read the whole table** — open rows via the
  status-filtered `grep`, the chosen section via the `awk` extractor. Both cost the same at
  any plan size; a full-table read grows with every task ever written.
- **Never widen the open-work grep to recover `done` rows.** An ID absent from the open set
  is `done` — that invariant is what keeps the read bounded.
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
- **Never orchestrate an explicitly chosen single task** — a `T-NN` argument or a single
  task picked from the menu takes Phases 2–7 inline. `--waves` is the exception: it always
  orchestrates, dispatching even a lone remaining task solo (P4).
- **Never build a task inline once PARALLEL MODE is entered** — every task goes to an
  agent, one-task waves included. That split is what keeps this context cheap.
- **Never cut a worktree for a one-task wave** — solo runs in the main checkout on
  `$TARGET`. Worktrees are for concurrency; with no peer they buy nothing and cost a cold
  dependency install.
- **Never dispatch solo without the branch guard**, and never edit files here or leave a
  fan-out wave in flight while a solo agent runs — nothing else keeps it on `$TARGET`.
- **Never exceed a wave width of 4, and never skip the 3-wave checkpoint** (P0) — an
  unbounded waves run grows this context until the whole batch is at risk. A stop loses
  nothing: `tasks/PLAN.md` holds the status and `--waves` resumes from it.
- **Never read a later wave's acceptance criteria**, and never re-print a finished wave's
  report — one ledger line per task, then the detail is dropped.
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
- **Never enter a worktree from the orchestrator.** It dispatches isolation and stays in
  `$ROOT` on `$TARGET` for the whole run — no `git worktree add`, no `EnterWorktree`, no
  `checkout` away. Both values are verified at the start and end of every P7.
- **Never end a run with an unmerged worktree the user did not explicitly keep.** P8
  reconciles every survivor against `git branch --merged` and asks before the report — a
  named entry in the report is not an accounting; a `KEEP` answer is.
- **Never remove a worktree from inside DELEGATED MODE** — an agent never cleans up its
  own or any sibling's; the orchestrator owns the whole lifecycle.
