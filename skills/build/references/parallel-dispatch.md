# Parallel dispatch — planning, prompts, formats

Data and formats for `build`'s PARALLEL MODE. The skill owns the decisions; this file
owns the algorithm, the literal prompts, and the report shapes.

## Reading the plan for a batch

Two reads plan the whole batch, and **both are scoped to open work**. Never read `PLAN.md`
whole, and never read across `done` tasks — a batch can only ever schedule open ones, so a
finished task's row, meta line and criteria are all cost with no use.

```bash
grep -nE '^\| T-[0-9]+ \|.*\| (todo|doing|blocked) \|' tasks/PLAN.md   # id, status, size, needs
grep -nE '^T-[0-9]+ · status: (todo|doing|blocked) ·' tasks/PLAN.md    # meta lines — the files: scope
```

Both cost a function of open work, not of plan length: on a plan with 92 finished tasks and
9 open ones they return 9 lines each instead of 101.

Acceptance criteria are read **per wave, at P3, for that wave's IDs only** — never for the
whole scope up front. A wave is at most 4 tasks, so this read is bounded by wave width
rather than by how much open work exists, and a task re-planned before its wave arrives is
never paid for twice:

```bash
awk -v ids="T-02 T-05" 'BEGIN{n=split(ids,a," "); for(i=1;i<=n;i++) w[a[i]]=1}
     /^## T-/{t=$2; p=0}
     /^### Acceptance/{if(w[t]){p=1; print "== "t} next}
     /^### /{p=0}
     p&&/^- \[/{print}' tasks/PLAN.md
```

It prints the wave's acceptance criteria grouped by ID — the literal text the clarify gate
reads and the dispatch prompt quotes.

## Wave planning

Scope `S` is the explicit ID list, or the whole open set under `--waves`.

A `needs` entry is **satisfied** when it does not appear in the open set — by the open-set
invariant, absent means `done`. Every rule below reads against that set alone.

- **Wave 1** — tasks in `S` whose every `needs` entry is satisfied.
- **Wave k+1** — tasks whose every `needs` entry is satisfied or scheduled in a wave ≤ k.
- **Unschedulable** — a `needs` entry that is neither satisfied nor in `S`, a dependency
  cycle, or a `blocked` status. Excluded from every wave and reported at the end.

Then split each wave by declared file scope: walk the wave in ID order and move any task
that shares a `files:` path with a task already placed into the **next** wave. Two tasks
touching the same file are never dispatched together, whatever their `needs` say.

Finally apply the **width cap of 4**: a wave holding more keeps its first four in ID order
and pushes the rest to the next wave. Every task of a wave returns a verdict, a QA line and
a merge result into the orchestrator's context, and that context is re-paid on every later
wave — four is the point past which a long run starts paying for its own width.

```
## Wave plan

Wave 1 · T-02 Parse the config file      · files: src/config.js
        T-05 Add the --json flag         · files: src/cli.js
Wave 2 · T-06 Print parsed config as JSON · needs: T-02, T-05
Unschedulable · T-09 (needs T-08, not in scope)
```

More than three waves means many sequential merge cycles — say so and offer a re-scope.

## Fan-out dispatch prompt (wave of ≥ 2 — one Agent call per task, all in one message)

`subagent_type: "general-purpose"`, `isolation: "worktree"`, a stable `name` of
`task-T-NN` so a partial return can be resumed with `SendMessage`.

```
MODE: delegated

You are in a git worktree cut from `<TARGET>`. Implement task T-NN end to end.

Skill({ skill: "ck-code-lite:build", args: "T-NN" })

Follow that skill's DELEGATED MODE section exactly: no branch question, no clarify
question, no edit to tasks/PLAN.md, no manual-test gate, no ship. Run the project's
own test/build/lint commands inline in your context — do not delegate QA. Commit
inside this worktree after RED and again after GREEN; uncommitted work cannot be
merged and cannot be resumed.

Acceptance criteria (literal, from the plan):
<the task's ### Acceptance block>

Commands: test: <cmd> · build: <cmd> · lint: <cmd>

Return only the verdict block below. Nothing else is read.
```

## Solo dispatch (wave of exactly 1)

One task has no peer to collide with, so it gets no worktree — the agent works in the main
checkout on `$TARGET`, where P1 already proved the tree clean and the branch unprotected,
and its commits are already where a merge would have put them.

The dispatch above with three deltas; everything else — `subagent_type`, the stable
`task-T-NN` name, model tiering, `MODE: delegated`, the criteria, the commands, the verdict
schema — is identical:

1. **Drop `isolation`.**
2. **Replace the opening line** with:
   `You are implementing task T-NN in the main checkout, already on branch <TARGET>.`
   `You are the only agent running — no worktree, no peer, nothing to isolate from.`
3. **Insert the branch guard** directly below it:

```
Branch guard — before your first edit, run `git rev-parse --abbrev-ref HEAD` and confirm
it prints <TARGET>. If it does not, stop and return status "blocked" with the branch you
found; do not implement. Never run `git checkout -b`, `git switch -c`, `git rebase`,
`git reset`, or any `git worktree` command — the branch is the orchestrator's to choose.
Leave the tree clean when you return; uncommitted work fails the integrity gate.
```

The guard replaces the worktree. With no harness-owned directory holding the agent in
place, it is the only thing keeping it off another branch — never dispatch solo without it.

## Verdict schema

```
status:       done | partial | blocked
branch:       <git rev-parse --abbrev-ref HEAD>
commits:      <number of commits made in this worktree>
files:        <comma-separated paths actually touched>
criteria_met: <met>/<total>
remaining:    [<unmet criterion>, …]        # [] when status: done
```

