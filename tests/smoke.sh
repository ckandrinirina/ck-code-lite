#!/usr/bin/env bash
# tests/smoke.sh — drives ck-code-lite's bin/ and hook scripts against throwaway projects.
#
# Assertions encode the contract in references/plan-format.md and
# skills/start/references/architecture-template.md: a FAIL means the script and the contract disagree.
# Bash 3.2, no deps beyond git, awk, sed.

set -uo pipefail

ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)"
PATH="$ROOT/bin:$PATH"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ck-lite-smoke.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PASS=0; FAIL=0

ok()   { printf 'ok      %s\n' "$1"; PASS=$((PASS + 1)); }
bad()  { printf 'FAIL    %s\n' "$1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/        /'; FAIL=$((FAIL + 1)); }
has()  { case "$3" in *"$2"*) ok "$1" ;; *) bad "$1" "expected to contain: $2"$'\n'"got: $3" ;; esac; }
lacks(){ case "$3" in *"$2"*) bad "$1" "expected NOT to contain: $2"$'\n'"got: $3" ;; *) ok "$1" ;; esac; }
eq()   { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected: $2"$'\n'"got:      $3"; }

fresh() {  # new git project in $P, cwd moved there
  P="$WORK/$1"; mkdir -p "$P/docs" && cd "$P" && git init -q . && git config user.email t@t && git config user.name t
}

task() {  # id title size needs files
  printf '## %s %s\n\n%s · status: todo · size: %s · needs: %s · files: %s\n\n### Acceptance\n- [ ] %s works\n\n### Tasks\n- [ ] Failing tests\n\n' "$1" "$2" "$1" "$3" "$4" "$5" "$2"
}

# ---- init / add / next-id ------------------------------------------------------
echo "=== plan writes ==="
fresh plan
has "init: creates the plan" "created tasks/PLAN.md" "$(ck-lite init 'Word count CLI' 2>&1)"
has "init: refuses an existing plan" "already exists" "$(ck-lite init again 2>&1)"
eq  "next-id: empty plan starts at T-01" "T-01" "$(ck-lite next-id)"
out="$( { task T-01 "Count words" S — "src/count.js, test/count.test.js"
          task T-02 "Missing file error" S T-01 "src/count.js"
          task T-03 "JSON flag" M — "src/cli.js"; } | ck-lite add 2>&1)"
has "add: reports the range" "added 3 tasks (T-01 … T-03)" "$out"
eq  "add: a table row per task" "3" "$(grep -c '^| T-' tasks/PLAN.md)"
eq  "add: rows land inside the table, before the sections" "| T-03 | JSON flag | todo | M | — |" "$(sed -n 7p tasks/PLAN.md)"
eq  "next-id: continues from the highest" "T-04" "$(ck-lite next-id)"
has "add: refuses an existing ID" "T-02 already exists" "$(task T-02 Dup S — x | ck-lite add 2>&1)"
has "add: refuses an unknown needs" "needs T-77, which does not exist" "$(task T-04 X S T-77 x | ck-lite add 2>&1)"
has "add: refuses size L" "meta line must follow" "$(task T-04 X L — x | ck-lite add 2>&1)"
eq  "add: a refused batch writes nothing" "3" "$(grep -c '^| T-' tasks/PLAN.md)"
has "add: a single task" "added T-04" "$(task T-04 "Stdin input" S "T-01, T-03" "src/cli.js" | ck-lite add 2>&1)"
eq  "add: multi-needs row keeps its spacing" "| T-04 | Stdin input | todo | S | T-01, T-03 |" "$(grep '^| T-04' tasks/PLAN.md)"
has "check: a freshly built plan is clean" "OK — 4 tasks" "$(ck-lite check)"

# ---- reads ---------------------------------------------------------------------
echo "=== plan reads ==="
out="$(ck-lite open)"
has "open: a task with no needs is READY" "T-01 todo READY S" "$out"
has "open: an unmet need waits" "T-02 todo wait(T-01)" "$out"
has "open: every unmet need is named" "T-04 todo wait(T-01,T-03)" "$out"
has "open: count line" "open 4 · ready 2 · done 0 · total 4" "$out"
eq  "show: prints the section only" "## T-02 Missing file error" "$(ck-lite show T-02 | head -1)"
lacks "show: stops before the next task" "## T-03" "$(ck-lite show T-02)"
eq  "show: T-01 never matches T-010" "" "$(ck-lite show T-010)"
out="$(ck-lite criteria T-01 T-03)"
has "criteria: grouped by ID" "== T-03" "$out"
lacks "criteria: other tasks excluded" "Missing file" "$out"

