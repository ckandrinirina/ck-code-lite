# Stack research — current versions and current idioms

Read by `start` (every mode) and by `build` / `task-builder` (only when a task adds a
dependency). A model's memory of "the latest version" is the version it was trained on — React
18 when 19 is current. **No version and no idiom is ever taken from memory.** Both are looked up
once, recorded in `docs/ARCHITECTURE.md` `## Stack`, and every later run reads them from there.

## The cache — `## Stack`

Each technology is one line with its version and the date it was verified, plus **up to 4 idiom
bullets**: the current way to write code with it, where that differs from what an older
version (or a model's memory) would produce.

```markdown
- **Framework:** React 19.2 — verified 2026-10-08
  - `ref` is a plain prop; no `forwardRef` in new code
  - Form submits use Actions + `useActionState`, not hand-rolled pending state
- **Testing:** Vitest 3.2 — verified 2026-10-08
```

(Format only — never copy these versions.) `ck-lite context` prints the core on every build,
so the bullets reach every task and every `task-builder` with **zero lookups**. Keep them to idioms that change the code written — never
generic advice ("write clean components"), never what the linter enforces, never a tutorial.
A technology with nothing version-specific to say gets no bullets.

**Fresh** — a stamp at most **90 days** old, with no `unverified` marker. `start` EXTEND
re-researches every other line — stale, `idioms unverified`, or `unverified` — by `Edit`ing it
in place (new version, new date, bullets replaced); `build` never refreshes, it only reads.

## Resolution order

### 1. Version — the package registry

Authoritative and cheap. **One foreground Bash call for every package at once** — never a
background shell, never one call per package — with a hard timeout, so a stalled registry costs
seconds, not the run:

```bash
for p in react vite vitest; do (printf '%s %s\n' "$p" "$(npm view "$p" version --fetch-timeout=15000 --fetch-retries=0 2>/dev/null || echo UNREACHABLE)") & done; wait
```

A package that prints `UNREACHABLE` (or anything not a version) takes the fallbacks below. Other
ecosystems, same shape:

| Ecosystem | Command |
|---|---|
| npm | `npm view react version` |
| PyPI | `pip index versions fastapi` (first line) |
| crates.io | `cargo search axum --limit 1` |
| Go | `go list -m github.com/labstack/echo/v4@latest` |
| RubyGems | `gem search '^rails$' --remote` |

Record the **latest stable** — never a pre-release, `next`, `rc` or `canary`. A runtime or
toolchain (Node, Python, Go) is the current **LTS / stable** release, from context7 or the
WebSearch fallback below. Registry unreachable → the same fallbacks.

### 2. Idioms — context7

1. **MCP** — when a `mcp__*context7*` tool is in this session: `resolve-library-id`, then
   `query-docs` with the version just resolved.
2. **CLI** — `npx -y ctx7 library "<name>" "<query>"`, then
   `npx -y ctx7 docs <library-id> "<query>"`. Works in sub-agents that do not
   inherit MCP. A command that does not resolve means the CLI is unavailable.
3. **WebSearch** — `"<name> <major version> best practices"`, official docs first.

Query for: what changed in this major, the recommended project setup, and the patterns now
deprecated. **One query per technology** — this is a cache fill, not research for its own sake.
Neither source reachable → keep the registry version and its date, append ` · idioms unverified`
and write no bullets; say so in the report. Never fill the gap from memory. A version the
registry could not give either is written with no version and `— unverified`.

## Per mode

| Caller | Researches |
|---|---|
| `start` NEW | every technology it chooses — once Phase 3 settles the stack, before Phase 4 writes |
| `start` ADOPT | the **installed** version from the manifest/lockfile — never upgraded; idioms for that version. Installed ≥ 1 major behind the registry → one `## Decisions` line `<name> <installed> pinned, <latest> available — upgrade is a separate task`; never plan the upgrade unasked |
| `start` EXTEND | a technology the new tasks introduce, and each line that is not fresh |
| `build`, `task-builder` | only a dependency the task adds that `## Stack` does not list |

## Installing

A scaffolder or install never names a version from memory: `npm create vite@latest`,
`npm install react` (the registry's latest), `cargo add axum` — or the exact version `## Stack`
records. A plan task that scaffolds the project names the versions `## Stack` holds in its
acceptance criteria, so QA can check the manifest against them.