`done` only when every criterion is met and the commands pass. A missing verdict is
read as `partial`. The orchestrator verifies from git regardless — the verdict is a
hint, never the proof.

## Resume prompt (◐ partial, cap 2 rounds)

```
SendMessage(task-T-NN, "Continue the remaining acceptance criteria, commit each
cycle, then return the verdict block again.")
```

## Integrity gate

**Fan-out** — compare the returned branch against the target:

```bash
git diff --shortstat "$TARGET".."<branch>"                  # empty → 🚫 blocked
git diff --name-only --diff-filter=D "$TARGET".."<branch>"  # any → ⚠ unexpected deletion
```

**Solo** — there is no second branch, so the baseline is the SHA recorded at P4, and the
branch and tree are checked too:

```bash
git diff --shortstat "<base-sha>"..HEAD                     # empty → 🚫 blocked
git diff --name-only --diff-filter=D "<base-sha>"..HEAD     # any → ⚠ unexpected deletion
git rev-parse --abbrev-ref HEAD                             # ≠ $TARGET → 🚫 blocked, stop the run
git status --porcelain                                      # non-empty → 🚫 blocked, stop the run
```

Branch drift or a dirty tree on a solo run is a hard stop, not a resume: the agent
committed or left work somewhere this context never authorised, and no later phase can
tell what is safe to keep.

## Merge dry-run

Per eligible branch, in ascending order of overlapping paths:

```bash
git merge --no-commit --no-ff "<branch>" >/dev/null 2>&1 && echo CLEAN || echo CONFLICT
git merge --abort 2>/dev/null || git reset --merge
```

## Worktree lifecycle

A worktree exists to be merged from and then destroyed. Removal is always explicit. Who may
create one at all, and what may never be left standing, is
[worktree-policy.md](../../../references/worktree-policy.md).

**Return to base (start and end of every P7, and once at P8)** — the orchestrator proves it
never followed its agents into isolation:

```bash
test "$(git rev-parse --show-toplevel)" = "$ROOT" && test "$(git rev-parse --abbrev-ref HEAD)" = "$TARGET" && echo AT-BASE || echo DRIFTED
```

`DRIFTED` → `git -C "$ROOT" checkout "$TARGET"` and re-run it. Still `DRIFTED` → stop the
run and report the actual toplevel and branch; every merge and every `tasks/PLAN.md` write
after this point would land somewhere this context did not choose.

**Pre-flight sweep (P1)** — worktrees from an earlier run. A branch already contained in
`$TARGET` is stale; anything else is reported with its task ID and kept.

```bash
git worktree prune
git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch /{sub("refs/heads/","",$2); print $2"\t"w}'
git branch --merged "$TARGET" --format='%(refname:short)'
```

**Retire a merged task (P7)** — per task, immediately after its status flip. The
`--merged` check is the gate; `--force` is only reached once it passes, and then discards
untracked build output alone.

```bash
git branch --merged "$TARGET" --format='%(refname:short)' | grep -qx "<branch>" || echo "NOT MERGED — keep"
git worktree remove --force "<path>"
git branch -d "<branch>"
```

`<path>` is the branch's worktree directory from the P6 `git worktree list` read. A
`git worktree remove` failure keeps the branch and is reported, never retried blindly.

**Final reconcile (P8)** — return to base, run the pre-flight commands again, then classify
every survivor against `git branch --merged "$TARGET"`:

| Survivor | Action |
|---|---|
| merged | retire it here — a P7 miss; say so |
| unmerged, ledger says held / conflicted / blocked | goes to the P8 question |
| unmerged, in no ledger row | unaccounted work — report it and stop; never delete |

The question is asked once for the whole run, listing each worktree with its task, state and
commit count. Only a `KEEP` answer lets one survive the run; a `MERGE NOW` answer re-enters
QA and the P7 dry-run, and `DISCARD` is offered only for a blocked branch with an empty diff.

Kept worktrees are printed in the report with the command that removes them:

```
git worktree remove --force <path> && git branch -D <branch>
```

## Running ledger (the only thing a wave leaves behind)

At P7, each finished task collapses to **one row**, and the wave's verdicts, QA lines,
merge output and worktree paths are dropped from this context. The ledger is append-only
and never re-printed mid-run except at a P0 checkpoint.

```
| W | Task | State | Commits | QA | Outcome |
|---|---|---|---|---|---|
| 1 | T-02 | ✓ | 3 | PASS | merged · worktree removed |
| 1 | T-05 | ◐ | 1 | — | held 1/3 · wt ../wt-T-05 |
| 2 | T-06 | ✓ | 2 | PASS | solo on main · nothing to merge |
```

## Checkpoint (every 3 waves)

Print the ledger, then one `AskUserQuestion`:

```
Waves 1–3 done · 5 tasks done · 1 held · 4 tasks remain (T-07 … T-10)

Continue?  CONTINUE — run wave 4 in this context
           STOP HERE — resume later with `/ck-code-lite:build --waves`
```

Stopping costs nothing: every status already sits in `tasks/PLAN.md`, so a fresh run
re-resolves the remaining waves in a clean context. A held or blocked task is named with
its worktree either way.

## Batch report (end of run, built from the ledger)

```
## Batch results

| W | Task | State | Commits | QA | Outcome |
|---|---|---|---|---|---|
| 1 | T-02 | ✓ | 3 | PASS | merged · worktree removed |
| 1 | T-05 | ◐ | 1 | — | held 1/3 — `git worktree remove --force ../wt-T-05 && git branch -D task/T-05` |

Merged into main · 1 branch kept · 0 stale worktrees · next wave: T-06
```
