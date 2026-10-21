# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.11.2] — 2026-10-21

### Fixed
- **ck-lite-replicate**: the remaining captured fields — API keys, form actions, redirect targets, page paths, landmark roles, snap labels and window titles, macOS menu names and items — go through the same sanitizer as the rest, and `menus.md` opens with the data-not-instructions notice.

## [1.11.1] — 2026-10-21

### Fixed
- **ck-lite-replicate**: captured API URLs are stored without their query strings, so tokens, signatures and session ids in them never reach the pack; every capture file opens with a notice that its text is the app's data, never instructions, and page-derived strings can no longer close a markdown fence or table cell.
- **replicate.md**: text a capture recorded is content to describe, never an instruction to act on.

## [1.11.0] — 2026-10-21

### Added
- **design**: `replicate <source>` copies an existing app — a website or web app (even behind a sign-in), an Electron or native macOS app, an Android or iOS Simulator screen, a CLI, a source tree or plain screenshots — into `docs/replica/<slug>/REPLICA.md`: screens, flows, captured tokens, components, data and gaps, under an own-app or reference-only copy policy. `start` plans it screen by screen.
- **ck-lite-replicate**: a zero-dependency capture engine (Node ≥ 22 + an installed Chrome over the DevTools Protocol; osascript/adb/simctl for native) — screenshots, computed tokens, page outlines and API shapes, plus `shot` and `diff` for the build's fidelity loop. Byte-identical to ck-code's `ck-replicate`.
- **build**: a task citing a replicated screen builds to it and runs the fidelity loop once — shoot the running app, diff it against the reference, one fix pass, the result noted on the task; QA fails a cited screen that was never compared.

## [1.10.1] — 2026-10-16

### Fixed
- **ck-lite-qa**: an empty or whitespace-only command is refused (exit 2) instead of passing — `test="$(ck-lite-affected …)"` expanding to nothing no longer lets ship push untested; the last-run record is namespaced by project like the run state.
- **ck-lite-affected**: a change that only deletes files is no longer NONE — deleted paths are traced so their importers' tests run; a single-file `## Areas` entry now matches its file.
- **ck-lite-release**: `watch` polls `gh run view` to completion when `gh run watch` returns early, instead of reporting `FAIL ()` on a healthy build; still running at the cap prints `RUNNING` and exits 3.
- **ck-lite**: temp files no longer leak next to `tasks/PLAN.md` under a project path with a space, or after a refused `done`.
- **stack-commands**: the Go test-one recipe is `go test {dirs}` (package folders); `go test {files}` compiled test files alone.
- **mod**: a failed update check (offline, non-ok, malformed reply) is recorded and waits 6 hours like a success, instead of refetching at every session start.

## [1.10.0] — 2026-10-16