# ---- status writes ---------------------------------------------------------------
echo "=== status writes ==="
eq  "set: moves both lines" "T-01: todo → doing" "$(ck-lite set doing T-01)"
eq  "set: the meta line moved too" "1" "$(grep -c '^T-01 · status: doing' tasks/PLAN.md)"
has "set: refuses an unknown status" "status must be one of" "$(ck-lite set finished T-01 2>&1)"
has "set: refuses a missing ID" "T-99 is not in the plan" "$(ck-lite set "done" T-99 2>&1)"
has "note: opens a Notes block" "note added" "$(ck-lite note T-01 'first finding')"
ck-lite note T-01 'second finding' >/dev/null
eq  "note: appends inside the same block" "1" "$(ck-lite show T-01 | grep -c '^### Notes')"
eq  "note: both lines kept, in order" "first finding|second finding" "$(ck-lite show T-01 | sed -n 's/^- [0-9-]*: //p' | paste -sd'|' -)"
has "files: appends new paths only" "files +1" "$(ck-lite files T-01 src/count.js src/util.js)"
has "done: ticks, appends, flips" "T-01: doing → done · ticked 2 · files +1" "$(ck-lite "done" T-01 src/extra.js)"
eq  "done: no unticked box left" "0" "$(ck-lite show T-01 | grep -c '^- \[ \]')"
eq  "done: files line is clean" "T-01 · status: done · size: S · needs: — · files: src/count.js, test/count.test.js, src/util.js, src/extra.js" "$(grep '^T-01 · ' tasks/PLAN.md)"
out="$(ck-lite open)"
eq  "open: done tasks never listed" "0" "$(printf '%s\n' "$out" | grep -c '^T-01 ')"
has "open: a need that is done is satisfied" "T-02 todo READY" "$out"
has "check: still clean after writes" "OK — 4 tasks" "$(ck-lite check)"
has "files: comma-joined paths split and dedupe" "files +1" "$(ck-lite files T-02 'src/count.js,src/new.js')"
ck-lite note T-02 'path C:\new and \d+' >/dev/null
eq  "note: backslashes kept literally" "1" "$(ck-lite show T-02 | grep -cF 'C:\new and \d+')"
printf '## T-05 Table in body\n\nT-05 · status: todo · size: S · needs: — · files: x\n\n### Acceptance\n- [ ] renders\n\n| a | b |\n|---|---|\n| 1 | 2 |\n' | ck-lite add >/dev/null
task T-06 "After a table" S — y | ck-lite add >/dev/null
eq  "add: rows go to the leading table, never a body table" "| T-06 | After a table | todo | S | — |" "$(sed -n 10p tasks/PLAN.md)"
has "check: still clean after a body table" "OK — 6 tasks" "$(ck-lite check)"

# ---- waves -----------------------------------------------------------------------
echo "=== waves ==="
out="$(ck-lite waves --all)"
has "waves: shared file splits a wave" "Wave 1 T-02" "$out"
has "waves: dependents follow their needs" "Wave 2 T-04" "$out"
eq  "waves --next: first wave IDs" "T-02 T-03 T-05 T-06" "$(ck-lite waves --next --all)"
has "waves: explicit non-todo is unschedulable" "Unschedulable T-01 — status done, not todo" "$(ck-lite waves T-01 T-02)"
has "waves: a need outside scope excludes" "needs T-03 (todo), not in scope" "$(ck-lite waves T-04)"
fresh wide; ck-lite init W >/dev/null
{ for i in 01 02 03 04 05 06; do task "T-$i" "Task $i" S — "src/f$i.js"; done; } | ck-lite add >/dev/null
out="$(ck-lite waves --all)"
has "waves: width capped at 4" "Wave 2 T-05" "$out"
has "waves: count line" "waves 2 · scheduled 6" "$out"
fresh cyc; ck-lite init C >/dev/null
{ task T-01 A S T-02 a; task T-02 B S T-01 b; } | ck-lite add >/dev/null
has "check: finds a dependency cycle" "on a dependency cycle" "$(ck-lite check)"
has "waves: a cycle is unschedulable" "dependency cycle" "$(ck-lite waves --all)"

# ---- corruption ---------------------------------------------------------------------
echo "=== corruption ==="
fresh bad; ck-lite init B >/dev/null; task T-01 A S — a | ck-lite add >/dev/null
sed -i.bak 's/^T-01 · status: todo/T-01 · status: doing/' tasks/PLAN.md
has "check: table and meta disagree" "table says todo, meta line says doing" "$(ck-lite check)"
has "open: a disagreeing task is CORRUPT" "CORRUPT" "$(ck-lite open)"
has "set: refuses to write a corrupt task" "corrupt plan" "$(ck-lite set "done" T-01 2>&1)"
ck-lite check >/dev/null; eq "check: exit 1 on a defect" "1" "$?"

# ---- context / areas ----------------------------------------------------------------
echo "=== context ==="
fresh ctx; ck-lite init X >/dev/null
{ task T-01 "Bill" S — "src/billing/charge.ts"; task T-02 "Login" S — "src/auth/login.ts"; task T-03 "Bare" S — —; } | ck-lite add >/dev/null
mkdir -p docs/areas
cat >docs/ARCHITECTURE.md <<'EOF'
# ARCHITECTURE — X

