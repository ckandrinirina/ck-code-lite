#!/usr/bin/env bash
# Plugin bug reporter — byte-identical in ck-code (scripts/ck-report.sh), ck-code-lite
# (bin/ck-lite-report) and ck-tools (bin/ck-tools-report); the plugin it reports for is the one
# whose .claude-plugin/plugin.json sits above this file.
#
# Usage:
#   <report> hook                     PostToolUse/PostToolUseFailure hook: reads the event on stdin
#   <report> show <sig>               the scrubbed details the hook kept for a signature
#   <report> env                      plugin, version, Claude Code version, OS — one line
#   <report> scrub                    stdin → stdout with home, project, user, emails, tokens hidden
#   <report> dupes <sig|words>        open issues already reporting it: number, title, url
#   <report> file <title> <body-file> [<sig>]    files a bug issue; no gh → a saved draft and a link
#   <report> comment <number> <body-file>       adds a "seen again" comment to an existing issue
#
# hook  flags a failure of this plugin's own code — a bash runtime error (`<plugin file>: line N:
#       unbound variable`, syntax error, command not found, bad substitution, …), a Python
#       traceback through the plugin, or an awk crash in a command calling one of its bin/
#       scripts. A deliberate `ERROR —` usage message is never a bug. Each signature is flagged
#       once per session: the hook prints additionalContext telling Claude to run the report
#       skill, which asks the user before anything is filed. Never blocks, always exits 0.
# Every body is scrubbed before it leaves the machine, and filing always goes through `file`.

set -uo pipefail

HERE="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)"
ROOT="${CK_REPORT_ROOT:-$(dirname -- "$HERE")}"
MANIFEST="$ROOT/.claude-plugin/plugin.json"
TMP="${TMPDIR:-/tmp}"; TMP="${TMP%/}"
STORE="$TMP/ck-report"
DRAFTS="${CK_REPORT_DRAFTS:-$HOME/.claude/ck-reports}"

field() { sed -n "s/^  \"$1\": \"\\(.*\\)\",\$/\\1/p" "$MANIFEST" 2>/dev/null | head -n 1; }
PLUGIN="$(field name)"; VERSION="$(field version)"
REPO="$(field repository | sed -e 's|^https://github.com/||' -e 's|\.git$||')"
die() { echo "${PLUGIN:-report}-report: ERROR — $*" >&2; exit 2; }

scrub() {
  local top user
  top="$(git rev-parse --show-toplevel 2>/dev/null || true)"; user="$(id -un 2>/dev/null || true)"
  awk -v home="$HOME" -v top="$top" -v user="$user" '
    function swap(s, a, b,   i, o) { o = ""; while (a != "" && (i = index(s, a)) > 0) { o = o substr(s, 1, i - 1) b; s = substr(s, i + length(a)) } return o s }
    {
      s = $0
      if (top != "" && top != home) s = swap(s, top, "<project>")
      if (home != "") s = swap(s, home, "~")
      if (length(user) > 2) s = swap(s, user, "<user>")
      gsub(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z][A-Za-z]+/, "<email>", s)
      gsub(/(gh[pousr]_|github_pat_|sk-|xox[abp]-|AKIA)[A-Za-z0-9_-]+/, "<token>", s)
      gsub(/[A-Za-z0-9+_-]{40,}/, "<redacted>", s)
      print s
    }'
}

json_str() {  # stdin → one JSON string literal
  awk 'BEGIN { ORS = "" ; print "\"" }
       { gsub(/\\/, "\\\\"); gsub(/"/, "\\\""); gsub(/\t/, "\\t"); gsub(/[\001-\037]/, ""); if (NR > 1) print "\\n"; print }
       END { print "\"" }'
}

ccver() { claude --version 2>/dev/null | head -n 1 | awk '{ print $1 }'; }
envline() { echo "$PLUGIN $VERSION · Claude Code $(ccver || echo "?") · $(uname -s) $(uname -r) $(uname -m)"; }
sig_of() { printf '%s|%s' "$PLUGIN" "$1" | sed -E 's/[0-9]+/N/g' | cksum | awk '{ printf "%08x", $1 }'; }

