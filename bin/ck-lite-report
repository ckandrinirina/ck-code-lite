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
#   <report> file <title> <draft> [<sig>]    files a bug issue; no gh → a saved draft and a link
#   <report> comment <number> <draft>       adds a "seen again" comment to an existing issue
#   (a <draft> must sit under ~/.claude/ck-reports/ — CK_REPORT_DRAFTS — and is scrubbed again)
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
# hook state lives in a private per-user directory, never in a shared /tmp a peer could plant in
STORE="${XDG_CACHE_HOME:-$HOME/.cache}/ck-report"
DRAFTS="${CK_REPORT_DRAFTS:-$HOME/.claude/ck-reports}"

field() { sed -n "s/^  \"$1\": \"\\(.*\\)\",\$/\\1/p" "$MANIFEST" 2>/dev/null | head -n 1; }
PLUGIN="$(field name)"; VERSION="$(field version)"
REPO="$(field repository | sed -e 's|^https://github.com/||' -e 's|\.git$||')"
die() { echo "${PLUGIN:-report}-report: ERROR — $*" >&2; exit 2; }

# exit 0 when <dir> exists (created 0700 if missing), is a real directory, not a symlink, ours
private_dir() {
  [ -L "$1" ] && return 1
  [ -d "$1" ] || (umask 077 && mkdir -p "$1") 2>/dev/null || return 1
  [ -d "$1" ] && [ ! -L "$1" ] && [ -O "$1" ] || return 1
  chmod 700 "$1" 2>/dev/null
}

