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
| `package.json` | Node / TypeScript | `npm run test` | `npm run build` | `npm run lint` |
| `Cargo.toml` | Rust | `cargo test` | `cargo build` | `cargo clippy -- -D warnings` |
| `pyproject.toml`, `setup.py` or `requirements.txt` | Python | `pytest` | (none) | `ruff check .` |
| `go.mod` | Go | `go test ./...` | `go build ./...` | `go vet ./...` |
| `Gemfile` | Ruby | `bundle exec rspec` | (none) | `bundle exec rubocop` |
| `composer.json` | PHP | `vendor/bin/phpunit` | (none) | `vendor/bin/phpcs` |
| `CMakeLists.txt` | C / C++ | `ctest --test-dir build --output-on-failure -j "${CK_QA_JOBS:-4}"` ([§ 5](#5-ctest-runs-its-tests-in-parallel)) | `cmake --build build` | (none) |

Several manifests can coexist (a Python backend beside a Node frontend). Record every
stack found, and make each command self-contained — `cd api && pytest` — since every command
runs from the repository root and the `## Commands` labels stay `test`, `build`, `lint`. Two
suites under one label chain with `&&` (`test: npm run test && cd api && pytest`).

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

Always write the **`<runner> run <script>`** long form — `pnpm run test`, never `pnpm test`.
The two are exact aliases, but only the long form is filtered when the user runs RTK, and
the test suite is the largest output this workflow produces. See [rtk.md](rtk.md).

### 3. Python test runner

`pytest` only when `pyproject.toml` declares a `[tool.pytest…]` table or a `tests/`
directory exists. Otherwise `python -m unittest discover`.

### 4. `test-one` — the test command narrowed to files

Written only when the runner takes test paths, so RED/GREEN runs a task's own tests, and the
closing run, the wave check and ship's area check run only the tests a change can reach
(`ck-lite-affected` splices them into `{files}`). With no `test-one` each of those runs `test`. `{files}` is replaced by space-separated test paths, `{dirs}` by the package folders of those files, deduplicated, as `./path` (Go tests a package, not a file), `{tags}` by a Catch2 filter naming each test file (`'[#ClipTests],[#TrackTests]'`).

| Runner | `test-one` |
|---|---|
| vitest, jest, mocha (via a `test` script) | `<runner> run test -- {files}` |
| `node --test` (via a `test` script) | `<runner> run test -- {files}` |
| pytest | `pytest {files}` |
| rspec | `bundle exec rspec {files}` |
| phpunit | `vendor/bin/phpunit {files}` |
| go | `go test {dirs}` — expands to package folders such as `./internal/count` |
| ctest on Catch2 v3 (`catch_discover_tests`) | `<test's configure and build> && for t in <the test binaries' glob>; do if ! "$t" -# {tags} --allow-running-no-tests; then exit 1; fi; done` ([§ 5](#5-ctest-runs-its-tests-in-parallel)) |
| cargo, ctest on GoogleTest or Catch2 v2, `python -m unittest` | omit — filters are by test name, not by path |

A `test` script that already pins files or runs several tools (`"test": "lint && vitest"`)
gets no `test-one`: appending paths would change what it means.

### 5. `ctest` runs its tests in parallel

`ctest` runs one test at a time unless given `-j`, and a Catch2 or GoogleTest suite
registers hundreds of small tests: measured on a 590-test suite, 82 s serial against 10 s with
`-j 8`, same result. `"${CK_QA_JOBS:-4}"` is the run's share of the cores, set by `ck-lite-qa`.
For a suite that already has tests (ADOPT), run it once with `-j` and once without before
writing the line: record `-j` only when both pass. A suite that passes serially and fails in
parallel has tests sharing a file, port or directory — keep the serial form and note why under
`## Commands`.

A `test` line written before this rule — `ctest` with neither `-j` nor `--parallel`, and no
serial note — is checked once by the next build ([tdd-cycle.md](tdd-cycle.md#running-tests)):
one run with `-j`; `PASS` → `Edit` the line to add it; `FAIL` → one serial run, and a note
when only the serial one passes. Measured on a 2,745-case suite run serially: 13–21 min a run,
every run.

**Catch2 — one process per binary.** `catch_discover_tests` makes every `TEST_CASE` its own
ctest test, so ctest starts the binary once per case (median 0.13 s, nearly all of it process
start). The `test-one` row above skips ctest: it builds, then runs each test binary once with
Catch2's file-name tags (`-#`), selecting only the cases of the given test files — 0.2 s for
two files against 13 min for the suite. Name the binaries by the build folder's glob
(`build/tests/tests/*_tests`), so a new test target is never missed. The full `test` stays
`ctest -j`: one process per case is what catches a case that passes only because another ran
before it.

### 6. `test-e2e` and `test-integration` — slow suites, kept apart

A declared e2e script (`test:e2e`, `e2e`, a Playwright or Cypress config) is recorded as its own
`test-e2e` line, never chained into `test`: a task runs only its own specs, and `ship` asks whether
to run the suite ([heavy-tests.md](heavy-tests.md)). Each such line also gets its suite in
`.ck-heavy-tests` (globs and command), the form the scripts read.

A suite that needs a database, a container or a running server (`test:integration`,
`test:db`, `test:e2e:db`, a Testcontainers or docker-compose test config) is a
`test-integration` line on the same terms — never chained into `test`, a task runs only its
own specs, and ship asks. Measured at 20–24 min a run when chained into every task's QA.
Give it a `test-integration-one` line when its runner takes paths (`{files}`, as `test-one`).

## Writing the result

```markdown
## Commands
- test: pnpm run test
- test-one: pnpm run test -- {files}
- build: pnpm run build
- lint: pnpm run lint
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
