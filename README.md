# ck-code-lite

Three skills. Two files. Ship an app fast without losing the steps that keep it correct.

`ck-code-lite` is the fast path: describe what you want, get an architecture doc and a
flat task list, then build tasks one at a time — each with a failing test first, a bounded
cleanup pass that refuses to keep code the repo already has, an isolated QA pass, and your
own hands-on sign-off before it counts as done. The bookkeeping between those steps is
scripted, so a run's cost tracks the work in front of it, not the age of the project.

## Skills

| Skill | Use it when | Produces |
|---|---|---|
| `/ck-code-lite:start` | A project needs its plan — new idea, existing codebase, or more tasks | `docs/ARCHITECTURE.md`, `tasks/PLAN.md` |
| `/ck-code-lite:build` | Implementing one task end to end — or several at once, in waves | Code, tests, tasks marked `done` |
| `/ck-code-lite:ship` | Committing finished work | A conventional commit and a PR |

```
/ck-code-lite:start "a CLI that counts words in a file"
/ck-code-lite:build
/ck-code-lite:ship
```

Independent tasks do not have to wait in line:

```
/ck-code-lite:build T-02 T-05     # both at once, one git worktree each
/ck-code-lite:build --waves       # the whole remaining plan, dependency-ordered
/ck-code-lite:build --auto        # the same, unattended — no question until it finishes
```

Waves come from the plan's own `needs` column (`ck-lite waves` works them out), and two tasks
that declare the same file never run together. Every task in a wave is built by a dispatched
`task-builder` agent — which carries only the TDD rules, not the whole skill — but the isolation
follows the wave's width: two or more tasks each get their own worktree and merge back
after an integrity check and a QA pass, while a wave holding a **single** task runs solo in
the main checkout — no worktree to cut, no cold dependency install, nothing to merge. The
manual sign-off runs once per wave either way.

Concurrency is the *only* reason this plugin ever cuts a worktree. `start` and `ship` never
do, and neither does a single `build` task, which runs inline on a branch created in place.
The orchestrator dispatches isolation without entering it: after every wave it proves it is
still in the main checkout on the branch it started from. A merged worktree is removed as
soon as it is signed off, and no run ends with an unmerged one the user did not explicitly
choose to keep — anything still standing is reconciled before the report, with the option to
merge it there and then.

A waves run also stays bounded: at most four tasks per wave, acceptance criteria read one
wave at a time, each finished task collapsed to a single ledger row, and a checkpoint every
three waves offering to stop. Stopping costs nothing — status lives in `tasks/PLAN.md`, so
`--waves` resumes from it in a fresh context. The four guarantees below hold in a parallel
run exactly as they do in a single one.

`--auto` (alone, or after task IDs) runs the waves unattended: every question takes its
recommended answer — all tasks kept, `CONTINUE` at checkpoints, the narrowest reading of an
ambiguous criterion (recorded as a note), `KEEP` for anything left unmerged. QA and the
integrity checks still gate every merge. The manual sign-off is deferred, not dropped: each
task gets a `manual test pending` note and the final report carries one checklist of steps to
try. With no test command it refuses to start rather than build without a failing test.

### Every prompt goes through the workflow

You do not have to type the slash command. In an adopted project (one with `tasks/PLAN.md`
or `docs/ARCHITECTURE.md`) a `UserPromptSubmit` hook (`scripts/prompt-router.sh`) injects
[`references/prompt-routing.md`](references/prompt-routing.md) — a three-line intent → skill
table — as context for each free-text prompt, so "implement T-03" runs `build`, "the parser
crashes on empty input" runs `start` to add the task and then `build`, and "ship it" runs
`ship`. The chosen skill is announced in one line and invoked; the prompt is the consent. The
hook stays silent on a slash command, on a reply shorter than 12 characters (an answer to a
running skill), in a repo that never adopted the workflow, and in a full ck-code project,
whose own router owns the prompt. Pure local read, always exits 0.

## The four guarantees

Speed comes from deleting ceremony, not from deleting checks. These four are hard gates
and cannot be skipped:

1. **A failing test before the code.** No implementation file is created or edited until
   a test run has been observed failing. No test runner in the project? `build` stops and
   asks — it never proceeds pretending the step happened.
2. **QA against every acceptance criterion.** Delegated to an isolated subagent that runs
   your project's own commands and returns a verdict, so unbounded suite output never
   floods the session.
3. **Manual sign-off.** You are given concrete steps to try and asked for the result.
   `ISSUES` writes a regression test and loops back through QA — it does not ship.
4. **Clarify before building.** One batched question round on genuine ambiguity, before
   anything is written. Nothing ambiguous means no questions at all.

## The files

`docs/ARCHITECTURE.md` — stack, folder structure, decisions with their reasons, and a
`## Commands` block holding the project's real test/build/lint commands. `build` reads it
every run and passes those commands to QA. Each `## Stack` line holds a version `start` looked
up in the package registry (never from model memory), its verified date, and a few current
best-practice bullets from context7. That makes it a cache: `build` codes to those bullets
without fetching anything, looks up only a dependency a task adds, and `start` refreshes a
line once it is 90 days old. Past 150 lines, `start` moves the largest area out
into `docs/areas/<area>.md` and lists it under `## Areas`; from then on a task reads the core
plus only the area docs its files touch.

