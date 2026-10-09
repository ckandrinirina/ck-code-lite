# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] — 2026-10-09

### Fixed
- **start**: a new project no longer gets the stack versions the model remembers (React 18 when 19 is current). Every `## Stack` version now comes from the package registry (one parallel lookup with a 15 s timeout), and the current coding idioms come from context7 (MCP, the `ctx7` CLI, then WebSearch). Each line records the date it was checked plus up to 4 best-practice bullets. A task that scaffolds the project or adds a dependency names those versions in its acceptance criteria. ADOPT keeps the installed versions and records a major-version gap as a decision without upgrading. EXTEND re-checks lines older than 90 days or marked `unverified`.
- **build**, **task-builder**: code follows the `## Stack` bullets, which act as the project's cache, so a build makes no lookups. The only exception is a dependency a task adds that `## Stack` does not list yet. A dependency is never installed at a version from memory. In parallel mode the builder returns the new `## Stack` line in its verdict and the orchestrator writes it.

## [1.1.0] — 2026-10-08

### Added
- **build**: `--auto` runs the waves unattended, with no question until the run ends. Each question takes its recommended answer: every task kept, `CONTINUE` at checkpoints, the narrowest reading of an ambiguous criterion (recorded as a note), and `KEEP` for anything left unmerged. QA and the integrity checks still gate every merge. The manual sign-off is deferred to a checklist in the final report, and each task gets a `manual test pending` note. With no test command the run refuses to start rather than record a test exception.

## [1.0.1] — 2026-10-05

A stabilization pass from three audits of 1.0.0 (scripts stress-tested on macOS and Linux, every skill cross-checked, a full run on a real project) and a review of the fixes. Plan format unchanged — no migration.

### Fixed
- **ck-lite**: a write that would corrupt the plan is refused before it lands, leaving the file byte-identical. Before, it was saved first and checked after: a `|` in a title, a body line shaped like a plan row, or a newline in a note could corrupt it.
- **ck-lite**: parallel writes no longer drop each other's updates (6–7 of 8 were lost). Every write now holds a lock, and a lock left by a dead process is taken over safely.
- **ck-lite**: `add` refuses self-dependencies, cycles, over-padded IDs (`T-005`), and `size: L` with a clear message, and leaves no temp files behind.
- **ck-lite `retire`**: it no longer deletes a worktree whose uncommitted work sits on a branch 0 commits ahead.
- **ck-lite `try-merge`**: it no longer wipes staged changes. It now dry-runs with `git merge-tree`, reports `DIRTY` when the branch changes a path that is uncommitted here, and treats a missing branch as a usage error.
- **ck-lite**: paths containing spaces stay whole; `commands` keeps labels such as `test:unit`; `show` exits 1 for an unknown ID; `waves` schedules a repeated ID once; writes keep the plan's file mode; CRLF plans are read correctly and written back as LF.
- **ck-lite**: it works from any subdirectory, using the nearest `tasks/PLAN.md` above it, so a monorepo project keeps its own plan.
- **ck-lite-qa**: a plan write or regenerated Python bytecode no longer voids the reuse stamp, which used to force a second full-suite run. Runs and logs are now kept per checkout, so two projects never share a `T-01`. Sub-second suites are no longer charged a 2 s poll.
- **build**: an interrupted (`doing`) task is resumed or offered with no argument, and its earlier branch or kept worktree is found. The next task branches from trunk instead of stacking on the previous task's branch, unless it `needs` that task.
- **build**: a recorded `test: (none)` exception can now pass QA, inline and in parallel. A `CORRUPT` task points at the lines to fix by hand. A missing `docs/ARCHITECTURE.md` points at `start`.
- **build, parallel mode**:
  - A run is no longer stopped by architecture docs that a fresh `start` left uncommitted.
  - `STOP HERE` reconciles before reporting.
  - A failing merged-result QA ends the run, and that QA run gets its own ID.
  - A merged worktree is retired on merge.
  - Held branches are noted on the task so a later build finds them.
  - An empty remaining scope ends the run cleanly.
  - Drift recovery `cd`s back to the main checkout.
