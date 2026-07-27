# Parallel dispatch — planning, prompts, formats

Data and formats for `build`'s PARALLEL MODE. The skill owns the decisions; this file
owns the algorithm, the literal prompts, and the report shapes.

## Reading the plan for a batch

Three bounded greps supply everything the orchestrator needs. Never read `PLAN.md` whole.

```bash
grep -n '^| T-' tasks/PLAN.md                      # id, status, size, needs
grep -n '^T-[0-9]* · ' tasks/PLAN.md               # meta lines — the files: scope
awk '/^## T-/{t=$2} /^### Acceptance/{p=1;print "== "t;next} /^### /{p=0} p&&/^- \[/{print}' tasks/PLAN.md
```

The third prints every task's acceptance criteria grouped by ID — the literal text the
clarify gate reads and the QA dispatch quotes.

## Wave planning

Scope `S` is the explicit ID list, or every non-`done` task under `--waves`.

- **Wave 1** — tasks in `S` whose every `needs` entry is already `done`.
- **Wave k+1** — tasks whose every `needs` entry is `done` or scheduled in a wave ≤ k.
- **Unschedulable** — a `needs` entry that is neither `done` nor in `S`, a dependency
  cycle, or a `blocked` status. Excluded from every wave and reported at the end.

Then split each wave by declared file scope: walk the wave in ID order and move any task
that shares a `files:` path with a task already placed into the **next** wave. Two tasks
touching the same file are never dispatched together, whatever their `needs` say.

```
## Wave plan

Wave 1 · T-02 Parse the config file      · files: src/config.js
        T-05 Add the --json flag         · files: src/cli.js
Wave 2 · T-06 Print parsed config as JSON · needs: T-02, T-05
Unschedulable · T-09 (needs T-08, not in scope)
```

More than three waves means many sequential merge cycles — say so and offer a re-scope.

## Dispatch prompt (one Agent call per task, all in one message)

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

```bash
git diff --shortstat "$TARGET".."<branch>"                  # empty → 🚫 blocked
git diff --name-only --diff-filter=D "$TARGET".."<branch>"  # any → ⚠ unexpected deletion
```

## Merge dry-run

Per eligible branch, in ascending order of overlapping paths:

```bash
git merge --no-commit --no-ff "<branch>" >/dev/null 2>&1 && echo CLEAN || echo CONFLICT
git merge --abort 2>/dev/null || git reset --merge
```

## Worktree lifecycle

A worktree exists to be merged from and then destroyed. Removal is always explicit.

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

**Final sweep (P8)** — run the pre-flight commands again. Every remaining worktree is
listed in the report against the task that holds it, with its removal command:

```
git worktree remove --force <path> && git branch -D <branch>
```

## Batch report

```
## Wave 1 results

| Task | State | Commits | QA | Merge | Worktree |
|---|---|---|---|---|---|
| T-02 | ✓ complete | 3 | PASS | merged | removed |
| T-05 | ◐ partial | 1 | — | held (1/3 criteria) | kept — resume or `git worktree remove --force ../wt-T-05 && git branch -D task/T-05` |

Merged into main · 1 branch kept · 0 stale worktrees · next wave: T-06
```