## Commands
- test: pnpm run test
- test-one: pnpm run test -- {files}
- build: (none)

## Areas

| Area | Doc | Paths |
|---|---|---|
| billing | docs/areas/billing.md | src/billing/, test/billing/ |
| auth | docs/areas/auth.md | src/auth/ |
EOF
echo "# billing area" >docs/areas/billing.md
out="$(ck-lite context T-01)"
has "context: core doc" "== docs/ARCHITECTURE.md" "$out"
has "context: the matching area doc" "# billing area" "$out"
has "context: the task section" "== task T-01" "$out"
lacks "context: other areas skipped" "== docs/areas/auth.md" "$out"
has "context: a listed doc that is missing is flagged" "missing" "$(ck-lite context T-02)"
has "context: no files lists the areas" "none matched" "$(ck-lite context T-03)"
eq  "commands: the ## Commands lines" "test: pnpm run test|test-one: pnpm run test -- {files}|build: (none)" "$(ck-lite commands | paste -sd'|' -)"
has "stats: areas counted" "areas 2" "$(ck-lite stats)"
out="$(cd /tmp && CK_LITE_PLAN="$P/tasks/PLAN.md" CK_LITE_ARCH="$P/docs/ARCHITECTURE.md" ck-lite context T-01)"
has "context: env paths from another directory find the area doc" "# billing area" "$out"

# ---- worktrees ----------------------------------------------------------------------
echo "=== worktrees ==="
fresh wt; echo x >x; git add x; git commit -qm x; git branch -M main
eq  "base: AT-BASE where it started" "AT-BASE" "$(ck-lite base "$(pwd -P)" main)"
git worktree add -q -b task/a "$WORK/wt-a" 2>/dev/null; git worktree add -q -b task/b "$WORK/wt-b" 2>/dev/null
( cd "$WORK/wt-b" && echo b >b && git add b && git commit -qm b )
out="$(ck-lite worktrees main)"
lacks "worktrees: the main checkout is never listed" "$(pwd -P)	" "$out"
has "worktrees: an empty branch is merged" "task/a	" "$out"
has "worktrees: commits ahead are unmerged" "unmerged	1 ahead" "$out"
has "try-merge: clean branch" "CLEAN task/b" "$(ck-lite try-merge task/b)"
eq  "try-merge: tree untouched after the dry run" "" "$(git status --porcelain)"
has "retire: refuses an unmerged branch" "NOT MERGED" "$(ck-lite retire main task/b)"
has "retire: removes a merged worktree" "retired task/a" "$(ck-lite retire main task/a)"
has "retire: never the main checkout" "never retired" "$(ck-lite retire main main 2>&1)"
has "base: DRIFTED inside a worktree" "DRIFTED" "$(cd "$WORK/wt-b" && ck-lite base "$P" main)"

# ---- ck-lite-qa -------------------------------------------------------------------------
echo "=== ck-lite-qa ==="
fresh qa; echo a >a.txt; git add a.txt; git commit -qm init
QT="$WORK/qatmp"; mkdir -p "$QT"
QA() { TMPDIR="$QT" ck-lite-qa "$@" 2>&1; }
has "qa run: a passing command" "test: PASS" "$(QA run T-01 test='true')"
has "qa run --reuse: same state is REUSED" "test: REUSED" "$(QA run T-01 --reuse test='true')"
echo b >b.txt
has "qa run --reuse: an untracked file is a new state" "test: PASS" "$(QA run T-01 --reuse test='true')"
out="$(QA run T-01 a='false' b='true')";
has "qa run: stops at the first failure" "b: SKIPPED" "$out"
has "qa run: overall FAIL line" "ck-lite-qa: FAIL" "$out"
lacks "qa: never clashes with ck-code's stamps" "ck-qa:" "$out"
has "qa run: a hyphenated label is refused" "no hyphen" "$(QA run T-01 test-one='true')"

# ---- prompt router ------------------------------------------------------------------------
echo "=== prompt router ==="
fresh router; R="$ROOT/scripts/prompt-router.sh"
eq  "router: silent outside an adopted project" "" "$(echo '{"prompt":"implement the parser please"}' | bash "$R")"
ck-lite init R >/dev/null
has "router: routes a free-text prompt" "ck-code-lite router" "$(echo '{"prompt":"implement the parser please"}' | bash "$R")"
eq  "router: silent on a slash command" "" "$(echo '{"prompt":"/ck-code-lite:build T-01"}' | bash "$R")"
eq  "router: silent on a short reply" "" "$(echo '{"prompt":"yes"}' | bash "$R")"

# ---- reclaim ----------------------------------------------------------------------------
echo "=== reclaim ==="
fresh reclaim; echo x >x; git add x; git commit -qm x
has "reclaim: refuses the main checkout" "refused" "$(ck-lite-reclaim "$P" 2>&1)"

echo
echo "passed $PASS · failed $FAIL"
[ "$FAIL" -eq 0 ]