- **ship**: it no longer marks a `doing` task done (that skipped QA and the manual test). It offers closing a task only when the task is still `todo`.
- **start**: a project with only one of `docs/ARCHITECTURE.md` and `tasks/PLAN.md` is handled without overwriting the doc. Python projects using `setup.py` or `requirements.txt` are detected. Multi-stack commands use `cd dir && …`. `node --test` gets a `test-one`.
- **qa-validator**: told up front that `ck-lite-qa` is the only command it runs; a bare run had skipped the reuse stamp.

### Added
- **ck-lite `drop`**: removes a mistaken `todo` or `blocked` task that nothing depends on.
- **tests**: 124 smoke assertions, up from 85. 33 of them fail on 1.0.0.

## [1.0.0] — 2026-10-05

A run's cost now tracks the work in front of it, not the age of the project, and the slow parts of a build are scripted or skipped — the four gates (clarify, RED, QA, manual test) are unchanged.

### Added
- **ck-lite** (`bin/`): the only reader and writer of `tasks/PLAN.md` — `open` (readiness worked out), `show`, `criteria`, `context`, `waves`, `set`, `files`, `note`, `done`, `next-id`, `init`, `add` (table rows generated), `check`, `stats` — plus the worktree steps with a safety rule (`base`, `worktrees`, `try-merge`, `retire`). An `Edit` needed a `Read` of the whole plan first; no skill reads or edits it now, so plan size costs nothing.
- **ck-lite-qa** (`bin/`): every test, build and lint run goes through it — one line per command, the output in a log, each pass stamped on the exact code state; long suites detach past the 600 s call limit.
- **task-builder** agent: builds one task of a parallel wave from a compact prompt plus the shared TDD rules, instead of re-loading the whole build skill (about 70% less loaded per agent).
- **Architecture areas**: past 150 lines `start` moves an area out of `docs/ARCHITECTURE.md` into `docs/areas/<area>.md`, listed under `## Areas`; `ck-lite context` gives a task the core plus only the area docs its files touch.
- **`test-one` command**: RED and GREEN run only the task's own tests; the full suite runs once, after cleanup.
- `tests/smoke.sh` and CI (Linux gawk + macOS bash 3.2).

### Changed
- **build**: the single-task skill is about 55% smaller — PARALLEL MODE moved to `references/parallel-mode.md`, loaded only for batches; RED/GREEN/cleanup live in `references/tdd-cycle.md`. The branch is picked and announced (a task branch off a protected one), never asked. Inline QA reuses the closing full-suite run when no code changed since; parallel QA never reuses. A fan-out wave's merged result gets one full QA run before the manual gate.
- **build PARALLEL MODE**: tolerates an uncommitted `tasks/PLAN.md` (resume after `STOP HERE` works); `test: (none)` and task drops are settled at P3; leftover unschedulable tasks are reported; worktrees from earlier runs are listed, never removed.
- **start**: writes tasks through `ck-lite init/add`; splits the architecture core in EXTEND mode.
- **ship**: closes the task before staging, so the status change lands in the commit.

### Removed
- `skills/build/references/parallel-dispatch.md` and DELEGATED MODE — replaced by `parallel-mode.md` and the `task-builder` agent.

### Migration
- No change to the `tasks/PLAN.md` format; existing plans work as they are. `docs/areas/` is optional. Moving up to ck-code needs ck-code ≥ 7.6.1, whose migrator turns areas into epics and feature docs.

## [0.5.0] — 2026-10-05

### Added
- **build**: a worktree kept past a parallel run (`KEEP` on a held, conflicted or blocked task) now sheds its rebuildable build output through the new `ck-lite-reclaim` (`bin/`), which deletes only build-output directories (`target/`, `node_modules/`, `dist/`, `.venv/`, …) that git ignores and that hold no tracked file, keeps source, commits and gitignored config such as `.env`, refuses the main checkout, and prints one `freed` line — a Rust/Tauri `target/` alone runs to 5–20 GB per worktree. Merged worktrees were already removed as they land. No format change to `tasks/PLAN.md` or `docs/ARCHITECTURE.md`.

## [0.4.1] — 2026-09-29

