# Stack detection — manifest to commands

Resolve the project's test, build and lint commands once, write them into
`docs/ARCHITECTURE.md` under `## Commands`, and never detect again.

## Detect

```bash
ls package.json Cargo.toml pyproject.toml go.mod Gemfile composer.json CMakeLists.txt 2>/dev/null
```

## Base table

| Manifest | Stack | test | build | lint |
|---|---|---|---|---|
| `package.json` | Node / TypeScript | `npm test` | `npm run build` | `npm run lint` |
| `Cargo.toml` | Rust | `cargo test` | `cargo build` | `cargo clippy -- -D warnings` |
| `pyproject.toml` | Python | `pytest` | (none) | `ruff check .` |
| `go.mod` | Go | `go test ./...` | `go build ./...` | `go vet ./...` |
| `Gemfile` | Ruby | `bundle exec rspec` | (none) | `bundle exec rubocop` |
| `composer.json` | PHP | `vendor/bin/phpunit` | (none) | `vendor/bin/phpcs` |
| `CMakeLists.txt` | C / C++ | `ctest --test-dir build` | `cmake --build build` | (none) |

Several manifests can coexist (a Python backend beside a Node frontend). Record every
stack found, and mark which directory each set of commands runs in.

## Refinements, in precedence order

### 1. Declared scripts beat defaults (Node)

```bash
node -e "console.log(Object.keys(require('./package.json').scripts||{}).join(' '))"
```

Use the script names that actually exist. A missing name resolves to `(none)`.
Never write a command that invokes a script the manifest does not declare.
Common extras worth capturing when present: `typecheck`, `test:unit`, `format`.

### 2. Lockfile picks the runner

```bash
ls pnpm-lock.yaml yarn.lock bun.lockb package-lock.json 2>/dev/null
```

First match wins: `pnpm-lock.yaml` → `pnpm`, `yarn.lock` → `yarn`, `bun.lockb` → `bun`,
`package-lock.json` → `npm`. No lockfile → `npm`.

### 3. Python test runner

`pytest` only when `pyproject.toml` declares a `[tool.pytest…]` table or a `tests/`
directory exists. Otherwise `python -m unittest discover`.

## Writing the result

```markdown
## Commands
- test: pnpm test
- build: pnpm build
- lint: pnpm lint
```

## `(none)` is a real value

`(none)` means the project has no such command. It is not a gap to fill by guessing.

- QA skips a `(none)` command rather than substituting one.
- `test: (none)` **hard-stops** the RED phase of `/ck-code-lite:build` — a task cannot be
  test-driven without a test runner, and pretending otherwise silently voids the guarantee.

## No manifest at all

A greenfield directory with no manifest yet: leave `## Commands` with all three set to
`(none)` and note the intended stack under `## Stack`. The first `/ck-code-lite:build`
that hits `test: (none)` will stop and ask, which is the correct moment to choose a
test runner — not before there is any code.