hook() {
  local raw text ev sid cmd hit sig bins b
  raw="$(cat)"; [ -n "$raw" ] && [ -n "$PLUGIN" ] || return 0
  # the common case — no crash text at all — leaves after one pattern match
  case "$raw" in *": line "*|*Traceback*|*"awk: "*) ;; *) return 0 ;; esac
  ev="$(printf '%s' "$raw" | sed -n 's/.*"hook_event_name" *: *"\([A-Za-z]*\)".*/\1/p' | head -n 1)"
  case "$ev" in PostToolUse|PostToolUseFailure) ;; *) return 0 ;; esac
  sid="$(printf '%s' "$raw" | sed -n 's/.*"session_id" *: *"\([A-Za-z0-9_-]*\)".*/\1/p' | head -n 1)"
  # JSON escapes back to text; the event is read as text, never parsed — no jq, no python
  text="$(printf '%s\n' "$raw" | awk '{ gsub(/\\n/, "\n"); gsub(/\\t/, "\t"); gsub(/\\"/, "\""); gsub(/\\\\/, "\\"); print }')"
  cmd="$(printf '%s' "$raw" | sed -nE 's/.*"command" *: *"(([^"\\]|\\.)*)".*/\1/p' | head -n 1)"
  bins=""; for b in "$ROOT"/bin/*; do [ -f "$b" ] && bins="$bins $(basename -- "$b")"; done
  hit="$(printf '%s\n' "$text" | awk -v root="$ROOT/" -v bins="$bins" -v cmd="$cmd" '
    BEGIN { n = split(bins, B, " "); for (i = 1; i <= n; i++) if (index(" " cmd " ", B[i]) && cmd ~ ("(^|[^A-Za-z0-9_-])" B[i] "([^A-Za-z0-9_-]|$)")) mine = 1
            if (index(cmd, root)) mine = 1 }
    /: line [0-9]+: / && (index($0, root) || mine && /^[^ ]*(bin|scripts)\/[A-Za-z0-9_.-]+: line /) &&
      /(syntax error|unbound variable|command not found|bad substitution|integer expression expected|unexpected EOF|bad array subscript|division by 0|ambiguous redirect)/ { print; exit }
    /Traceback \(most recent call last\)/ { tb = 1 }
    tb && index($0, "File \"" root) { print "Python traceback in " $0; exit }
    mine && /^(awk|gawk|mawk): / && /(syntax error|bailing out|fatal|illegal|non-terminated|runaway)/ { print; exit }
  ')"
  [ -n "$hit" ] || return 0
  hit="$(printf '%s\n' "$hit" | sed "s|$ROOT/|<plugin>/|g" | scrub | cut -c1-240)"
  sig="$(sig_of "$(printf '%s' "$hit" | sed -E 's/^[^:]*: line [0-9]+: //')")"
  mkdir -p "$STORE" 2>/dev/null || return 0
  [ ! -e "$STORE/seen-${sid:-nosession}-$sig" ] || return 0
  : >"$STORE/seen-${sid:-nosession}-$sig"
  { echo "plugin: $PLUGIN $VERSION"
    echo "error: $hit"
    echo "command: $(printf '%s' "$cmd" | awk '{ gsub(/\\n/, " "); gsub(/\\"/, "\""); print }' | sed "s|$ROOT/|<plugin>/|g" | scrub | cut -c1-400)"
    echo "output (last 30 lines):"
    printf '%s\n' "$text" | sed "s|$ROOT/|<plugin>/|g" | scrub | tail -n 30 | cut -c1-300
  } >"$STORE/$sig.txt"
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' "$ev" "$(printf '%s\n' \
    "[$PLUGIN auto-report] A $PLUGIN script failed in a way that looks like a plugin bug, not a project problem:" \
    "  $hit" \
    "Signature $sig. When the current step is safe to pause, invoke the $PLUGIN:report skill with \`--auto $sig\`: it drafts a GitHub issue and asks the user once before filing. Never retry that command in a loop meanwhile." | json_str)"
}

file_issue() {
  local title="$1" body="$2" sig="${3:-}" out url enc
  [ -f "$body" ] || die "no body file: $body"
  [ -n "$REPO" ] || die "no repository in $MANIFEST"
  out="$(mktemp "$TMP/ck-report-body.XXXXXX")" || die "cannot create a temp file"
  { scrub <"$body"; echo; echo "---"; echo "Environment: $(envline | scrub)"
    [ -z "$sig" ] || echo "<!-- ck-sig: $sig -->"; } >"$out"
  title="$(printf '%s' "$title" | scrub | cut -c1-120)"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    url="$(gh issue create --repo "$REPO" --title "$title" --body-file "$out" --label bug 2>/dev/null \
      || gh issue create --repo "$REPO" --title "$title" --body-file "$out" 2>&1)" \
      || { rm -f "$out"; die "gh issue create failed: $url"; }
    rm -f "$out"; echo "filed: $(printf '%s\n' "$url" | tail -n 1)"; return 0
  fi
  mkdir -p "$DRAFTS" || die "cannot create $DRAFTS"
  local d; d="$DRAFTS/$PLUGIN-$(date +%Y%m%d-%H%M%S).md"
  { echo "# $title"; echo; cat "$out"; } >"$d"; rm -f "$out"
  enc="$(printf '%s' "$title" | od -An -tx1 | tr -d ' \n' | sed 's/../%&/g')"
  echo "draft: $d"
  echo "open: https://github.com/$REPO/issues/new?labels=bug&title=$enc  (paste the draft as the body — gh is not installed or not signed in)"
}

case "${1:-}" in
  hook) hook; exit 0 ;;
  show) [ -n "${2:-}" ] || die "show needs a signature"
        case "$2" in *[!0-9a-f]*) die "not a signature: $2" ;; esac
        [ -f "$STORE/$2.txt" ] || die "nothing kept for $2 (the hook keeps it in $STORE until the temp dir is cleared)"
        cat "$STORE/$2.txt" ;;
  env) envline ;;
  scrub) scrub ;;
  dupes) [ -n "${2:-}" ] || die "dupes needs a signature or words"
         command -v gh >/dev/null 2>&1 || { echo "dupes: gh not installed — check https://github.com/$REPO/issues by hand"; exit 0; }
         gh issue list --repo "$REPO" --state open --search "$2 in:title,body" --limit 10 \
           --json number,title,url --template '{{range .}}#{{.number}}	{{.title}}	{{.url}}{{"\n"}}{{end}}' 2>/dev/null \
           || echo "dupes: gh search failed — check https://github.com/$REPO/issues by hand" ;;
  file) [ "$#" -ge 3 ] || die "file needs <title> <body-file> [<sig>]"; file_issue "$2" "$3" "${4:-}" ;;
  comment) [ "$#" -eq 3 ] || die "comment needs <number> <body-file>"
           case "$2" in ''|*[!0-9]*) die "not an issue number: $2" ;; esac
           c="$(mktemp "$TMP/ck-report-body.XXXXXX")" || die "cannot create a temp file"
           { scrub <"$3"; echo; echo "Environment: $(envline | scrub)"; } >"$c"
           gh issue comment "$2" --repo "$REPO" --body-file "$c"; rc=$?; rm -f "$c"; exit "$rc" ;;
  -h|--help|"") sed -n '5,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command: $1 (hook|show|env|scrub|dupes|file|comment)" ;;
esac
