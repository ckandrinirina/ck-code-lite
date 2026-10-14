// The ck look: flat, one-cell glyphs for the transcript's tool rows, the folded tool groups,
// the spinner and the turn's closing line, and the builders' task board. Pure rules, no `$`.
//
// Kept word for word in ck-code and ck-code-lite (hooks/mod/theme.ts): `diff` the two files
// before a release. Flat means monochrome text glyphs, never emoji: they take the theme's
// color and one terminal cell, where an emoji brings its own colors and may take two.

// ---- tool rows ---------------------------------------------------------------------------

const GLYPHS: Record<string, string> = {
  Grep: "⌕",
  Glob: "⌕",
  LS: "⌕",
  WebSearch: "⌕",
  ToolSearch: "⌕",
  Read: "≡",
  NotebookRead: "≡",
  Write: "✎",
  NotebookEdit: "✎",
  Edit: "±",
  MultiEdit: "±",
  Bash: "❯",
  BashOutput: "❯",
  KillShell: "❯",
  WebFetch: "⇣",
  Agent: "◈",
  Task: "◈",
  SendMessage: "◈",
  Skill: "✦",
  TaskCreate: "☐",
  TaskUpdate: "▣",
  TaskList: "☰",
  TaskGet: "☰",
  TaskStop: "■",
  TodoWrite: "☰",
  AskUserQuestion: "?",
  EnterPlanMode: "◇",
  ExitPlanMode: "◆",
  Monitor: "◔",
};

// The glyph a tool's row opens with; an MCP tool's is a plug, an unknown one a dot.
export function toolGlyph(tool: string): string {
  if (tool.startsWith("mcp__")) return "⌁";
  return GLYPHS[tool] ?? "•";
}