### Changed
- **build**: code comments now follow a brevity rule — only a *why*, an invariant, a workaround or a one-line doc comment, in the fewest words that stay precise (no filler, no restated names or types, no history) — enforced by a new 4.3 cleanup check 6, so generated code costs fewer tokens on every later read.

## [0.4.0] — 2026-09-21

### Added
- **prompt-router** (`scripts/prompt-router.sh`, `UserPromptSubmit`): every free-text prompt in an adopted project (`tasks/PLAN.md` or `docs/ARCHITECTURE.md`) now receives `references/prompt-routing.md` as context — a three-line intent → skill table — so "implement T-03" runs `build`, a bug or feature with no task runs `start` (EXTEND mode) then `build`, and "ship it" runs `ship`, without the user typing the slash command. The chosen skill is announced in one line and invoked; the prompt is the consent. Silent on a slash command, on a reply under 12 characters (an answer to a running skill), in a repo that never adopted the workflow, and in a full ck-code project, whose own router owns the prompt. Bash 3.2, no jq, always exits 0. No format change to `tasks/PLAN.md` or `docs/ARCHITECTURE.md`.

## [0.3.1] — 2026-09-17

### Changed
- **start**: Phase 5 now orders tasks demo-first. The first task makes the app run with its user-facing surface reading fixture data behind one adapter module; every remaining surface task follows; backend tasks come last, one per fixture, each `needs` the surface task it serves and is verified by re-running that surface with real data. A fixture with no replacing task in the plan, or an acceptance criterion that needs Postman or curl to check, is a planning defect. Headless projects (library, daemon, pure API) say so and order core code first. No format change to `tasks/PLAN.md`.

## [0.3.0] — 2026-09-09

### Added
- **references/rtk.md** (new): RTK is an optional third-party `PreToolUse` hook that filters command output before it reaches context. Documents the command forms its hook recognizes and the rule that a skill must never hardcode an `rtk` prefix. Linked from `start` and `build`.

### Changed
- **references/stack-commands.md**: the Node row and the `## Commands` example now resolve to the `<runner> run <script>` long form (`npm run test`, `pnpm run test`, `pnpm run build`). `npm test` is an exact alias of `npm run test`, but only the long form is filtered by RTK — and `build` runs that one command on every RED and GREEN cycle, again in QA, and again per worktree in `--waves`.
- **start/references/architecture-template.md**: the `## Commands` example matches the new long form.

## [0.2.7] — 2026-08-31

### Changed
- **build**: Phase 4.3 Cleanup is now five explicit checks over the task's diff — code the repo already has (a grep, not a recollection), duplication inside the diff, dead code, single-caller wrappers, and surface no acceptance criterion asked for. It stays one bounded pass, and leaves deliberate boundaries and repeated test setup alone.

## [0.2.6] — 2026-08-31

### Added
- **build / ship / start**: `allowed-tools` frontmatter pre-approving the git and `gh` commands each skill actually runs, so a normal run no longer stops on permission prompts.
- **qa-validator**: `effort: low` and `experimental.cacheTtl: "1h"` — the agent is re-dispatched once per task in a wave, so a 1-hour prompt cache avoids re-caching its system prompt on every call.


## [Unreleased]

## [0.2.5] — 2026-08-12

### Fixed
- **start / ship**: never create or enter a git worktree — both work in the checkout they were invoked from, so the artifacts they write and the diff they ship are not stranded on an isolated branch.
- **build**: a single task never gets a worktree — Phases 2–7 run inline on a branch created in place with `git checkout -b`. Isolation is cut only by the PARALLEL MODE orchestrator, and only for a wave of two or more concurrent tasks.
- **build**: the orchestrator dispatches isolation without entering it — P1 records the main checkout path alongside the target branch, and P7 verifies both at its start and end, stopping the run on drift instead of merging from the wrong side.
- **build**: P8 now reconciles every surviving worktree against `git branch --merged` and asks the user to merge, keep or discard each one before the report; a run can no longer end with unmerged work nobody chose to keep.

### Added
- **references/worktree-policy.md**: plugin-wide contract naming which situations may cut a worktree, forbidding manual isolation, and defining return-to-base and the no-orphan rule.

## [0.2.4] — 2026-08-11

