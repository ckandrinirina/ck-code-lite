# Worktree policy

One rule decides every case below: **a worktree exists only to keep concurrent agents off
each other's files.** No concurrency, no worktree. It is not a safety measure, not a
staging area, and not a way to "keep the main checkout clean" — it is a concurrency
primitive with a real cost (a cold dependency install, a branch to merge, a directory to
retire) that buys nothing when nothing runs beside it.

Read by `start`, `build` and `ship`. The commands that implement the lifecycle live in
[parallel-dispatch.md](../skills/build/references/parallel-dispatch.md#worktree-lifecycle);
this file owns the rules.

## Who may create one

| Situation | Worktree |
|---|---|
| `/ck-code-lite:start` — NEW, ADOPT or EXTEND | **Never** |
| `/ck-code-lite:ship` — task-backed or standalone | **Never** |
| `/ck-code-lite:build` — one task, inline (Phases 2–7) | **Never** |
| `/ck-code-lite:build` — PARALLEL MODE, wave of exactly 1 (solo) | **Never** — main checkout on `$TARGET` |
| `/ck-code-lite:build` — PARALLEL MODE, wave of ≥ 2 (fan-out) | **One per dispatched task** |

Only the last row creates worktrees, only the `build` orchestrator creates them, and it
creates them one way: by passing `isolation: "worktree"` to `Agent`, so the harness owns
the directory and its lifecycle.

## Never enter one yourself

No skill in this plugin runs `git worktree add`, `EnterWorktree`, or any other manual
isolation step, and none accepts an offer of isolation from a general worktree convention.
An isolated workspace is the fan-out dispatcher's tool, not a default posture for a
session. If a run finds itself inside a worktree it did not dispatch, that is a defect:
stop and say where you are before writing anything.

The main agent works in the main checkout on the branch the user chose. A dispatched agent
works where the harness put it and never leaves — no `checkout -b`, `switch`, `rebase`,
`reset`, or `git worktree` command of its own, and it never removes a worktree, its own or
a sibling's.

## Return to base

A dispatched wave must leave the orchestrator exactly where it started. After every wave —
before any status flip is reported and before the run prints anything — prove it:

```bash
git rev-parse --show-toplevel    # must equal the $ROOT recorded at P1
git rev-parse --abbrev-ref HEAD  # must equal $TARGET
```

Either check failing is a hard stop for the run, not a warning. An orchestrator standing in
a worktree writes `tasks/PLAN.md` into a branch that will be deleted, and merges from the
wrong side; nothing later in the run can tell what was lost.

## Merge or account — no orphans

Every worktree a run creates is resolved **within that run**. A finished task's worktree is
merged into `$TARGET` and retired in the same phase as its status flip, never deferred to
the end. `git worktree prune` is not removal — it only forgets directories that are already
gone.

A worktree may survive the wave that created it in exactly three states, each of which
holds real work no commit in `$TARGET` yet contains:

| State | Why it survives |
|---|---|
| **held** | QA failed, or the task returned ◐ partial — the branch is the resume point |
| **conflicted** | the merge dry-run reported a conflict — resolving it is the user's call |
| **blocked** | empty diff, unexpected deletion, or branch drift — kept as evidence |

Nothing else survives. A run that ends with any of the three stops and asks the user what
to do with each one — merge it now, keep it deliberately, or discard it — and records the
answer. Finishing a run with an unexplained worktree, or with one silently left behind
because the report mentioned it, is the failure this policy exists to prevent.

Removal is gated on `git branch --merged "$TARGET"` naming the branch. `--force` is only
reached after that check passes, where it discards untracked build output and nothing else.
