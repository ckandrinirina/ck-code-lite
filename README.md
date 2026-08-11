# ck-code-lite

Three skills. Two files. Ship an app fast without losing the steps that keep it correct.

`ck-code-lite` is the fast path: describe what you want, get an architecture doc and a
flat task list, then build tasks one at a time — each with a failing test first, an
isolated QA pass, and your own hands-on sign-off before it counts as done.

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
```

Waves come from the plan's own `needs` column, and two tasks that declare the same file
never run together. Every task in a wave is built by a dispatched agent, but the isolation
follows the wave's width: two or more tasks each get their own worktree and merge back
after an integrity check and a QA pass, while a wave holding a **single** task runs solo in
the main checkout — no worktree to cut, no cold dependency install, nothing to merge. The
manual sign-off runs once per wave either way. A merged worktree is removed as soon as it
is signed off, and a run never ends with a worktree it cannot account for — anything still
standing is named in the report with the reason it was kept.

A waves run also stays bounded: at most four tasks per wave, acceptance criteria read one
wave at a time, each finished task collapsed to a single ledger row, and a checkpoint every
three waves offering to stop. Stopping costs nothing — status lives in `tasks/PLAN.md`, so
`--waves` resumes from it in a fresh context. The four guarantees below hold in a parallel
run exactly as they do in a single one.

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

## The two files

`docs/ARCHITECTURE.md` — stack, folder structure, decisions with their reasons, and a
`## Commands` block holding the project's real test/build/lint commands. `build` reads it
every run and passes those commands to QA.

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
exactly three lines — the table row, the header, the meta line — so one anchored `grep` is
the whole consistency check. There is no generator, no index, and nothing to regenerate.

### Lite at any size

The plan only grows, so nothing reads it whole — or even reads its whole table. A run pulls
the rows that are still `todo`, `doing` or `blocked`, plus the one task section it is about
to work on. Since the four statuses are the entire vocabulary, a task missing from that set
is `done`, and dependencies resolve without ever loading a finished row.

**Cost per run tracks open work, not project age.** A plan with four hundred finished tasks
and three open ones reads like a three-task plan. `## Decisions` is kept to live choices the
same way — a reversal folds into the line it replaces, and anything the linter or type
system now enforces comes out.

Past ~40 open tasks or a 150-line architecture doc, `start` says once that the project has
outgrown a flat plan and points at `/ck-code:migrate`. It is a notice, not a wall.

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
| Architecture | 1 doc | per-feature docs + shared globals |
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

It turns `tasks/PLAN.md` into epics and stories (proposing a grouping you confirm first)
and splits `docs/ARCHITECTURE.md` into `docs/architecture/`. Statuses, acceptance criteria
and ticked boxes carry over, so finished work stays finished. The lite files are marked
superseded rather than deleted, the whole conversion lands in one revertable commit, and
you are offered the `enabledPlugins` swap at the end. There is no path back — decide with
the table above.

## Design principles

- **Two files, hand-editable.** If you can't fix the plan with an editor, the format is wrong.
- **Gates over process.** Four checks that catch real defects, and nothing else mandatory.
- **Never guess a command.** `(none)` is a valid answer; an invented npm script is not.
- **Append, never rewrite.** Re-running `start` adds tasks; it never clobbers your edits.
- **Isolate expensive output.** QA runs somewhere else and comes back with a verdict.

## License

MIT
