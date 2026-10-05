# PARALLEL MODE — the orchestrator

Read once, when `build` gets two or more task IDs, `--waves`, or a batch answer from the
Phase 1 menu. From here on this file is the procedure; the skill's Phases 2–7 never run in
this context.

This context **decides, verifies and merges**. It never writes code, never runs a suite, and
never opens a source file: the expensive work happens in agents whose contexts are discarded,
and this one is re-paid on every turn. Every task is built by a `ck-code-lite:task-builder`
agent, one-task waves included.

**Isolation follows wave width.** A wave of **≥ 2** fans out one agent per task with
`isolation: "worktree"` and merges the branches back. A wave of **exactly 1** is dispatched
**solo**: one agent in the main checkout on `$TARGET`, no worktree, nothing to merge — with no
peer there is nothing to isolate from, and a worktree's cold dependency install is pure cost.
This context **never enters isolation**: no `git worktree add`, no `EnterWorktree`, no checkout
away from `$TARGET`. Rules for who may create a worktree and what may outlive a run:
[worktree-policy.md](../../../references/worktree-policy.md).

## P0 Context budget — enforced, not advisory

- **Wave width ≤ 4** — `ck-lite waves` applies it.
- **Criteria one wave at a time**, for that wave's IDs only (`ck-lite criteria`), never a
  later wave's.
- **One ledger row per finished task**, then the wave's detail is dropped. Never re-print a
  finished wave; the final report is built from the ledger.
- **Checkpoint every 3 waves** — print the ledger, then `AskUserQuestion`: `CONTINUE` or
  `STOP HERE`. Status lives in `tasks/PLAN.md`, so `/ck-code-lite:build --waves` resumes in a
  fresh context with nothing lost.

## P1 Freeze the target

```bash
git status --porcelain -- . ':!tasks/PLAN.md' && git branch --show-current && git rev-parse --show-toplevel
```

Anything uncommitted besides `tasks/PLAN.md`, or a detached HEAD, stops the run: a worktree is
cut from the last commit, so uncommitted code or docs would be invisible to its agent. Say so
and point at `/ck-code-lite:ship`. `tasks/PLAN.md` alone may be dirty — this context writes it
throughout, and agents read it from `$ROOT`, never from their worktree. The branch becomes `$TARGET` and the toplevel
`$ROOT`, recorded once and never re-derived — a value read again later reports wherever the
run drifted to, which is what the checks exist to catch. On `main`, `master`, `develop` or
`release/*`, create `batch/<slug>` in place (`git checkout -b`) and announce it; that branch is
`$TARGET`, and merged work never lands on a protected branch.

List worktrees left by earlier runs — `ck-lite worktrees "$TARGET"` — and **report them only**:
branch, path, merged or unmerged, each with its removal command. This run did not create them,
so it never removes them; the user may have made them by hand.

## P2 Plan the waves

```bash
ck-lite waves T-02 T-05 T-06     # explicit IDs
ck-lite waves --all              # --waves
```

It orders the scope by `needs`, moves a task sharing a `files:` path with one already placed to
a later wave, caps each wave at 4, and lists every unschedulable task with its reason (not
`todo`, a need outside scope, a cycle, a corrupt entry). Print its output as the wave plan.
More than three waves means many sequential merge cycles — say so and offer a re-scope.

## P3 Confirm — one question call

`ck-lite criteria <this wave's IDs>` and, on the first wave, `ck-lite commands`. Then **exactly
one `AskUserQuestion`, at most 4 questions**:

- the wave — multi-select over its tasks, every one checked by default: unchecking drops a task
  from this run (it stays `todo`); unchecking all of them aborts
- `test: (none)`, first wave only — name a test command (written into `## Commands` before
  dispatch) or record a documented exception for the run (passed to every agent as settled)
- any genuine ambiguity in those criteria

The agents have no user to ask, so all of it is settled here or not at all, and each answer goes
into the matching dispatch prompt.

## P4 Mark and dispatch

`ck-lite set doing <this wave's IDs>` — one call, verified by the script. **This context is the
only writer of `tasks/PLAN.md` for the whole run**, and its edits stay uncommitted until `ship`.