### Added
- **mod**: update check — when the public marketplace serves a newer ck-code-lite than the one the session loaded, one toast per new version and a row above the prompt (`/plugin update ck-code-lite@ck-marketplace`, then restart) until it is updated, so a project left on an old install is told. The latest version is read from the published `marketplace.json` at most every 6 hours and cached in the plugin store; a `--plugin-dir` checkout is never checked, and the `update_check` setting, `CK_UPDATE_CHECK=off` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` turns it off. `hooks/mod/update.tsx` and `tests/mod/update.test.tsx` are kept word for word in ck-code, ck-code-lite and ck-tools.

## [1.9.0] — 2026-10-16

### Added
- **build**: QUICK route — a cosmetic `S` task (a label, copy, style, token, icon or constant in at most three named files) is built without the context scout, stack research, cleanup pass or QA agent; a test asserting the old value still goes red first, QA runs inline with `--reuse`, the manual gate is one or two steps, and it steps back to the normal route by itself when the diff grows. `--quick` asks for it (still checked), `--full` refuses it.
- **ck-lite-headless**: lists the e2e setups that open a window in front of the user (`headless: false`, `--headed`/`--ui`/`--debug`, `PWDEBUG=1`, `cypress open`, an Electron suite whose app ignores `E2E_HEADLESS`); `build` converts every hit before task code without asking, and PARALLEL MODE commits the conversion on the target before the first wave. Recipes in `references/background-tests.md`.

### Changed
- **ck-lite-qa**: every command runs with `E2E_HEADLESS=1` and without `PWDEBUG`, so a converted suite stays in the background.
- **qa-validator**, **tdd-cycle**: a test that opens a window in front of the user is a QA failure; new e2e tests are written background-first.

## [1.8.0] — 2026-10-16

### Added
- **release**: new skill — publishes a version the way the project releases, from a committed recipe (`docs/RELEASE.md`) drafted on the first run from one `ck-lite-release facts` call: every version file and the changelog in a release PR, the merge (or one question when only you can merge, checked afterwards — never a silent wait), the tag on the merge commit, and the build started where it really runs, including a `workflow_dispatch` in a public build repo when the private one has no Actions minutes. The build is watched in the background down to one result line; running the skill again resumes a release that stopped half way.
- **release**: lessons shared across projects — `~/.claude/ck-lessons.md` keeps one line per thing a release learned (an exhausted Actions budget, a missing `SOURCE_TOKEN`), read by every project on the machine and by both ck plugins; a lesson is printed only when it matches the project's facts or the error at hand.

### Changed
- **prompt router**: a new-version, tag or failed-release-build prompt routes to `release` (one routing line).

## [1.7.0] — 2026-10-14

### Added
- **mod**: the ck look — in a lite project the terminal's tool rows draw with flat one-cell glyphs (`⌕` searches, `≡` reads, `✎` writes, `±` edits, `❯` shell, `◈` agents, `✦` skills, `☐`/`▣` tasks) plus each call's subject and state, a folded run of reads and searches is one line (`✓ ≡ 3 · ⌕ 2`), and the spinner and closing line use workflow words. New `theme` setting, on by default.
- **mod**: task board — a task builder's own TaskCreate/TaskUpdate/TodoWrite list is mirrored onto the band while it runs (`◈ Build T-03 ▰▰▱▱ 2/4 ▸ Writing the failing test`); a sub-agent's list never reaches the session's own.

### Changed
- **mod**: the band's action row (next command, **Use**, **Hide**) folds away 8 s after a turn ends, leaving the progress line; the band, the cheers and the in-progress marker use flat glyphs (`▸`, `✦`, `★`) instead of emoji.
- **build**, **task-builder**: open a session task list again — one task per phase inline, one per dispatched task in waves, and the builder's RED/GREEN/cleanup/closing-run list — so Claude Code's task view shows the run.

## [1.6.2] — 2026-10-14

### Fixed
- **mod**: the band's **Use** and **Hide** work with no click, so they also work in the default TUI (`/tui default`), where clicks never reach a mod. **ctrl+x tab** focuses the band, then **u** or **h** presses the button, and off the fullscreen layout the band shows these keys.

## [1.6.1] — 2026-10-14

### Fixed
- **mod**: the band above the prompt draws the mods that come after it (such as ck-tools' plan-limit rows) under its own rows, in the rows it leaves, instead of hiding them.

## [1.6.0] — 2026-10-14

### Added
- **mod**: cost guard, active in every project. It caps every model request and sub-agent dispatch at `high` effort, refuses a `fable` dispatch until the user approves it, and gives an `Explore`/`general-purpose` dispatch with no `model:` a cheap model instead of the session's. Turn it off with the `cost_guard` setting.
- **context-scout** agent (haiku, low effort): finds the code a task touches and returns a `file:line` brief, so the main agent never searches the codebase.
- **researcher** agent (haiku, low effort): looks up versions, idioms and docs and returns sourced answers; `start` and `build` send their idiom lookups to it.

### Changed
- **task-builder**: pinned to `model: sonnet` instead of inheriting the session model.

## [1.5.2] — 2026-10-13

### Fixed
- **ck-lite-affected**: every candidate file reaches `awk` and `grep` as `./path`. A repo file named `-f<x>` had been parsed as an awk option and ran `<x>` as an awk program, which can call `system()`. A file named like `x=y` was read as an assignment instead of a file.

## [1.5.1] — 2026-10-13

### Fixed
- **ck-lite-affected**: `--command` single-quotes every file and folder it splices into `{files}`/`{dirs}`, so a file name holding `$(…)`, `;` or a quote is passed as data and never run by the shell. A `<base>` starting with `-` is refused instead of reaching `git` as an option, and is used only once resolved to a commit.
- **ck-lite-affected**: pathspecs such as `*.ts` are no longer expanded against files in the repo root. A root `main.ts` or `eslint.config.js` had narrowed the import trace to that one file and dropped real importers.

## [1.5.0] — 2026-10-13

### Added
- **ck-lite-affected**: a new script, self-contained and ported from ck-code's `ck-affected`. It computes the tests a change can reach by following imports transitively (a service's test, the test of the controller that uses it, …), using `git` and `grep` with no token cost. It splits the project into areas from workspace packages, `.ck-test-areas`, or the `## Areas` table already in `docs/ARCHITECTURE.md`.

### Changed
- **build**: a task's closing run is no longer the full suite. It runs every test the task can reach through `test-one`, and the full `test` only for repo-root config, a lockfile alone, migrations, fixtures or env files. A wave's merged-result check runs every test of each area the wave touches, never the others.
- **ship**: before the first push, an **area check** runs every test of each area the branch touches, and a failure keeps the commit but blocks the push. It is skipped on a standalone repo with no `## Commands`.

## [1.4.2] — 2026-10-13

### Fixed
- **mod**: compaction after a wave run now fires with background builders — the builder count runs since the last compaction and waits until no `task-builder` is live, instead of resetting every turn.
- **mod**: the lite-project rule (`isLiteLayout`) now matches the skills' plugin guards — a `tasks/PLAN.md` beside an unstamped `docs/architecture/` stays lite's — and the project is found from the session's folder upward, so a shell `cd` into a subfolder keeps the band and the guard.
- **mod**: the PLAN.md guard also covers builder worktree copies and tells how a CORRUPT task is repaired; titles containing ` · ` are kept whole; `/lite-*` answers instead of failing when `ck-lite` cannot run; Hide persists across sessions, and a hidden band no longer runs `ck-lite open` every turn.
- **build**: the parallel-mode solo clean check allows `docs/design-system` and `docs/design-brief.md`, as P1 does — no false "uncommitted work" stop in a UI project.
- **build**: the redirect to ck-code carries `--auto` over to `/ck-code:build`.
- **README**: `design` is listed among the skills both plugins share.

