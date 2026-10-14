// The ck look, drawn: flat-glyph tool rows, one-line tool groups, workflow words on the
// spinner and the turn's closing line. Terminal only (the desktop draws its own rich rows),
// and only in the plugin's own projects, so a session elsewhere keeps Claude Code's look.
//
// Kept word for word in ck-code and ck-code-lite (hooks/mod/look.tsx). Holds no $.state:
// each register.tsx says, through `isOurs`, whether the session is in its project. A hook
// here that throws costs its row alone: `.catch` hands it back to the engine's own drawing.

import type { Register } from "claude-code";

import {
  DONE_WORDS,
  SPIN_WORDS,
  groupLine,
  pick,
  resultNote,
  stateMark,
  toolGlyph,
  toolName,
  toolSummary,
} from "./theme";

type On = Parameters<Register>[0];

export type LookOptions = {
  // True while the session is in this plugin's project and the theme option is on.
  isOurs: () => boolean;
  // The project's root, which the rows' paths are shown relative to.
  root: () => string;
};

// A tool's glyph color: searches and reads cool, writes warm, agents and skills Claude's.
function glyphColor(tool: string): string {
  const g = toolGlyph(tool);
  if (g === "⌕" || g === "≡" || g === "⇣") return "suggestion";
  if (g === "✎" || g === "±") return "warning";
  if (g === "❯") return "bashBorder";
  if (g === "◈" || g === "✦") return "claude";
  if (g === "⌁") return "ide";
  if ("☐▣☰■".includes(g)) return "remember";
  return "subtle";
}

export function registerLook(on: On, opts: LookOptions): void {
  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (e.surface !== "terminal" || !opts.isOurs()) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const p = e.props;
    const state = stateMark(p);
    const summary = toolSummary(p.tool, p.input, opts.root());
    const note = p.isRunning || p.isErrored ? "" : resultNote(p.tool, p.output);
    return (
      <Box gap={1}>
        <Text color={p.isErrored ? "error" : glyphColor(p.tool)} bold>
          {toolGlyph(p.tool)}
        </Text>
        <Text bold>{toolName(p.tool)}</Text>
        {summary !== "" && (
          <Text dimColor wrap="truncate-end">
            {summary}
          </Text>
        )}
        <Text color={state.color}>{state.mark}</Text>
        {note !== "" && <Text dimColor>{note}</Text>}
      </Box>
    );
  }).catch(($, e, next) => next(e));

  // An unfolded group (--verbose, ctrl+o) draws its calls as ToolUse rows: left as it is.
  on("ui.render", { component: "ToolGroup" }, async ($, e, next) => {
    const calls = e.props.calls;
    if (e.surface !== "terminal" || !opts.isOurs() || e.props.isExpanded || calls.length === 0)
      return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const last = calls[calls.length - 1]!;
    const running = calls.some((c) => c.isRunning);
    const failed = calls.filter((c) => c.isErrored).length;
    const now = running ? toolSummary(last.tool, last.input, opts.root()) : "";
    return (
      <Box gap={1}>
        <Text color={running ? "claude" : failed ? "error" : "success"}>
          {running ? "◌" : failed ? "✗" : "✓"}
        </Text>
        <Text bold>{groupLine(calls)}</Text>
        {now !== "" && (
          <Text dimColor wrap="truncate-end">
            {toolGlyph(last.tool)} {now}
          </Text>
        )}
        {!running && failed > 0 && <Text color="error">{failed} failed</Text>}
        {!running && <Text dimColor>(ctrl+o)</Text>}
      </Box>
    );
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "Spinner" }, async ($, e, next) => {
    if (!opts.isOurs()) return next(e);
    return next({ ...e, props: { ...e.props, word: pick(SPIN_WORDS, e.props.word) } });
  }).catch(($, e, next) => next(e));

  on("ui.render", { component: "TurnDuration" }, async ($, e, next) => {
    if (!opts.isOurs()) return next(e);
    return next({ ...e, props: { ...e.props, word: pick(DONE_WORDS, e.props.word) } });
  }).catch(($, e, next) => next(e));
}