### Changed
- **build**: PARALLEL MODE isolation now follows wave width. A wave holding exactly one
  task is dispatched **solo** — one agent in the main checkout on `$TARGET`, no worktree,
  no branch to merge — held in place by an explicit branch guard and verified against a
  baseline SHA instead of a peer branch. Worktrees are cut only for waves of two or more,
  where a peer actually exists to isolate from; a one-task wave no longer pays a cold
  dependency install. No task is ever built inline once PARALLEL MODE is entered.
- **build**: a `--waves` run is now bounded by an explicit context budget — wave width
  capped at 4, acceptance criteria read one wave at a time instead of for the whole scope,
  each finished task collapsed to a one-line ledger row, and a checkpoint every three waves
  offering to stop. Stopping is free: status lives in `tasks/PLAN.md`, so `--waves` resumes
  from it in a fresh context.

## [0.2.3] — 2026-07-29

### Changed
- **start / build / ship**: dropped the default-valued `disable-model-invocation: false` frontmatter line.

## [0.2.2] — 2026-07-29

### Changed
- **start, build, ship**: every `tasks/PLAN.md` read is scoped to open work, so a run's
  cost tracks remaining tasks instead of project age. Rows are filtered to
  `todo`/`doing`/`blocked` — the status vocabulary is closed, so an ID absent from that set
  is `done` and dependencies resolve without loading a finished row — and a single `awk`
  extractor replaces the grep-offsets-then-`Read` pair for section lookup. On a 101-task
  plan a build run reads 27 lines instead of 228, and a parallel batch 44 instead of 504.
- **start**: reports once when a plan passes 40 open tasks or `docs/ARCHITECTURE.md`
  passes 150 lines, pointing at `/ck-code:migrate`. A notice, never a block.
- **start**: `## Decisions` is kept to live choices — a reversal folds into the line it
  replaces and anything the toolchain now enforces is deleted, so the one section that grew
  with project history stays proportional to current architecture.

### Fixed
- **build, ship**: the three-line consistency check is anchored per line. The previous
  unanchored `grep -n "T-NN"` also matched every task listing `T-NN` in its `needs`, so it
  returned the promised three hits only for a task nothing depended on, and could not
  distinguish `T-01` from `T-010`.

## [0.2.1] — 2026-07-27

### Fixed
- **build**: parallel runs no longer leave stale worktrees behind — a merged and
  signed-off task's worktree is removed and its branch deleted in P7 beside the status
  flip, P1 sweeps worktrees left by earlier runs, and P8 accounts for every worktree still
  standing in the batch report. `git worktree prune` alone never removed them, so each
  merged task used to leak one.

## [0.2.0] — 2026-07-27

### Added
- **build**: parallel and wave execution — `/ck-code-lite:build T-02 T-05` builds
  independent tasks concurrently, one git worktree each, and `--waves` drives the whole
  remaining plan in dependency-ordered waves. Waves come from the plan's `needs` column,
  tasks declaring the same file never run together, and the orchestrator remains the sole
  writer of `tasks/PLAN.md` so concurrent branches cannot conflict on the plan table.
  RED, QA and manual sign-off all still gate a task before it is marked `done`.

## [0.1.1] — 2026-07-27

### Changed
- **start / README**: outgrowing lite now names the way out — `/ck-code:migrate` converts a
  lite project's `tasks/PLAN.md` and `docs/ARCHITECTURE.md` to the full ck-code v4 layout,
  so the two-file workflow is no longer a dead end.

## [0.1.0] — 2026-07-27

### Added

- **start**: writes `docs/ARCHITECTURE.md` and a flat `tasks/PLAN.md` from a description,
  a spec file, or an existing codebase; re-runs append tasks without clobbering.
- **build**: implements one task end to end — a confirmed-failing test before any code,
  an isolated QA pass, and a manual sign-off before the task is marked done.
- **ship**: conventional commit plus pull-request create-or-update, with plain-language
  copy for non-engineers and no AI references in any artefact.
- **qa-validator** agent: runs the project's own commands in an isolated context and
  returns a per-criterion verdict plus one summary line, never the full suite output.
- Shared references for the plan-file format and manifest-to-command resolution.
