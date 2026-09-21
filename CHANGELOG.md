# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