Dispatch `subagent_type: "ck-code-lite:task-builder"`, `name: "task-T-NN"` (stable, so a
partial can be resumed), with the [dispatch prompt](#dispatch-prompt). Announce first.

- **Fan-out (≥ 2)** — every task in a **single message**, one `Agent` call each with
  `isolation: "worktree"`, so they run concurrently. `Fan-out: N tasks → N worktree agents.`
- **Solo (1)** — record `git rev-parse HEAD` as the baseline, then one `Agent` call with **no
  `isolation`**. `Solo: T-NN → 1 agent on <$TARGET> (no worktree).` Never edit files here, and
  never have a fan-out wave in flight, while a solo agent runs.

Model by reasoning difficulty, never by `size`: inherit by default, `haiku` for a mechanical
change, `opus` for novel algorithms, concurrency, or a security-critical path.

## P5 Integrity — derive done from git

The failure to catch is an agent that did nothing and reported success. The verdict is a hint;
git is the proof.

```bash
# fan-out, per returned branch
git diff --shortstat "$TARGET".."<branch>"                   # empty → 🚫 blocked
git diff --name-only --diff-filter=D "$TARGET".."<branch>"   # any → ⚠ unexpected deletion
# solo, against the P4 baseline
git diff --shortstat "<base-sha>"..HEAD
git diff --name-only --diff-filter=D "<base-sha>"..HEAD
git rev-parse --abbrev-ref HEAD                              # ≠ $TARGET → 🚫, stop the run
git status --porcelain -- . ':!tasks/PLAN.md'                # non-empty → 🚫, stop the run
```

- **✓ complete** — non-empty diff, no unexpected deletion, verdict `done`.
- **◐ partial** — real commits, criteria outstanding. Resume the same agent:
  `SendMessage(task-T-NN, "Continue the remaining criteria, commit each cycle, return the verdict block again.")` —
  **cap 2 rounds**, then keep the branch and report the task as too large.
- **🚫 blocked** — empty diff, an unexpected deletion, or a `blocked` verdict. Excluded, branch
  kept, reported with the agent's reason.

`tasks/PLAN.md` is excluded from the solo clean check because it holds this context's own
uncommitted status edits. A solo agent that moved branch or left anything else uncommitted is
a hard stop for the run, not a resume — its work is somewhere this context never authorised.

## P6 QA — one validator per complete task

One `ck-code-lite:qa-validator` per ✓ task, all in a single message, each with: the task ID
and criteria, the returned `files:`, the `## Commands` as `label=command` pairs (`(none)`
dropped), `reuse: no`, and the working directory — the branch's worktree path from
`git worktree list` (fan-out) or `$ROOT` (solo).

`reuse: no` always: an agent's own runs are never QA's evidence. A fan-out branch without
`QA: PASS` is **held** — never merged and fixed later. A solo task without `QA: PASS` already
sits on `$TARGET`; do not advance to the next wave past it, its dependents would build on
broken code.

## P7 Return to base, merge, sign off, complete

**Return to base first** — before reading a verdict or touching a branch:

```bash
ck-lite base "$ROOT" "$TARGET"
```

`DRIFTED` → `git -C "$ROOT" checkout "$TARGET"` and re-check; still `DRIFTED` → stop the run and
report where this context stands. Merging from inside a worktree merges the wrong way round.

**Merge** (fan-out only) — dry-run each eligible branch, fewest overlapping paths first, then
merge the clean ones:

```bash
ck-lite try-merge "<branch>"          # CLEAN or CONFLICT, always aborted
git merge --no-ff "<branch>" -m "feat(T-NN): <task title>"
```

A conflicting branch is reported and kept, never force-merged. Solo: `Merge: none needed (solo on <$TARGET>).`

**Verify the merged result** (fan-out, two or more branches merged) — each branch passed QA
alone; together they may not. One `ck-code-lite:qa-validator` on `$ROOT` with the full command
list, `reuse: no`, and the merged tasks' criteria. A `FAIL` stops the wave before the manual
gate: report which tasks merged, and leave them `doing` for `/ck-code-lite:build T-NN`.

**Manual gate, once for the wave**, on `$TARGET` — the build skill's Phase 6 steps for every
task, then one `AskUserQuestion` with one `PASS` / `ISSUES` question per task (at most 4, the
wave width). No ship question here: the run ends pointing at `ship`. `ISSUES` → `ck-lite note T-NN "<what the
user saw>"`, the task stays `doing`, and `/ck-code-lite:build T-NN` is named as the way to finish it.

**Complete** each signed-off task in one call — ticks its boxes, appends the verdict's paths,
flips it to done, verified by the script:

```bash
ck-lite done T-NN <paths from the verdict>
```

Record its ledger row and drop the wave's detail. Then **retire its worktree in the same
phase** — `ck-lite retire "$TARGET" "<branch>"`, which refuses unless the branch is fully merged
and never touches the main checkout. A worktree outlives its wave only by omission.
Close the wave with the return-to-base check and one line:
`Base: <$ROOT> on <$TARGET> · worktrees standing: N`.

## P8 Next wave, then reconcile

`ck-lite waves --next <remaining scope>` (or `--next --all`) gives the next wave from the plan
as it now stands; loop from P3. Every third wave, run the P0 checkpoint first.

When it prints nothing, run `ck-lite waves <remaining scope>` once more without `--next`: its
`Unschedulable` lines (dependents of a held or `ISSUES` task, for instance) go into the report,
each with its reason — a task never drops out of a run silently.

Then **reconcile before reporting**: return to base, `ck-lite worktrees "$TARGET"`, and classify
every worktree **this run created** (the ledger names each one):

| Survivor | Action |
|---|---|
| merged | retire it here — a P7 miss; say so |
| unmerged, ledger says held / conflicted / blocked | goes to the question below |
| unmerged, in no ledger row | unaccounted work — report it and stop; never delete |

A worktree in no ledger row that P1 already listed was there before the run: report it again,
never touch it.
Anything unmerged → **one `AskUserQuestion`** listing each worktree with its task, state and
commit count:

- `MERGE NOW` — re-run QA on it, then P7's dry-run and merge; a conflict comes back here
- `KEEP` — run `ck-lite-reclaim <path>…` first (drops rebuildable output such as `target/`,
  `node_modules/`; keeps source and commits) and put its `freed` line in the report
- `DISCARD` — only for a 🚫 blocked branch whose diff is empty

A run may end with a worktree standing only through an explicit `KEEP`. Then print the
[batch report](#ledger-and-report) and point at `/ck-code-lite:ship` for the merged work.

## Dispatch prompt

```
Task T-NN · placement: worktree            ← solo: "placement: solo on <TARGET>"

<ck-lite show T-NN output, verbatim>

Commands: test: <cmd> · test-one: <cmd or (none)> · build: <cmd> · lint: <cmd>
Context: CK_LITE_PLAN=<$ROOT>/tasks/PLAN.md CK_LITE_ARCH=<$ROOT>/docs/ARCHITECTURE.md ck-lite context T-NN
TDD rules: <absolute path of references/tdd-cycle.md>
Settled at P3: <the user's answer for this task, or "nothing">

Return only the verdict block.
```

The `tdd-cycle.md` path is this skill's base directory + `../../references/tdd-cycle.md`,
resolved to an absolute path once per run. The `Context` line points `ck-lite` at the main
checkout's files, which hold this run's status edits; a worktree's own copy is the last commit.

## Worktree lifecycle

Every git step with a safety rule is a `ck-lite` call, so the rule is code rather than prose:

| Call | Guarantee |
|---|---|
| `ck-lite worktrees "$TARGET"` | prunes stale records, never lists the main checkout; `merged` means 0 commits ahead of `$TARGET` |
| `ck-lite try-merge "<branch>"` | the dry run is always aborted, whatever its result |
| `ck-lite retire "$TARGET" "<branch>"` | removes only a linked worktree whose branch is fully merged, then `git branch -d`; a failure keeps both and says so |
| `ck-lite base "$ROOT" "$TARGET"` | exit 1 and the real location on drift |

A kept worktree is printed in the report with its removal command:
`git worktree remove --force <path> && git branch -D <branch>`.

## Ledger and report

One row per finished task, append-only, printed only at a checkpoint and at the end:

```
| W | Task | State | Commits | QA | Outcome |
|---|---|---|---|---|---|
| 1 | T-02 | ✓ | 3 | PASS | merged · worktree removed |
| 1 | T-05 | ◐ | 1 | — | held 1/3 · wt ../wt-T-05 |
| 2 | T-06 | ✓ | 2 | PASS | solo on batch/x · nothing to merge |
```

Checkpoint: `Waves 1–3 done · 5 done · 1 held · 4 remain (T-07 … T-10)`, then the question.
Final report: the ledger, then
`Merged into <$TARGET> · N kept · 0 stale worktrees · next: /ck-code-lite:ship`.

## Rules

- **Never build, test, lint, or read source in this context** — statuses, counts, branch names
  and verdicts only.
- **Never let an agent write `tasks/PLAN.md`** — two branches editing adjacent rows conflict on
  merge; this context is the sole writer.
- **Never dispatch two tasks that share a `files:` path in the same wave** — take the waves
  from `ck-lite waves`, never from a hand-worked order.
- **Never cut a worktree for a one-task wave**, and never dispatch solo without the branch
  check the agent runs first.
- **Never exceed a wave width of 4, skip the 3-wave checkpoint, or read a later wave's
  criteria.**
- **Never trust a self-report** — done is a non-empty diff plus a `QA: PASS` with `reuse: no`.
- **Never re-dispatch a ◐ partial from scratch** — resume it with `SendMessage`.
- **Never merge a branch that failed QA or conflicted**, and never into a protected branch.
- **Never skip the manual gate** — once per wave, on `$TARGET`.
- **Never leave a merged task's worktree standing**, and never remove one whose branch is not
  fully merged into `$TARGET` — retire through `ck-lite retire` only. `git worktree prune` is
  not removal.
- **Never remove a worktree this run did not create** — earlier ones are reported, never swept.
- **Never keep a worktree with its build output** — every `KEEP` goes through `ck-lite-reclaim`.
- **Never enter a worktree from this context**, and never end a run with an unmerged worktree
  the user did not explicitly keep.
