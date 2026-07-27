# tasks/PLAN.md — the format contract

One flat file holds every task. There is no generator, no index, no per-task file.
All three skills read and write this file directly, so the format below is a contract.

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

Each task ID appears on **exactly three lines**: the table row, the `## T-NN` header,
and the meta line directly under that header. That redundancy is what replaces a
generated index, and it is verified with one command:

```bash
grep -n "T-01" tasks/PLAN.md
```

Expect three hits. The table row and the meta line must report the **same status**.

**Sync rule — absolute:** every status change edits the table row and the meta line in
the same Edit pass, and runs the grep above in the same phase to confirm they agree.
A status written in one place and not the other is a corrupt plan.

## Reading the plan cheaply

`tasks/PLAN.md` grows without bound. Never read it whole.

```bash
grep -n '^| T-' tasks/PLAN.md          # the table — enough to pick a task
grep -n '^## T-' tasks/PLAN.md         # section offsets, for a targeted Read
```

Read a single task's body with `Read` using the offset from the second command, bounded
by the next `## T-` line.

## Readiness

A task is **ready** when its status is `todo` and every ID in its `needs` list has
status `done`. `blocked` is set by a human to park a task for a reason outside the plan;
it is never inferred from `needs`.

## Appending

New tasks always go at the end of the table and the end of the file.

```bash
grep -o '^## T-[0-9]*' tasks/PLAN.md | tail -1     # highest existing ID
```

Next ID is that number plus one. Never renumber, never reorder, never rewrite an
existing section.

## Optional sections

A task may carry a `### Notes` section for anything that does not fit the two required
lists — a documented exception, a manual-test finding, a decision made mid-build.
Nothing parses it; it is there for the human.
