#!/usr/bin/env bash
# ck-code-lite UserPromptSubmit hook.
#   Inject references/prompt-routing.md as additionalContext on every free-text prompt,
#   so the main session picks and invokes the best-fit /ck-code-lite:* skill before
#   acting — a task request reaches `build`, a "ship it" reaches `ship` — instead of
#   editing code outside the workflow and its guarantees.
#
# Silent (no output at all) when:
#   - the project has not adopted ck-code-lite (no tasks/PLAN.md or docs/ARCHITECTURE.md),
#     or is a full ck-code project (docs/architecture/ or tasks/VERSION.md), whose own
#     router owns the prompt — a migrated project never hears both;
#   - the prompt is a slash command — the user already chose a skill;
#   - the prompt is shorter than MIN_CHARS — a reply to a running skill ("yes", "2", "go"),
#     which routing would derail.
#
# Best-effort by design: it must NEVER fail or block a prompt, so no `set -e`, every probe
# error is swallowed, and the only output is one JSON line. Bash 3.2 / macOS awk, no jq.

MIN_CHARS=12
ROUTING="$(dirname "$0")/../references/prompt-routing.md"

# ---- adoption markers ---------------------------------------------------------
adopted() {
  [ -d docs/architecture ] && return 1
  [ -f tasks/VERSION.md ] && return 1
  [ -f tasks/PLAN.md ] || [ -f docs/ARCHITECTURE.md ]
}
adopted || exit 0
[ -r "$ROUTING" ] || exit 0

# ---- prompt extraction ---------------------------------------------------------
# The hook input is one JSON object on stdin; only "prompt" matters. Decoded with a
# char-by-char scan so an escaped quote inside the prompt cannot end it early.
prompt=$(awk '
  { buf = buf $0 "\n" }
  END {
    i = index(buf, "\"prompt\""); if (!i) exit
    s = substr(buf, i + 8)
    j = index(s, "\""); if (!j) exit
    s = substr(s, j + 1); n = length(s); out = ""
    for (k = 1; k <= n; k++) {
      c = substr(s, k, 1)
      if (c == "\\") {
        k++; d = substr(s, k, 1)
        if (d == "n" || d == "t") out = out " "
        else if (d == "u") { k += 4; out = out "?" }
        else out = out d
        continue
      }
      if (c == "\"") break
      out = out c
    }
    printf "%s", out
  }' 2>/dev/null)

# Trim leading whitespace, then apply the two skip rules.
prompt="${prompt#"${prompt%%[![:space:]]*}"}"
[ -n "$prompt" ] || exit 0
case "$prompt" in /*) exit 0 ;; esac
[ "${#prompt}" -ge "$MIN_CHARS" ] || exit 0

# ---- emit -----------------------------------------------------------------------
# The reference is the payload: its "<!--" comment lines are stripped, the rest is
# JSON-escaped with newlines preserved so the routing table stays line-per-rule.
esc=$(grep -v '^<!--' "$ROUTING" 2>/dev/null | awk '
  { gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); gsub(/\t/, "\\t"); printf "%s%s", (NR > 1 ? "\\n" : ""), $0 }')
[ -n "$esc" ] || exit 0
printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$esc"
