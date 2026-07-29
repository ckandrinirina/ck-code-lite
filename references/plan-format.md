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

Each task ID **owns exactly three lines**: the table row, the `## T-NN` header, and the
meta line directly under that header. That redundancy is what replaces a generated index,
and it is verified with one command:

```bash
grep -nE "^(\| T-01 \||## T-01 |T-01 · )" tasks/PLAN.md
```

Expect three hits. The table row and the meta line must report the **same status**.

Each alternative is anchored to the start of a line, so the check returns the three lines
the task owns and nothing else. An unanchored `grep -n "T-01"` also matches every *other*
task that lists `T-01` in its `needs`, so it returns three hits only for a task nothing
depends on — and more, unpredictably, for every other. It also cannot tell `T-01` from
`T-010`. Use the anchored form.

**Sync rule — absolute:** every status change edits the table row and the meta line in
the same Edit pass, and runs the grep above in the same phase to confirm they agree.
A status written in one place and not the other is a corrupt plan.

## Reading the plan cheaply

`tasks/PLAN.md` grows without bound, and every task ever written stays in it. **Never read
it whole, and never read the whole table.** Cost per run is a function of *open* work, not
of project age — these three recipes are what keep it that way.

```bash
# open work — the only rows a skill needs to pick or schedule a task
grep -nE '^\| T-[0-9]+ \|.*\| (todo|doing|blocked) \|' tasks/PLAN.md

# one task's section, whole, no offsets and no header list
awk '/^## T-05 /{f=1} f&&/^## T-/&&!/^## T-05 /{exit} f' tasks/PLAN.md

# progress, as integers rather than rows
grep -c '^| T-' tasks/PLAN.md                              # total
grep -cE '^\| T-[0-9]+ \|.*\| done \|' tasks/PLAN.md       # done
```

The trailing space in `^## T-05 ` is load-bearing: it separates `T-05` from `T-050`. The
`awk` form prints from the header to the line before the next task and needs no offset, so
it costs the same on a 500-task plan as on a five-task one. It prints nothing and exits `0`
for an ID that does not exist.

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
dependency — the anchored three-line grep returns `0` where it must return `3`. Check it
before treating an absent ID as done.

`needs` and `files` carry a second job in a parallel run: `needs` orders the waves, and
two tasks whose `files` lists share a path are never dispatched in the same wave. Neither
field changes shape for it — an accurate `files` line simply buys more parallelism.

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
