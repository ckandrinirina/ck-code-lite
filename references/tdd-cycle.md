# The TDD cycle — RED, GREEN, cleanup

Read by `build` (Phases 3–4, inline) and by the `ck-code-lite:task-builder` agent (one task in
a parallel wave). Same rules in both places; only the caller's bookkeeping differs, and the
caller says how.

## Running tests

Every test, build and lint command runs through `ck-lite-qa`, never bare:

```bash
ck-lite-qa run T-05 one="pnpm run test -- test/count.test.js"
ck-lite-qa run T-05 test="pnpm run test"
```

Labels are letters, digits and `_` only — `one` for a `test-one` run, `test` for the full
suite; a hyphenated label is refused. It prints one line per command, plus the last 40 lines of a failure; the full log stays at the
printed path for a `Read` when 40 lines are not enough. It stamps every pass with the exact
code state, which is what lets the QA pass that follows skip a run on code that has not
changed since. Exit 3 prints `RUNNING`: the suite is still going, so continue it with the
`cd <dir> && ck-lite-qa wait T-05` line it prints (runs are per checkout) and never start it a
second time.

**Inner loop = the task's own tests.** When `## Commands` has a `test-one` line, RED and GREEN
run only the task's test files through it (`{files}` → the paths, space-separated). The full
`test` command runs **once**, as the cycle's last step, so a break elsewhere surfaces before QA.
With no `test-one`, every run is the full `test`.

Never run `build` or `lint` in the inner loop — QA runs both once. Never pipe a test command
into `tail`, `grep` or `head`: the log already holds everything, and a second run to see a
different slice of the same output is the most expensive habit this cycle can have.

## RED — the failing test comes first

**No implementation file is created or edited until a test run has been observed failing.**
Absolute.

**No test runner.** `test: (none)` stops the cycle. The caller presents the choice (name a
test command, or record a documented exception) — never pick the exception, and never proceed
as though RED happened. Under a recorded exception, RED and the Close run are skipped and
cleanup still applies; QA is told so with `exception: <reason>`.

**Write the tests.** At least one per `### Acceptance` checkbox, following the nearest existing
test file — same framework, naming and layout. Add the obvious edge case per criterion (empty
input, missing resource, boundary value) where one exists. Assert observable behaviour, never
implementation detail: a test that mirrors the code line for line passes a wrong one.

**Confirm they fail**, then report one line:

```
RED: 5 tests written, 5 failing — <first failure, one line>
```

A test that passes before any implementation exists is testing nothing. Fix it first.

## GREEN — minimum code

Write the **minimum** code that makes the failing tests pass. Reuse before adding: check for an
existing helper, type or utility first. Re-run after each significant change; stop as soon as
everything passes — never build ahead of the criteria.

Comments only where the code cannot speak for itself: a *why*, an invariant, a workaround with
its issue link, or a one-line doc comment on an exported symbol. Fewest words that stay
precise — fragments are fine (`// UTC; caller converts`); no filler (`This function…`), no
restating a name, param or type, no history (`// added for T-03`), no commented-out code.

**Track what was touched.** Every file edited that is not already in the task's `files:` is
recorded — inline with `ck-lite files T-05 <path>…`; a task-builder agent lists it in its
verdict instead, because it never writes the plan.

## Cleanup — one bounded pass

With tests green, one pass over the diff — the files this task touched, never wider:

1. **Already exists** — before keeping a new helper, type or utility, grep the repo for its
   verb + noun and for a distinctive line of its body. A hit means call or extend the existing
   one. GREEN said to reuse; this verifies it.
2. **Duplication** — the same block twice in the diff. Two copies differing by a value are a
   parameter; three are a helper.
3. **Dead code** — an export nothing imports, a parameter no body reads, an import no line uses,
   a branch no test reaches.
4. **Single-caller wrapper** — a wrapper with one caller and no behaviour of its own. Inline it.
5. **Beyond the criteria** — an option, flag or config key no criterion asked for. Delete it.
6. **Comments** — delete any the code already says; trim any longer than GREEN allows. A
   test's descriptive comment or a mandated file header is not a finding.

Also fix misleading names, and extract a function where one obviously wants to exist. Re-run
the task's tests after each change — green stays green. Leave alone what the codebase makes
deliberate: a boundary the architecture docs draw, or test setup repeated for readability.
Anything larger than a few minutes is its own task, not cleanup.

## Close — the full suite, once

Last step, after cleanup, with nothing left to edit: `ck-lite-qa run T-05 test="<test>"`. A
failure here is a break the task's own tests did not see — fix it and run it again. Its pass is
stamped on this exact code state; a code edit after it, however small, voids the stamp and QA
runs the suite again. Plan writes (`ck-lite files`, `note`, `set`) are not code and never void
it.
