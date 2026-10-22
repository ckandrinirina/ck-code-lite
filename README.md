# ck-code-lite

Four skills. Two files. Ship an app fast without losing the steps that keep it correct.

`ck-code-lite` is the fast path: describe what you want, get an architecture doc and a
flat task list, then build tasks one at a time — each with a failing test first, a bounded
cleanup pass that refuses to keep code the repo already has, an isolated QA pass, and your
own hands-on sign-off before it counts as done. The bookkeeping between those steps is
scripted, so a run's cost tracks the work in front of it, not the age of the project.

## Skills

| Skill | Use it when | Produces |
|---|---|---|
| `/ck-code-lite:start` | A project needs its plan — new idea, existing codebase, or more tasks | `docs/ARCHITECTURE.md`, `tasks/PLAN.md` |
| `/ck-code-lite:design` | A project with a UI should be designed with Claude Design first — or you have a claude.ai/design URL to link — or you want an existing app replicated (`replicate <source>`) | `docs/design-brief.md`, `docs/design-system/`, `docs/replica/` |
| `/ck-code-lite:build` | Implementing one task end to end — or several at once, in waves | Code, tests, tasks marked `done` |
| `/ck-code-lite:ship` | Committing finished work | A conventional commit, an area test check before the push, and a PR |
| `/ck-code-lite:release` | Publishing a new version: bump, tag, build, release | A merged release PR, a tag, the project's build started and checked |

```
/ck-code-lite:start "a CLI that counts words in a file"
/ck-code-lite:build
/ck-code-lite:ship
```

### Releases that follow the project's own process

`release` publishes a version the way **this project** does it. The steps are written once in
`docs/RELEASE.md`: which files carry the version, how the release PR merges, where the build
runs, and how to check what was published. The first run drafts that recipe from facts it
gathers in one call and shows it for approval. Every later release follows it without asking,
except for one version question. A step only you can do, such as a merge, a secret or a store
upload, is asked and then checked, never waited on in silence. Running `release` again resumes
a release that stopped half way.

A project whose private repo has run out of Actions minutes, with installers built in a public
repo started by hand, is handled: the tag is pushed, the public workflow is dispatched, and its
build is watched in the background down to one result line. What one project learns is kept as a
one-line lesson in `~/.claude/ck-lessons.md`, which every project on the machine and both ck
plugins read. A lesson is printed only when it matches the project's facts or the error at hand,
so it costs nothing until it applies.

### Design first with Claude Design

