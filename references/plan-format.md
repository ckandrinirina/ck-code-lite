# tasks/PLAN.md — the format contract

One flat file holds every task. There is no generator, no index, no per-task file. The
format below is a contract, and `ck-lite` (`bin/`) is the only thing that reads or writes it:
no skill ever `Read`s or `Edit`s `tasks/PLAN.md`.

## Shape

```markdown
# PLAN — Word count CLI

| ID | Title | Status | Size | Needs |
|---|---|---|---|---|
| T-01 | Count words in a file | todo | S | — |
| T-02 | Report an error for a missing file | todo | S | T-01 |

## T-01 Count words in a file

T-01 · status: todo · size: S · needs: — · files: src/count.js, test/count.test.js

### Acceptance
- [ ] A file of three words reports 3
- [ ] An empty file reports 0

### Tasks
- [ ] Failing tests for both criteria
- [ ] Implement the counter
```

## Fields

| Field | Rule |
|---|---|
| ID | `T-NN`, zero-padded, assigned in creation order. Never reused, never renumbered. |
| Title | Plain language, describes the outcome a user gets. No file paths, no class names. |
| Status | Exactly one of `todo`, `doing`, `done`, `blocked`. Nothing else parses. |
| Size | Exactly `S` or `M`. Anything larger is split into two tasks before it is written. |
| Needs | Comma-separated task IDs, or `—` (em dash) when there is no dependency. |
| files | Comma-separated paths. Live field — `build` appends every file it touches. |

## The three-line rule

Each task ID **owns exactly three lines**: the table row, the `## T-NN` header, and the
meta line directly under that header, with the row and the meta line reporting the **same
status**. That redundancy is what replaces a generated index: `ck-lite` checks it before and
after every write, and refuses to write a task that breaks it. IDs match anchored with a
trailing separator, so `T-01` never matches `T-010` or a `needs: T-01` elsewhere.

**Sync rule — absolute:** a status moves through `ck-lite set|done`, which rewrites the row
and the meta line in one pass and re-runs the three-line check before it returns. A status
written in one place and not the other is a corrupt plan; `ck-lite check` finds every one.

## Every access goes through `ck-lite`

`tasks/PLAN.md` grows without bound and every task ever written stays in it. `ck-lite` parses
the whole file in a pipe and prints only what was asked, so **a caller's cost tracks open work,
not project age** — a plan with 400 done tasks and 3 open ones costs what a 3-task plan does.

| Need | Command | Prints |
|---|---|---|
| open work, readiness worked out | `ck-lite open` | one line per open task (`READY`, `wait(T-…)`, `doing`, `blocked`, `CORRUPT(…)`), then counts |
| one task's section | `ck-lite show T-05` | header to the line before the next task |
| criteria for a wave | `ck-lite criteria T-02 T-05` | `== T-NN` then its acceptance boxes |
| everything `build` needs for a task | `ck-lite context T-05` | `ARCHITECTURE.md`, the area docs its `files:` touch, the section |
| dependency-ordered waves | `ck-lite waves T-02 T-05` · `--all` · `--next` | waves, unschedulable tasks with the reason |
| a status move | `ck-lite set doing T-05 T-06` | `T-05: todo → doing` |
| record touched paths | `ck-lite files T-05 src/a.ts` | `files +N`, already-listed paths skipped |
| a dated note | `ck-lite note T-05 "<text>"` | appended under `### Notes`, opened if absent |
| finish | `ck-lite done T-05 [paths…]` | ticks every box in the section, appends paths, `→ done` |
| new tasks | `ck-lite next-id`, then `ck-lite add` (sections on stdin) | the table rows are generated |
| a new plan | `ck-lite init "<project name>"` | the heading and an empty table |
| remove a mistaken task | `ck-lite drop T-08` | only `todo`/`blocked`, only when nothing `needs` it |
| integrity | `ck-lite check` | every defect, exit 1 — or `OK — N tasks` |

Why a script and not `grep` + `Edit`: an `Edit` needs a `Read` of the file first, and that
`Read` is the one access whose cost grows with every task ever written. `ck-lite` makes every
write a single call with no read, and the three-line check part of the write itself.

Every write holds a lock on the plan, so parallel calls queue instead of dropping each other's
updates, and builds the new plan in a temp file that replaces the old one only when it adds no
defect `ck-lite check` would report — a refused write leaves the file byte-identical. CRLF
plans are read fine and written back as LF. The file stays plain Markdown: a `CORRUPT` task,
which no write will touch, is repaired by a human editing the lines `ck-lite check` names.

A full conversion — `/ck-code:migrate` reading every task, done ones included — is the one
caller that legitimately reads all rows. No skill in this plugin does.

## Readiness

A task is **ready** when its status is `todo` and every ID in its `needs` list has
status `done`. `blocked` is set by a human to park a task for a reason outside the plan;
it is never inferred from `needs`.

**The open-set invariant:** the status vocabulary is closed at four values, so an ID that
does not appear in the open-work read is `done`. Readiness resolves against that set alone
— a task is ready when its own row says `todo` and none of its `needs` IDs appear in the
set. No skill ever needs a `done` row to prove a dependency is satisfied.

An ID in `needs` that appears nowhere in the file is a **corrupt plan**, not a satisfied
dependency — `ck-lite open` prints it as `CORRUPT(needs T-NN — not in the plan)` rather than
treating it as done.

`needs` and `files` carry a second job in a parallel run: `needs` orders the waves, and
two tasks whose `files` lists share a path are never dispatched in the same wave. Neither
field changes shape for it — an accurate `files` line simply buys more parallelism.

## Appending

New tasks always go at the end of the table and the end of the file. `ck-lite next-id` gives
the first free ID; write the sections with real IDs (a new task may `need` another new one),
pipe them to `ck-lite add`, and it generates the table rows, inserts them after the last row,
appends the sections, and refuses the whole batch on a duplicate, out-of-order or over-padded
ID, an unknown, self- or circular `needs`, a size other than `S`/`M`, a `|` in a title, or a
body line shaped like a table row or meta line. Never renumber, never reorder, never rewrite an
existing section. `ck-lite drop` removes a mistaken `todo` or `blocked` task nothing depends
on; when it was the highest ID, `next-id` may hand that ID out again.

## Optional sections

A task may carry a `### Notes` section for anything that does not fit the two required
lists — a documented exception, a manual-test finding, a decision made mid-build. Written by
`ck-lite note`, one dated line each. Nothing parses it; it is there for the human.

## Why one file, at any size

The plan is never split. Every access above costs the same at 5 tasks or 500, so a second
file (an archive of done tasks) would buy no tokens and add a lookup to every dependency
check and to the migrator. What does grow is the architecture doc, which every `build`
reads — that one splits into areas ([architecture-template.md](../skills/start/references/architecture-template.md#areas)).