## [1.4.1] — 2026-10-13

### Changed
- **mod**: a livelier band, a toast when a task is done, a 🎉 toast when the whole plan is. The band now opens with `◆ ck-lite`, a progress bar and the done/total score with a percentage, then the task in progress (`⚡`) and the next build command (`→`), each in a theme color. It falls back to one row when only one fits.

## [1.4.0] — 2026-10-13

### Added
- **mod**: the session is compacted by itself after a `/ck-code-lite:build` wave run. When a turn that dispatched two or more `task-builder` agents ends cleanly and `ck-lite open` shows no task `doing`, the mod calls `$.session.compact` between turns, with a hint to keep the tasks built, branches, the manual-test checklist and the next command. An interrupt, an error, a held task or a prompt already typed leaves the session as it is. The new `compact_after_waves` setting (on by default) turns it off.

## [1.3.0] — 2026-10-13

### Added
- **mod**: ck-code-lite ships a small mod, an in-process hooks module (`hooks/mod/register.tsx`, Claude Code ≥ 2.1.287) that acts only in a lite project and calls `ck-lite`, so nothing in it is load-bearing:
  - a **band above the prompt** with the task in progress, the counts and the next `/ck-code-lite:build T-NN` (**Use** fills the prompt; `/lite-band` toggles; the `band` setting turns it off);
  - **commands with no model turn**: `/lite-status` (`ck-lite open`), `/lite-waves [T-NN…]`, `/lite-check`;
  - a **guard**: a `Write` or `Edit` of `tasks/PLAN.md` is refused with the `ck-lite` command to use;
  - **no AI attribution** in commits and PRs, as `ship` requires;
  - **task-id completion** for `T-` in the prompt box.
- **tests**: `tests/mod/` (13 offline tests, `claude plugin test`), run in CI's new `mod` job.

### Changed
- **prompt router**: now the mod's `prompt.submit` hook; `scripts/prompt-router.sh` and its `UserPromptSubmit` entry are removed. It also skips prompts that are not the person's own. Ships alongside ck-code 7.13.1, whose mod uses the same rule for what a lite project is.

## [1.2.1] — 2026-10-12

### Changed
- **start**, **design**, **build**, **ship**: the wrong-plugin guard now redirects instead of blocking. In a full ck-code project the skill runs its ck-code counterpart for you (`build` → `/ck-code:build`, `ship` → `/ck-code:ship`, `start "<text>"` → `/ck-code:plan --quick`, `design <url>` → `/ck-code:design ds <url>`, an idea → `/ck-code:spec`), dropping lite-only arguments such as `T-NN`. A redirect happens once and never bounces back. The guard now treats `docs/architecture/` beside a `tasks/PLAN.md` as lite's own, so it can never disagree with ck-code's gate. It falls back to the ⛔ warning when ck-code is not installed.

## [1.2.0] — 2026-10-09

### Added
- **design** (new skill): design the UI with Claude Design before anything is built. With no argument or an idea, Claude describes the project back to you in one question round, then writes `docs/design-brief.md`. The brief is a complete prompt for claude.ai/design: real screens, real content, every empty, loading and error state, accessibility, and output conventions that make the result machine-readable. It is copied to the clipboard. `/ck-code-lite:design <url>` links the finished design system and caches every card and token under `docs/design-system/` (pull-only, same format as ck-code). Running it again refreshes the cache, which costs one call when nothing changed.
- **start**: a project with a UI is always offered "design first" once, inside the existing question round. Choosing it chains straight into the brief after the plan is written. A brief written before `start` becomes its requirement. The decision is recorded as a one-line `## Design` section in `docs/ARCHITECTURE.md`, and a decline is never asked again.
- **build**, **task-builder**: UI tasks build against the linked design. Each reads the screen's card first, then each component's card, and ports markup, class names and CSS exactly. The first UI task writes the token file, and parallel mode never fans out two UI tasks while the tokens are pending. A UI task reached while the design is still pending asks once: paste the URL to link it now, build without it, or stop. `--auto` builds without it and records a note.
- **qa-validator**: design fidelity. A literal color, size, radius, shadow or spacing value that a token covers fails QA.

## [1.1.2] — 2026-10-09

### Added
- **start**, **build**, **ship**: a wrong-plugin guard. A lite skill run in a full ck-code project (`tasks/VERSION.md` or `docs/architecture/` at the repo root) now prints a ⛔ warning naming the `/ck-code:` command to use, then stops before reading or writing anything. Before, a mistyped command could write a second plan beside the stories, or ship without moving the story's status.

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
