# The QA lane — one background run, nobody waits

Nobody sits in front of a running suite. Each task is checked by **one** run, in a checkout of its
own (the *lane*), while the build goes on. The only place that waits is the [gate](#the-gate)
before something leaves the machine. Read by `build` (Phase 5, P6–P8) and `ship`.

Why one run: measured over three weeks, builders spent 58 h and QA agents 39 h in front of a suite,
the same one ran two or three times per task, and 47 of 102 QA failures were review findings
reported only after the suite had ended.

## Who runs what

| Who | Runs | Never |
| --- | --- | --- |
| the builder (inline or `task-builder`) | its task's own test files in RED / GREEN / cleanup, then the [own check](tdd-cycle.md#own-check) once | the suite, the build, another task's tests |
| the reviewer (`ck-code-lite:qa-validator`) | nothing: criteria and fidelity, read from the code | any command |
| the lane | the affected suite, build and lint, once | — |
| `ship` | the area check in the lane, and the heavy suites the user chose | — |

## Start it

**In one message**: the start, the reviewer dispatch, and the wait as a background Bash call.
A call the harness refuses in that message is sent again on its own.

```bash
ck-lite-qa start T-05 --at work --base auto test="@ck-lite-affected {base} --command '<test>' '<test-one>'" build='<build>' lint='<lint>'
```

```bash
ck-lite-qa wait T-05 --end      # Bash run_in_background: true — its end notifies you
```

- The commands are `## Commands`'; `(none)` is dropped, and with no `test-one`, `test` is passed
  twice. Write `{base}` and `@` literally: the lane resolves them, `{base}` to the last state that
  passed this command. Add `--parallel` only when the commands share no build tree.
- `--at work` checks the working copy as it stands, uncommitted work included (inline builds never
  commit). A wave checks its commit instead: no `--at`, `--base <base-sha>`, and `--area` in the
  expression.
- Editing, committing, switching branch and building the next task never disturb it.
- **Check forms only**: a label that rewrites tracked files fails (`eslint --fix`, a formatter,
  `jest -u`), because it would vouch for code nobody committed. A script that does (`"lint": "eslint
  --fix"`) is replaced by its check form.
- A newer start of the same commands replaces one still queued: `SUPERSEDED` (exit 4) is not a
  failure. `STARTED … leave it alone` (the lane is `off` here): do not edit until it ends.
- `start` refused (no git, no commit) → `ck-lite-qa run` with the same labels, and say so.

## While it runs

| May go on | Must wait for green |
| --- | --- |
| review fixes, the manual-test question, the wave's merge, the next wave — **one ahead** | `ship`'s push and any PR, wave N+2 |
| another task the user asks for, on its own branch | `ck-lite done` of an inline task |

Say it in one line when moving on: `QA: T-05 running in the background.` Never call a task or run
finished while one is pending. **Nothing left to do but the run** → end the turn with that line;
the notification resumes it. Under `--auto`, or with no background Bash, run `ck-lite-qa wait` in
the foreground until it ends instead. Never write a wait loop.

## When it ends

- **`PASS`** → carry on. **`BASELINE`** → the label fails exactly as it did at the base, nothing
  new: not red, named in the report and the PR body. A chained command (`a && b`) is never compared.
- **`FAIL — setup: …`** → no test ran; the lane lacks something the checkout has. A step the
  project documents (a codegen script) → `.ck-qa-lane` with `setup: <command>`, else with `off`,
  named in the report; then `ck-lite-qa gate --again --base auto`.
- **`FAIL` on a test the change cannot reach** → `ck-lite-qa gate --again --base auto` once; it
  passes → name the flaky test.
- **`FAIL`** → fix forward where the code is: inline, or `SendMessage` the task's agent the labels,
  excerpt and log path (wave already merged: one `ck-code-lite:task-builder` solo on `$TARGET`; a
  later solo wave in flight finishes first). A `lesson:` line is tried first. Then the own check,
  and start again. **Cap 3** red runs, then `FIX MANUALLY / ACCEPT AS-IS / ABORT` (`--auto`: the
  run stops, `ck-lite set doing` the tasks it implicates, with a note).
  `ACCEPT AS-IS` → `ck-lite-qa waive T-05 "<the user's reason>"`.

## The gate

```bash
ck-lite-qa gate --base auto
```

| Prints | Then |
| --- | --- |
| `gate GREEN`, `gate NONE` | go on |
| `gate PENDING — <ids>` | `ck-lite-qa wait <id> --end` as a background call; prepare the PR text meanwhile |
| `gate UNCHECKED` | code changed after the last pass, or a run was lost: `ck-lite-qa gate --again --base auto`, then as PENDING |
| `gate RED` | nothing leaves the machine: name the run, fix it as above |

`WAIVED` and `BASELINE` lines go into the PR body, word for word. A change to `tasks/`, `docs/` or
Markdown never voids a pass. `build` runs it at its start too: `RED` from an earlier session comes
before new work.

## The lane itself

One per repository under `~/.ck-qa/lanes` (`CK_QA_LANE_DIR`), a detached worktree locked as `ck-qa
lane`, made and removed by the script alone: never a task's worktree. Its `node_modules` are
copies, copy-on-write where the disk can; build output is real. It stays warm for the next run; `ck-lite-qa lane-free`
removes it, as does 7 days without use.

## Rules

- **Never wait on a suite while there is other work**, and never poll one.
- **Never run the suite in a builder, a reviewer or the orchestrating context.**
- **Never push or open a PR without `gate GREEN` or `NONE`.**
- **Never go more than one wave ahead of a run that is not green.**
- **Never read `SUPERSEDED`, `PENDING` or a missing result as green**, and never `waive` without
  the user's answer.