# a body file must be a draft under $DRAFTS: `file` and `comment` never post an arbitrary path
draft_path() {
  local d f
  [ -f "$1" ] && [ ! -L "$1" ] || die "no draft file: $1"
  d="$(CDPATH='' cd -- "$(dirname -- "$1")" 2>/dev/null && pwd -P)" || die "no draft file: $1"
  f="$d/$(basename -- "$1")"
  private_dir "$DRAFTS" || die "$DRAFTS is not a private directory of yours"
  case "$f" in "$(CDPATH='' cd -- "$DRAFTS" && pwd -P)"/*) printf '%s' "$f" ;; *) die "a draft must be written under $DRAFTS (got $1)" ;; esac
}

scrub() {
  local top user
  top="$(git rev-parse --show-toplevel 2>/dev/null || true)"; user="$(id -un 2>/dev/null || true)"
  awk -v home="$HOME" -v top="$top" -v user="$user" '
    # NAME=value / NAME: value whose name says secret → the value is hidden
    function secretkv(s,   o, m) {
      o = ""
      while (match(s, /[A-Za-z0-9_.-]*([Kk][Ee][Yy]|[Tt][Oo][Kk][Ee][Nn]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Pp][Aa][Ss][Ss]([Ww][Oo]?[Rr][Dd])?|[Pp][Ww][Dd]|[Aa][Uu][Tt][Hh]|[Cc][Rr][Ee][Dd][Ee][Nn][Tt][Ii][Aa][Ll][Ss]?)[A-Za-z0-9_]*["\047]?[ \t]*[:=][ \t]*["\047]?[^ \t"\047,;]+/)) {
        m = substr(s, RSTART, RLENGTH); sub(/[:=][ \t]*["\047]?[^ \t"\047,;]+$/, "", m)
        o = o substr(s, 1, RSTART - 1) m "=<redacted>"; s = substr(s, RSTART + RLENGTH)
      }
      return o s
    }
    function swap(s, a, b,   i, o) { o = ""; while (a != "" && (i = index(s, a)) > 0) { o = o substr(s, 1, i - 1) b; s = substr(s, i + length(a)) } return o s }
    {
      s = $0
      if (top != "" && top != home) s = swap(s, top, "<project>")
      if (home != "") s = swap(s, home, "~")
      if (length(user) > 2) s = swap(s, user, "<user>")
      gsub(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z][A-Za-z]+/, "<email>", s)
      gsub(/(gh[pousr]_|github_pat_|sk-|xox[abp]-|AKIA)[A-Za-z0-9_-]+/, "<token>", s)
      # a PEM block is dropped whole, from its BEGIN line to its END line
      if (s ~ /-----BEGIN [A-Z0-9 ]+-----/) { pem = 1; print "<redacted block>"; next }
      if (pem) { if (s ~ /-----END [A-Z0-9 ]+-----/) pem = 0; next }
      gsub(/:\/\/[^\/ :@]+:[^\/ @]+@/, "://<redacted>@", s)
      gsub(/[Bb]earer [A-Za-z0-9._~+\/=-]+/, "Bearer <redacted>", s)
      gsub(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, "<jwt>", s)
      s = secretkv(s)
      gsub(/[A-Za-z0-9+_-]{40,}/, "<redacted>", s)
      gsub(/[A-Za-z0-9+\/=]{32,}/, "<redacted>", s)
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
  local raw text ev sid cmd hit sig bins b kept
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
      /(syntax error|unbound variable|command not found|bad substitution|integer expression expected|unexpected EOF|bad array subscript|division by 0|ambiguous redirect)/ { print (index($0, root) ? substr($0, index($0, root)) : $0); exit }
    /Traceback \(most recent call last\)/ { tb = 1 }
    tb && index($0, "File \"" root) { print "Python traceback in " $0; exit }
    mine && /^(awk|gawk|mawk): / && /(syntax error|bailing out|fatal|illegal|non-terminated|runaway)/ { print; exit }
  ')"
  [ -n "$hit" ] || return 0
  hit="$(printf '%s\n' "$hit" | sed "s|$ROOT/|<plugin>/|g" | scrub | cut -c1-240)"
  # What reaches the model is fixed wording only — a kind from this list, a plugin-relative
  # script name and a line number, each checked against a strict pattern. The line itself is
  # tool output, possibly crafted; the skill reads it through `show`, as data.
  local kind where line
  kind="$(printf '%s' "$hit" | grep -oE 'syntax error|unbound variable|command not found|bad substitution|integer expression expected|unexpected EOF|bad array subscript|division by 0|ambiguous redirect|Python traceback|bailing out|fatal|illegal|non-terminated|runaway' | head -n 1)"
  where="$(printf '%s' "$hit" | sed -nE 's#^(.*[^A-Za-z0-9_./-])?(<plugin>/[A-Za-z0-9_./-]+): line ([0-9]+): .*#\2#p')"
  line="$(printf '%s' "$hit" | sed -nE 's#^(.*[^A-Za-z0-9_./-])?<plugin>/[A-Za-z0-9_./-]+: line ([0-9]+): .*#\2#p')"
  case "$where" in *..*) where="" ;; esac
  sig="$(sig_of "$(printf '%s' "$hit" | sed -E 's/^[^:]*: line [0-9]+: //')")"
  private_dir "$STORE" || return 0
  [ ! -e "$STORE/seen-${sid:-nosession}-$sig" ] || return 0
  : >"$STORE/seen-${sid:-nosession}-$sig"
  # written beside its final name, then moved in: a planted link is replaced, never followed
  kept="$(mktemp "$STORE/.kept.XXXXXX")" || return 0
  { echo "plugin: $PLUGIN $VERSION"
    echo "error: $hit"
    echo "command: $(printf '%s' "$cmd" | awk '{ gsub(/\\n/, " "); gsub(/\\"/, "\""); print }' | sed "s|$ROOT/|<plugin>/|g" | scrub | cut -c1-400)"
    echo "output (last 30 lines):"
    printf '%s\n' "$text" | sed "s|$ROOT/|<plugin>/|g" | scrub | tail -n 30 | cut -c1-300
  } >"$kept"
  mv -f "$kept" "$STORE/$sig.txt" || { rm -f "$kept"; return 0; }
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":%s}}\n' "$ev" "$(printf '%s\n' \
    "[$PLUGIN auto-report] A $PLUGIN script failed in a way that looks like a plugin bug, not a project problem:" \
    "  ${kind:-crash}${where:+ in $where}${line:+ line $line}" \
    "Signature $sig. When the current step is safe to pause, invoke the $PLUGIN:report skill with \`--auto $sig\`: it drafts a GitHub issue and asks the user once before filing. Never retry that command in a loop meanwhile." | json_str)"
}

file_issue() {
  local title="$1" body sig="${3:-}" out url enc
  body="$(draft_path "$2")" || exit 2
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
        [ -f "$STORE/$2.txt" ] && [ ! -L "$STORE/$2.txt" ] || die "nothing kept for $2 in $STORE"
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
           b="$(draft_path "$3")" || exit 2
           c="$(mktemp "$TMP/ck-report-body.XXXXXX")" || die "cannot create a temp file"
           { scrub <"$b"; echo; echo "Environment: $(envline | scrub)"; } >"$c"
           gh issue comment "$2" --repo "$REPO" --body-file "$c"; rc=$?; rm -f "$c"; exit "$rc" ;;
  -h|--help|"") sed -n '5,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command: $1 (hook|show|env|scrub|dupes|file|comment)" ;;
esac
