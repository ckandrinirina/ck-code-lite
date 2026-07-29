# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