A project with a UI is offered a design-first step before anything is built — once, in
`start`'s single question round. Say yes and Claude describes the product back to you, asks
only what the design depends on (brand, platform, dark mode), and writes
`docs/design-brief.md`: a complete prompt for [claude.ai/design](https://claude.ai/design),
with real screens, real content, every empty, loading and error state, and output conventions
that make the result machine-readable. The brief is copied to your clipboard.

```
/ck-code-lite:design "a habit tracker for runners"   # describe → brief (or let start chain it)
# paste the brief at claude.ai/design, iterate, copy the project URL
/ck-code-lite:design https://claude.ai/design/p/…    # link: tokens + every card cached in the repo
/ck-code-lite:build                                  # UI tasks port the cached components exactly
```

Linking caches the whole design system under `docs/design-system/` — foundations as tokens,
every component and screen card verbatim — so builds never touch the network. The first UI
task writes the token file; every UI task reads the screen's card, then each component's card,
and ports markup, class names and CSS exactly; QA fails a literal color, size or spacing value a
token covers. A UI task reached while the design is still pending asks once: paste the URL to
link now, build without it, or stop. `/ck-code-lite:design` again refreshes the cache — one call
when nothing changed.

### Replicate an existing app

Point `design` at software you want copied and it captures it, then writes a spec to plan from:

```
/ck-code-lite:design replicate https://app.example.com     # website or web app (login: ck-lite-replicate login <url>)
/ck-code-lite:design replicate "/Applications/Some App.app" # Electron: real DOM; native macOS: UI tree, strings, colors
/ck-code-lite:design replicate cli mytool                  # a CLI's whole --help tree
```

Android (adb) and iOS Simulator apps are snapped screen by screen as you navigate; a source
tree or plain screenshots work too. `ck-lite-replicate` needs only Node ≥ 22 and an installed
Chrome — no npm install. The result is `docs/replica/<slug>/REPLICA.md`: every screen with its
reference screenshots, flows, the captured tokens, components, data and the states it could not
see. Someone else's product is replicated as **reference only** — layout, flows and the token
system, never its logo, name, imagery or copy. `start` turns each screen into a task, and a UI
task shoots the running app, diffs it against the reference and fixes what differs, once.

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

### Quick builds for cosmetic tasks

A task whose whole change is a label, copy, a style or token, an icon or a constant (size `S`,
at most three named files, no new behaviour) takes the **QUICK** route on its own, announced in
one line. It skips the context scout, stack research, the cleanup pass and the QA agent. It
keeps the checks: a test that asserts the old value is updated first and seen failing, the
affected tests, build and lint still run (inline, reusing the passing run), and the manual
gate is one or two steps. The moment the diff grows past three files or 40 lines, or needs a
behaviour test, it steps back to the normal route by itself. `--full` forces the normal route,
and `--quick` asks for QUICK but still checks that the task qualifies.

```
/ck-code-lite:build T-04 --quick   # still refused when the task is not cosmetic
/ck-code-lite:build T-04 --full    # the normal route, whatever the task
```

### Tests never take your focus

No test run opens a browser or an app window in front of you. `ck-lite-qa` runs every command
with `E2E_HEADLESS=1`, and before any task code `build` runs `ck-lite-headless`. It lists the
setups that would show a window: `headless: false`, `--headed`/`--ui`/`--debug`, `cypress open`,
and an Electron e2e suite whose app never hides its window. `build` converts each one right
away, without asking (an Electron app keeps its window hidden and out of the Dock under
`E2E_HEADLESS`). A line marked `ck-headless: allow` is left as it is.

### Parallel builds share the CPU

Every build, test and lint run on the machine — any project, any worktree, and ck-code's
`ck-qa` too — takes one of `CK_QA_SLOTS` CPU slots first (default: cores ÷ 8, at least 1;
`0` turns it off). Three worktrees building at once take turns instead of each using every
core, so the first result arrives sooner and the machine stays responsive. Inside a slot a
CMake or cargo build gets the slot's share of the cores (unless you set
`CMAKE_BUILD_PARALLEL_LEVEL` / `CARGO_BUILD_JOBS`), commands run under `nice -n 10`
(`CK_QA_NICE`), and an installed [ccache](https://ccache.dev) serves every worktree's cold
C/C++ build from one cache — `brew install ccache` to turn that on.

Two slow suites run less. `ctest` gets `-j` (the run's share of the cores) once a parallel run
has passed like a serial one — 82 s → 10 s on a 590-test suite. An end-to-end suite
(`test-e2e`) never runs whole inside a task: each task runs only its own specs, and `ship`
runs the whole e2e suite once with the area check, before the first push.

### Every prompt goes through the workflow

You do not have to type the slash command. In an adopted project (one with `tasks/PLAN.md`
or `docs/ARCHITECTURE.md`) the mod's `prompt.submit` hook ([below](#the-mod)) injects
[`references/prompt-routing.md`](references/prompt-routing.md) — a three-line intent → skill
table — as context for each free-text prompt, so "implement T-03" runs `build`, "the parser
crashes on empty input" runs `start` to add the task and then `build`, and "ship it" runs
`ship`. The chosen skill is announced in one line and invoked; the prompt is the consent. The
hook stays silent on a slash command, on a reply shorter than 12 characters (an answer to a
running skill), in a repo that never adopted the workflow, and in a full ck-code project,
whose own router owns the prompt. It also skips anything that is not your own prompt (a task
notification, another session's message). Pure local read; a failure lets the prompt through.

### The mod

ck-code-lite ships a small **mod**, an in-process hooks module (`hooks/mod/register.tsx`,
Claude Code ≥ 2.1.287). Apart from the cost guard below, it acts only in a lite project and
calls `ck-lite`, the script the skills call, so nothing in it is load-bearing: under `--bare`, `--safe-mode` or an older
Claude Code every skill still works. A lite project follows the skills' own rule: no
`tasks/VERSION.md` stamp, and `tasks/PLAN.md` (even beside an unstamped `docs/architecture/`)
or a `docs/ARCHITECTURE.md` with no `docs/architecture/` beside it — read from the nearest
folder up holding `tasks/` or `docs/`, so a `cd` into a subfolder keeps it.

- **Band above the prompt** — `◆ ck-lite ▰▰▰▰▱▱▱▱▱▱ 4/7 57% 2 open · 1 ready`, then
  `▸ T-05 Count words → /ck-code-lite:build T-05`, with **Use** (fills the prompt, never sends
  it) and **Hide**; that row folds away 8 s after a turn ends, leaving the progress line. It refreshes after every turn, and not at all while hidden; **Hide** and
  `/lite-band` (which toggles it) are both kept across sessions. The `band` setting turns it off.
  Outside the fullscreen layout (`/tui default`, tmux) a click never reaches the band: press
  **ctrl+x tab** to focus it, then **u** (Use) or **h** (Hide); the band names these keys there.
- **Cheers** — a toast when a task is done (`✦ T-04 done — 4/7 (57%)`), and a bigger one when
  the whole plan is (`★ Plan complete — 7/7 tasks done!`).
- **The ck look** — in a lite project, flat one-cell glyphs replace the default tool rows: `⌕`
  searches, `≡` reads, `✎` writes, `±` edits, `❯` shell, `◈` agents, `✦` skills, `☐`/`▣` tasks,
  each with its subject and state (`◌` running, `✓` done, `✗` failed); a folded run of reads and
  searches is one line (`✓ ≡ 3 · ⌕ 2`), and the spinner says *Test-driving…*. Terminal only. The
  `theme` setting turns it off.
- **Task board** — a task builder's own task list (RED, GREEN, cleanup, closing run) shows on the
  band while it runs: `◈ Build T-03 ▰▰▱▱ 2/4 ▸ Writing the failing test`. The build skill opens
  a task list in the session too, one task per phase, or one per dispatched task in waves.
- **Compact after a wave run** — once two or more task builders have been dispatched since the
  last compaction, the first turn that ends cleanly with no builder still running and no task
  left `doing` compacts the session between turns (background builders included), keeping the tasks
  built, the branches, the manual-test checklist and the next command. Skipped after an
  interrupt or an error, while a task is held, or once you have typed the next prompt. The
  `compact_after_waves` setting turns it off.
- **Commands with no model turn** — `/lite-status` (`ck-lite open`), `/lite-waves [T-NN…]`
  (the wave plan) and `/lite-check` (validates the plan) print at once, even mid-turn.
- **The plan is written only through `ck-lite`** — a `Write` or `Edit` of `tasks/PLAN.md` is
  refused with the `ck-lite` command to use ([plan-format.md](references/plan-format.md)), or,
  for a `CORRUPT` task no `ck-lite` write repairs, a request that you fix the named lines.
- **No AI attribution** — the engine's commit and PR attribution text is dropped, as `ship`
  requires.
- **Task-id completion** — typing `T-0` in the prompt box offers the open tasks.
- **Update check** — in every project: when the marketplace serves a newer ck-code-lite than the
  one loaded, one toast per new version and a band row until you update
  (`▸ ck-code-lite 1.10.0 is out (you have 1.8.0) · /plugin update ck-code-lite@ck-marketplace, then restart`).
  Checked at most every 6 hours, never for a `--plugin-dir` checkout. The `update_check` setting
  (or `CK_UPDATE_CHECK=off`, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) turns it off.
- **Cost guard** — the one part active in every project: caps every model request and
  sub-agent at `high` effort, refuses a `fable` dispatch until you approve it, and gives an
  `Explore` or `general-purpose` dispatch with no `model:` a cheap one (`haiku` / `sonnet`)
  instead of your session model. The `cost_guard` setting turns it off. Code search and
  technology research run in the `context-scout` and `researcher` agents (haiku, low effort),
  never in the main agent; `task-builder` runs on `sonnet`.

`claude plugin validate .` and `claude plugin test .` check it offline (`tests/mod/`), and CI
runs both.

### Plugin redirect

`start`, `design`, `build`, `ship` and `release` never run in a full ck-code project (`tasks/VERSION.md`,
or `docs/architecture/` with no `tasks/PLAN.md`). Before reading or writing anything they run
the ck-code counterpart for you — `build` → `/ck-code:build`, `ship` → `/ck-code:ship`,
`start "<text>"` → `/ck-code:plan --quick`, `design <url>` → `/ck-code:design ds <url>` — so a
mistyped command never writes a second plan beside the stories. ck-code does the same in the
other direction: `/ck-code:build T-03` in a lite project runs `/ck-code-lite:build T-03`. A
redirect happens once, never back, and falls back to a ⛔ warning when the other plugin is
not installed.

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
`test-one` command). After cleanup, the closing run covers every test the task can reach: the
tests of each changed file, then of every file importing it — a service's test, the test of
the controller that uses it, and on up the chain. `ck-lite-affected` works that out with `git`
and `grep`, at no token cost. A wave's merged result and `ship`, before the first push, run
every test of each **area** the change touches — a workspace package or a row of `## Areas` —
so a backoffice change never runs the client's suite. The whole suite runs only for repo-root
config, a lockfile alone, migrations, fixtures or env files. Every test, build and lint run
goes through `ck-lite-qa`, which prints one line per command and keeps the output in a log,
and an inline QA pass reuses the closing run when not a byte of code changed since. A
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

Tested against Claude Code 2.1.299. The skills run on any recent release; [the mod](#the-mod)
needs 2.1.287 or later.

## ck-code-lite or ck-code?

They are **alternatives, not companions** — enable one per project. Both expose `build`,
`design` and `ship`, and running a project through both layouts will not end well.

| | ck-code-lite | ck-code |
|---|---|---|
| Skills | 4 | 15 |
| Planning artefacts | 2 files | epics, per-story files, generated indexes |
| Architecture | 1 core doc + optional area docs | per-feature docs + shared globals |
| Parallel builds | yes, inside `build` | yes, inside `build`, with conflict analysis |
| Claude Design | brief, link, full cache (`design`) | brief (`spec`), link, lazy cache (`design ds`) |
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