`tasks/PLAN.md` — one table plus one section per task:

```markdown
| ID | Title | Status | Size | Needs |
|---|---|---|---|---|
| T-01 | Count words in a file | done | S | — |
| T-02 | Report an error for a missing file | todo | S | T-01 |

## T-02 Report an error for a missing file

T-02 · status: todo · size: S · needs: T-01 · files: src/count.js

### Acceptance
- [ ] A missing path exits non-zero with a readable message
```

Statuses are `todo`, `doing`, `done`, `blocked`. Tasks are `S` or `M` only. Every ID owns
exactly three lines — the table row, the header, the meta line. There is no generator, no
index, and nothing to regenerate; the file stays hand-editable.

### Lite at any size

The plan only grows (a mistaken task aside), so no skill ever reads or edits it. Every access is one call to
`ck-lite`, which parses the file in a pipe and prints only the answer:

| | |
|---|---|
| `ck-lite open` | open tasks with readiness worked out |
| `ck-lite context T-05` | the architecture core, the area docs the task touches, the task |
| `ck-lite set doing T-05` · `ck-lite done T-05` | a status move, row and meta line together, verified |
| `ck-lite add` · `ck-lite next-id` · `ck-lite drop` | new tasks, table rows generated; a mistaken one removed |
| `ck-lite waves --all` | dependency-ordered, file-disjoint waves |
| `ck-lite check` · `ck-lite stats` | integrity, sizes, and the graduation notice |

Writes are locked and verified before they land: a write that would corrupt the plan is
refused and leaves it untouched, and parallel calls queue rather than overwrite each other.

**Cost per run tracks open work, not project age.** A plan with four hundred finished tasks
and three open ones costs what a three-task plan does — reads *and* writes, since a status
change no longer needs the file loaded to edit it. The plan is never split: an archive would
buy no tokens and add a lookup to every dependency check.

**Fast without fewer checks.** RED and GREEN run only the task's own tests (the optional
`test-one` command); the full suite runs once, after cleanup. Every test, build and lint run
goes through `ck-lite-qa`, which prints one line per command and keeps the output in a log,
and an inline QA pass reuses that full-suite run when not a byte of code changed since. A
parallel wave's QA never reuses anything.

Past ~40 open tasks, `start` and `build` say once that the project has outgrown a flat plan
and point at `/ck-code:migrate`. It is a notice, not a wall.

## Install

```
/plugin marketplace add ckandrinirina/ck-code
/plugin install ck-code-lite@ck-marketplace
```

Per-project opt-in via `.claude/settings.json`:

```json
{ "enabledPlugins": { "ck-code-lite@ck-marketplace": true } }
```

## ck-code-lite or ck-code?

They are **alternatives, not companions** — enable one per project. Both expose `build`
and `ship`, and running a project through both layouts will not end well.

| | ck-code-lite | ck-code |
|---|---|---|
| Skills | 3 | 12 |
| Planning artefacts | 2 files | epics, per-story files, generated indexes |
| Architecture | 1 core doc + optional area docs | per-feature docs + shared globals |
| Parallel builds | yes, inside `build` | yes, a dedicated skill with conflict analysis |
| Generated expert skills | no | yes (`team`) |
| Bug triage workflow | no | yes (`fix`) |
| Best for | getting an app working | a codebase several people maintain |

Start here. Move to `ck-code` when the task list outgrows one file or more than one
person is planning work.

### Moving up

Nothing is stranded — install `ck-code` and run this inside the project:

```bash
/ck-code:migrate
```

It turns `tasks/PLAN.md` into epics and stories (proposing a grouping you confirm first,
seeded by your areas) and splits `docs/ARCHITECTURE.md` and `docs/areas/` into
`docs/architecture/`. Statuses, acceptance criteria
and ticked boxes carry over, so finished work stays finished. The lite files are marked
superseded rather than deleted, the whole conversion lands in one revertable commit, and
you are offered the `enabledPlugins` swap at the end. There is no path back — decide with
the table above.

## Design principles

- **Two files, hand-editable.** If you can't fix the plan with an editor, the format is wrong.
- **Scripts do the bookkeeping.** Anything with one right answer — readiness, waves, a status
  move, the next ID — is a `ck-lite` call, not a reasoning step.
- **Gates over process.** Four checks that catch real defects, and nothing else mandatory.
- **Never guess a command.** `(none)` is a valid answer; an invented npm script is not.
- **Append, never rewrite.** Re-running `start` adds tasks; it never clobbers your edits.
- **Isolate expensive output.** QA runs somewhere else and comes back with a verdict.
- **Leave no disk behind.** A merged worktree is removed as it lands; one you keep sheds its
  rebuildable build output (`target/`, `node_modules/`, …) through `ck-lite-reclaim` and keeps
  its source — a Tauri `target/` alone can be 5–20 GB per worktree.
- **Cheap to filter.** Commands are written in the long `pnpm run test` form so an optional
  [RTK](https://github.com/ckandrinirina/rtk) hook can compress their output. Never required,
  never hardcoded — see `references/rtk.md`.

## License

MIT