// What the row names the tool: an MCP tool by its server and tool, without the prefix.
export function toolName(tool: string): string {
  if (!tool.startsWith("mcp__")) return tool;
  const [, server = "", name = ""] = tool.split("__");
  return `${server.replace(/^plugin_|^claude_ai_/, "")} ${name}`.trim();
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// One line, at most `max` characters, an ellipsis where it was cut.
export function clip(text: string, max = 72): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

// A path as the row shows it: inside the project, relative to it.
export function shortPath(path: string, root = ""): string {
  if (root && path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  return path;
}

// The row's argument: what the call is about, in a few words.
export function toolSummary(tool: string, input: unknown, root = ""): string {
  const i = (input ?? {}) as Record<string, unknown>;
  const path = (p: unknown) => shortPath(str(p), root);
  switch (tool) {
    case "Grep": {
      const where = path(i.path) || str(i.glob);
      return clip(`"${str(i.pattern)}"${where ? ` · ${where}` : ""}`);
    }
    case "Glob":
      return clip(`${str(i.pattern)}${i.path ? ` · ${path(i.path)}` : ""}`);
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return clip(path(i.file_path ?? i.notebook_path));
    case "Bash":
      return clip(str(i.description) || str(i.command));
    case "WebSearch":
      return clip(`"${str(i.query)}"`);
    case "WebFetch":
      return clip(str(i.url).replace(/^https?:\/\//, ""));
    case "Agent":
    case "Task": {
      const type = str(i.subagent_type).replace(/^[\w-]+:/, "");
      return clip([type, str(i.description)].filter(Boolean).join(" · "));
    }
    case "Skill":
      return clip(`${str(i.skill)}${i.args ? ` ${str(i.args)}` : ""}`);
    case "TaskCreate":
      return clip(str(i.subject));
    case "TaskUpdate":
      return clip(
        [str(i.status), str(i.subject) || str(i.activeForm)]
          .filter(Boolean)
          .join(" · ") || `#${str(i.taskId)}`,
      );
    case "TodoWrite":
      return `${Array.isArray(i.todos) ? i.todos.length : 0} tasks`;
    case "ToolSearch":
      return clip(str(i.query));
    case "AskUserQuestion": {
      const q = Array.isArray(i.questions) ? (i.questions[0] as Record<string, unknown>) : undefined;
      return clip(str(q?.question));
    }
    default: {
      const first = Object.values(i).find((v) => typeof v === "string");
      return clip(str(first));
    }
  }
}

// A short, dim note after a finished call whose result the row would otherwise hide
// (reads and searches fold into groups and show no result block of their own).
export function resultNote(tool: string, output: unknown): string {
  const o = (output ?? {}) as Record<string, unknown>;
  const file = (o.file ?? {}) as Record<string, unknown>;
  if (tool === "Read" && typeof file.numLines === "number") return `${file.numLines} lines`;
  if ((tool === "Grep" || tool === "Glob") && typeof o.numFiles === "number")
    return `${o.numFiles} ${o.numFiles === 1 ? "file" : "files"}`;
  return "";
}

export type CallState = {
  isRunning: boolean;
  isErrored: boolean;
  isInterrupted?: boolean;
};

// Where a call stands, as the glyph after its row: running, done, failed, cut.
export function stateMark(c: CallState): { mark: string; color: string } {
  if (c.isRunning) return { mark: "◌", color: "claude" };
  if (c.isInterrupted) return { mark: "◼", color: "warning" };
  if (c.isErrored) return { mark: "✗", color: "error" };
  return { mark: "✓", color: "success" };
}

// A folded group's one line: each tool's glyph and how many times it ran, in the order the
// model first used them (`≡ 3 · ⌕ 2 · ❯ 1`).
export function groupLine(calls: ReadonlyArray<{ tool: string }>): string {
  const counts = new Map<string, number>();
  for (const c of calls) {
    const g = toolGlyph(c.tool);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts].map(([g, n]) => `${g} ${n}`).join(" · ");
}

// ---- the spinner and the turn's closing line --------------------------------------------

export const SPIN_WORDS = [
  "Test-driving",
  "Forging",
  "Refactoring",
  "Wiring",
  "Scaffolding",
  "Untangling",
  "Polishing",
  "Compiling thoughts",
  "Chasing green",
  "Shaping",
  "Plotting",
  "Tinkering",
];

export const DONE_WORDS = [
  "Shipped",
  "Forged",
  "Built",
  "Crafted",
  "Wired",
  "Polished",
  "Nailed",
];

// The glyph before the spinner's word: what the turn is doing.
export function spinGlyph(mode: string): string {
  if (mode === "thinking") return "◇";
  if (mode === "tool-use" || mode === "tool-input") return "▸";
  return "◆";
}

// A stable pick: the engine samples its own word once per turn, so hashing it keeps ours
// steady across redraws and changes it with the next turn.
export function pick(list: readonly string[], seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}

// ---- the builders' task board -----------------------------------------------------------
// A builder's TaskCreate/TaskUpdate list lives in its own loop and never reaches the
// session's task list. The mod mirrors it here, one entry per builder, and the band draws it.

export type BoardTask = { id: string; subject: string; active: string; status: string };
export type BoardEntry = { agent: string; label: string; tasks: BoardTask[] };

export function taskCreated(
  board: readonly BoardEntry[],
  agent: string,
  label: string,
  task: { id: string; subject: string; activeForm?: string },
): BoardEntry[] {
  const row: BoardTask = {
    id: task.id,
    subject: task.subject,
    active: task.activeForm ?? "",
    status: "pending",
  };
  const has = board.some((b) => b.agent === agent);
  if (!has) return [...board, { agent, label, tasks: [row] }];
  return board.map((b) =>
    b.agent === agent ? { ...b, tasks: [...b.tasks.filter((t) => t.id !== task.id), row] } : b,
  );
}

export function taskUpdated(
  board: readonly BoardEntry[],
  agent: string,
  change: { taskId: string; status?: string; subject?: string; activeForm?: string },
): BoardEntry[] {
  return board.map((b) =>
    b.agent !== agent
      ? b
      : {
          ...b,
          tasks: b.tasks
            .filter((t) => !(t.id === change.taskId && change.status === "deleted"))
            .map((t) =>
              t.id !== change.taskId
                ? t
                : {
                    ...t,
                    status: change.status ?? t.status,
                    subject: change.subject ?? t.subject,
                    active: change.activeForm ?? t.active,
                  },
            ),
        },
  );
}

// A TodoWrite call replaces the builder's whole list.
export function todosWritten(
  board: readonly BoardEntry[],
  agent: string,
  label: string,
  todos: ReadonlyArray<{ content: string; status: string; activeForm?: string }>,
): BoardEntry[] {
  const tasks = todos.map((t, n) => ({
    id: String(n + 1),
    subject: t.content,
    active: t.activeForm ?? "",
    status: t.status,
  }));
  const rest = board.filter((b) => b.agent !== agent);
  return tasks.length ? [...rest, { agent, label, tasks }] : rest;
}

// One builder's line: `03-02 ▰▰▱▱ 2/4 ▸ Running the failing test`.
export function boardLine(b: BoardEntry): string {
  const done = b.tasks.filter((t) => t.status === "completed").length;
  const total = b.tasks.length;
  const bar = "▰".repeat(done) + "▱".repeat(Math.max(0, total - done));
  const now = b.tasks.find((t) => t.status === "in_progress");
  const step = now ? `▸ ${now.active || now.subject}` : done === total ? "✓ done" : "";
  return [b.label, total <= 12 ? bar : "", `${done}/${total}`, step].filter(Boolean).join(" ");
}
