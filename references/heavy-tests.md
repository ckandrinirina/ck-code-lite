# Heavy tests — slow suites run once per PR, not in the build

A suite that needs a database, a container, a running server or a browser is **heavy**: the
`test-e2e` and `test-integration` lines of `## Commands`. `build` never runs one. It writes and
marks the specs, and `ship` asks before the push.

## `.ck-heavy-tests` — the declaration

At the repo root, one suite a line:

```
integration: prisma/tests/**/*.e2e.spec.ts | npm run test:e2e:db -- {files}
e2e: e2e/**/*.spec.ts | npm run test:e2e -- {files}
```

`name: globs | command`. The command runs from the repo root and takes `{files}`. One that starts
with `cd <dir> && ` gets them relative to `<dir>`. A runner that accepts no paths gets no `{files}`
and always runs whole. `none` alone on a line says nothing here is heavy. The format is
ck-code's too, so the file survives a migration.

`ck-lite-affected` drops every declared file from a task's and an area's tests. When `test` would
still collect them, add the runner's exclusion to it (`--exclude '<glob>'` on vitest,
`--testPathIgnorePatterns` on jest, `--ignore-glob` on pytest).

**Undeclared** — `ck-lite-heavy detect` prints `CANDIDATE` lines. Write the suite lines they
imply (the config's `include` or `testMatch` gives the globs, the script gives the command), say so
in one line, and record the file with `ck-lite files T-05 .ck-heavy-tests`. `ck-lite-heavy: OK` →
nothing to do. PARALLEL MODE does it once at P1 and commits it on `$TARGET` as
`chore(tests): declare the heavy suites`, since a worktree sees only committed work. The user
turns it off with `none`.

## In a task

- **Mark the spec.** Every heavy test file a task adds or edits names the task in a comment near
  its top, in the file's own syntax: `// ck-heavy: T-05`. Append to the ids already there, never
  replace one. Never edit a file only to mark it. `ck-lite-heavy unmarked <base> T-05` must print
  nothing before the task closes.
- **Run only the file you wrote or edited**, for RED and for GREEN, one file at a time:

  ```bash
  ck-lite-qa run T-05-heavy integration="$(ck-lite-heavy command integration only prisma/tests/orders.e2e.spec.ts)"
  ```

  Run it from the repo root. Re-run it only after a change meant to turn it green. A spec no
  run has passed leaves its criterion unmet. A spec that cannot run here (no Docker, no service)
  is reported as **not run**, never as passed.
- **Never run another heavy file**, not as a regression check, at the closing run, or because
  a migration changed.
- **QA, the wave check and ship's area check** take no heavy label. A criterion proved only by a
  heavy spec passes on that spec's assertions, cited by `file:line`, plus the task's own run of it (`heavy: <file> — PASS` in the QA dispatch).

## At ship — one question

```bash
ck-lite-heavy scope auto T-05
```

The ids are the tasks on this branch (none in standalone mode). `ck-lite-heavy: NONE` → no question,
with one exception: no `.ck-heavy-tests` but `test-e2e` or `test-integration` lines offers `Whole
suite` / `Skip`. Otherwise "Run the heavy tests before the push?", with the counts:

1. `Linked only (3 files)` (recommended): marked with these ids, or changed on this branch
2. `Affected (16 files)`: plus every heavy file that imports the change. Drop this option when it
   equals linked or whole
3. `Whole suite (92 files)`
4. `Skip`

A linked count of 0 drops option 1. Run every suite with a non-zero count in one call, after the
area check, without `--parallel`, with a 600000 ms timeout. On `RUNNING`, `ck-lite-qa wait heavy`
until it prints a result:

```bash
ck-lite-qa run heavy integration="$(ck-lite-heavy command integration linked auto T-05)"
```

`PASS` → push. `FAIL` → do not push, keep the commit, show the failing specs and their marker's
task, and point at `/ck-code-lite:build T-NN` (a re-run needs only the failed files: `… only <file>…`).
An environment error (no Docker, port taken) → say so and ask again: retry, or skip. A skipped or
partial run is never silent. The PR body ends with one plain line: `Database and end-to-end tests:
not run before this PR.` or `… : run for this change only.`
