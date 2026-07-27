# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
