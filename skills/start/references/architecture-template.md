# docs/ARCHITECTURE.md — template

One core file, plus optional area docs once it grows. `build` reads the core and only the area
docs a task's `files:` touch (`ck-lite context T-NN`), so every line in the core is paid on
every build and every line in an area doc only by the tasks that work there.

The versions below show the format only — never copy them; every one is looked up
([stack-research.md](../../../references/stack-research.md)).

```markdown
# ARCHITECTURE — <project name>

<One paragraph: what this project is and who uses it.>

## Stack

- **Language:** TypeScript 5.9 (Node 24 LTS) — verified 2026-10-08
- **Framework:** Hono 4.9 — verified 2026-10-08
  - Chain routes off one `app` so the RPC client infers their types
- **Storage:** SQLite via better-sqlite3 12.4 — verified 2026-10-08
- **Testing:** Vitest 3.2 — verified 2026-10-08
- **Package manager:** pnpm 10 — verified 2026-10-08

## Commands

- test: pnpm run test
- test-one: pnpm run test -- {files}
- build: pnpm run build
- lint: pnpm run lint

## Folder structure

```
src/
  routes/       HTTP handlers, one file per resource
  domain/       business rules — no I/O, no framework imports
  db/           schema and queries
test/           mirrors src/, one .test.ts per source file
```

## Decisions

One line each, always with the reason. New decisions append at the bottom.

- SQLite over Postgres — single-writer workload, no ops burden
- Domain layer has no framework imports — keeps the rules testable without a server

## Conventions

- Files kebab-case, exported types PascalCase
- Every route handler returns a typed result, never a raw response object
- Errors carry a machine-readable `code` alongside the message

## Areas

| Area | Doc | Paths |
|---|---|---|
| billing | docs/areas/billing.md | src/billing/, test/billing/ |
```

`## Areas` is absent until the first split — a small project never has it.

## Section rules

**Stack** — what is actually installed, resolved from the manifest and lockfile. Never
list something aspirational; if it is not a dependency yet, it belongs under Decisions
as an intent. Each line carries its version, a `verified` date, and up to 4 idiom bullets — the
project's cache of current practice, filled and refreshed per
[stack-research.md](../../../references/stack-research.md). `build` reads these bullets
instead of looking anything up, so they are the coding style every task follows.

**Commands** — verbatim runnable commands, resolved via
[stack-commands.md](../../../references/stack-commands.md). This section is read by
`/ck-code-lite:build` on every run and passed to QA, so a wrong command here means
every later QA verdict is wrong. `(none)` is a valid value and must not be guessed away.
`test-one` is optional: the test command narrowed to the files in `{files}`, which keeps the
RED/GREEN loop off the full suite. Omit the line when the runner cannot take paths.

**Folder structure** — only directories that exist or are about to. One line of purpose
each. No file-by-file inventory.

**Decisions** — newest at the bottom. This is the section that stops the same debate
happening twice, and the only one that grows with project age. `build` reads this file on
every run, so the section is kept to the choices that are still live:

- A **reversal folds into the line it replaces**, carrying both reasons —
  `Postgres over SQLite — concurrent writers; replaced SQLite, chosen when the workload was single-writer`.
  Never leave the superseded line standing beside its replacement: two lines saying
  opposite things is the one shape a reader cannot resolve.
- A decision the **toolchain now enforces** — a lint rule, a type, a CI gate — is deleted.
  The enforcement is the record, and the line is duplication that can silently go stale.
- Everything else stays. A decision that is still live and still unenforced earns its line
  however old it is.

Growth is then proportional to live architectural choices, not to project history. A
decision that only one area's code obeys moves to that area's doc at the next split.

**Conventions** — only rules a reader could not infer from the code in a minute. Skip
anything the linter already enforces.

## Areas

The core stays a page. When `ck-lite stats` reports the core past **150 lines**, `start`
(EXTEND mode) splits the largest self-contained area out of it — never earlier, and never
speculatively.

**What an area is** — a part of the code a task can work in without reading the rest: a
feature (`billing`), a layer (`api`), a surface (`web`). Its paths are directory prefixes,
ending in `/`, or single files. A task whose `files:` touch two areas gets both docs.

**What moves** — verbatim, never rewritten: that area's lines from `## Folder structure`, its
`## Decisions` (only it obeys them), its `## Conventions`, and any data shapes or interfaces it
owns. What stays in the core: the intro, `## Stack`, `## Commands`, the top level of
`## Folder structure`, cross-cutting decisions and conventions, and the `## Areas` table.

**The area doc** — `docs/areas/<area>.md`, same section rules as the core:

```markdown
# <Area>

<One paragraph: what this area owns, and what it never does.>

## Structure
## Decisions
## Conventions
## Interfaces
```

Omit a section with nothing in it. An area doc has the same one-page budget; an area doc past
150 lines, or more than about eight areas, is a project that has outgrown lite —
`/ck-code:migrate` turns each area into a feature doc.

**Routing is the `## Areas` table, and only it.** A doc under `docs/areas/` with no row is
never read; a row whose doc is missing is flagged by `ck-lite context`. Never put an area
doc under `docs/architecture/` — that directory marks a full ck-code project.
