# docs/ARCHITECTURE.md — template

One file. Every section is short enough to read in under a minute. If a section grows
past a screen, the project has outgrown lite.

```markdown
# ARCHITECTURE — <project name>

<One paragraph: what this project is and who uses it.>

## Stack

- **Language:** TypeScript 5.x (Node 22)
- **Framework:** Hono
- **Storage:** SQLite via better-sqlite3
- **Testing:** Vitest
- **Package manager:** pnpm

## Commands

- test: pnpm test
- build: pnpm build
- lint: pnpm lint

## Folder structure

```
src/
  routes/       HTTP handlers, one file per resource
  domain/       business rules — no I/O, no framework imports
  db/           schema and queries
test/           mirrors src/, one .test.ts per source file
```

## Decisions

Append-only. One line each, always with the reason.

- SQLite over Postgres — single-writer workload, no ops burden
- Domain layer has no framework imports — keeps the rules testable without a server

## Conventions

- Files kebab-case, exported types PascalCase
- Every route handler returns a typed result, never a raw response object
- Errors carry a machine-readable `code` alongside the message
```

## Section rules

**Stack** — what is actually installed, resolved from the manifest and lockfile. Never
list something aspirational; if it is not a dependency yet, it belongs under Decisions
as an intent.

**Commands** — verbatim runnable commands, resolved via
[stack-commands.md](../../../references/stack-commands.md). This section is read by
`/ck-code-lite:build` on every run and passed to QA, so a wrong command here means
every later QA verdict is wrong. `(none)` is a valid value and must not be guessed away.

**Folder structure** — only directories that exist or are about to. One line of purpose
each. No file-by-file inventory.

**Decisions** — append-only, newest at the bottom. Never delete a decision; if one is
reversed, append the reversal with its reason. This is the section that stops the same
debate happening twice.

**Conventions** — only rules a reader could not infer from the code in a minute. Skip
anything the linter already enforces.
