// Pure helpers of the ck-code-lite mod: the lite-project rule, routing rules, the PLAN.md
// guard, `ck-lite open` parsing. Nothing here touches `$`; register.tsx makes every engine call
// (tests/mod/logic.test.ts covers these without a session).

// ---- the lite-project rule -------------------------------------------------------------

// Kept word for word in both plugins' mods, and agreeing with the skills' plugin guards
// (version-gate.md, plugin-redirect.md): a stamped project is ck-code's; a lite plan stays
// lite's even beside an unstamped docs/architecture/ (half-migrated); a bare
// docs/ARCHITECTURE.md is lite's only when no docs/architecture/ sits beside it.
export function isLiteLayout(has: {
  stamp: boolean;
  plan: boolean;
  architectureDir: boolean;
  architectureDoc: boolean;
}): boolean {
  if (has.stamp) return false;
  if (has.plan) return true;
  return has.architectureDoc && !has.architectureDir;
}

// ---- prompt routing (was scripts/prompt-router.sh) --------------------------------

// A reply to a running skill ("yes", "2", "go") is shorter than this.
export const ROUTE_MIN_CHARS = 12;

// Only a person's own prompt is routed, never a task notification or a peer's message.
const ROUTED_ORIGINS = new Set(["composer", "bridge", "sdk"]);

export function isRoutable(text: string, originKind: string): boolean {
  if (!ROUTED_ORIGINS.has(originKind)) return false;
  const t = text.trimStart();
  if (t.startsWith("/")) return false;
  return t.length >= ROUTE_MIN_CHARS;
}

export function stripRouting(md: string): string {
  return md
    .split("\n")
    .filter((line) => !line.startsWith("<!--"))
    .join("\n")
    .trim();
}

// ---- the PLAN.md guard ---------------------------------------------------------------

// references/plan-format.md: `ck-lite` is the only thing that writes tasks/PLAN.md. A hand
// edit skips the lock and the three-line check, and a plan corrupted that way is refused by
// every later write. A CORRUPT task is the exception no ck-lite write repairs: the user fixes
// it by hand (references/plan-format.md).
export function planWriteReason(path: string): string | undefined {
  if (!/(^|\/)tasks\/PLAN\.md$/.test(path)) return undefined;
  return (
    "ck-code-lite: tasks/PLAN.md is written only through `ck-lite` (references/plan-format.md). " +
    "Use `ck-lite set <status> <T-NN>`, `ck-lite done`, `ck-lite files`, `ck-lite note`, " +
    "`ck-lite add` (new tasks on stdin), `ck-lite group` or `ck-lite drop`. " +
    "A CORRUPT task that `ck-lite check` names is repaired by the user in their editor — " +
    "ask them to fix the named lines."
  );
}

// ---- ck-lite open ----------------------------------------------------------------------

export type OpenTask = { id: string; state: string; title: string };
export type OpenPlan = {
  tasks: OpenTask[];
  open: number;
  ready: number;
  done: number;
  total: number;
};

// Lines of `ck-lite open`:
//   T-01 todo READY S · needs: — · files: src/a.js · Count words
//   T-02 todo wait(T-01) S · needs: T-01 · files: src/b.js · Missing file error
//   open 2 · ready 1 · done 0 · total 2
export function parseOpen(stdout: string): OpenPlan | null {
  const tasks: OpenTask[] = [];
  let summary: Omit<OpenPlan, "tasks"> | null = null;
  for (const line of stdout.split("\n")) {
    const m = /^open (\d+) · ready (\d+) · done (\d+) · total (\d+)/.exec(line);
    if (m) {
      summary = {
        open: Number(m[1]),
        ready: Number(m[2]),
        done: Number(m[3]),
        total: Number(m[4]),
      };
      continue;
    }
    if (!/^T-\d+ /.test(line)) continue;
    const parts = line.split(" · ");
    const head = (parts[0] ?? "").split(" ");
    tasks.push({
      id: head[0] ?? "",
      // The words between the ID and the size: `doing`, `todo READY`, `todo wait(T-01)`.
      state: head.slice(1, -1).join(" "),
      // Fields: head · needs · files · title; a title may hold ` · ` itself.
      title: parts.slice(3).join(" · "),
    });
  }
  return summary === null ? null : { tasks, ...summary };
}

// The task to build next: one already in progress first, then the first ready one.
export function nextTask(plan: OpenPlan): OpenTask | undefined {
  return (
    plan.tasks.find((t) => t.state === "doing") ??
    plan.tasks.find((t) => t.state === "todo READY")
  );
}

export function nextCommand(plan: OpenPlan): string {
  const task = nextTask(plan);
  if (task) return `/ck-code-lite:build ${task.id}`;
  return plan.open === 0 ? "/ck-code-lite:start" : "";
}

// The done/total part is the band's progress bar.
export function countsLine(plan: OpenPlan): string {
  return `${plan.open} open · ${plan.ready} ready`;
}

export type Suggestion = { text: string; label: string; description: string };

// `T-` or `T-0` offers the plan's open tasks.
export function taskSuggestions(
  token: string,
  tasks: readonly OpenTask[],
  max = 8,
): Suggestion[] {
  if (!/^T-\d*$/.test(token)) return [];
  return tasks
    .filter((t) => t.id.startsWith(token))
    .slice(0, max)
    .map((t) => ({
      text: t.id,
      label: `${t.id}  ${t.title}`,
      description: t.state.toLowerCase(),
    }));
}

export function splitArgs(args: string): string[] {
  return args.trim() === "" ? [] : args.trim().split(/\s+/);
}

// ---- compaction after a wave run ------------------------------------------------------

// Kept word for word in both plugins' mods. A wave run is a main-loop turn that dispatched
// two or more builder agents; it is over, and its per-wave detail spent, when the turn
// answered (not interrupted, not an API error) and nothing is left in progress. A held,
// failed or unsigned task stays in progress, and the user still needs the detail to finish it.
export function isWaveRunOver(run: {
  reason: string;
  builders: number;
  inProgress: number;
}): boolean {
  return run.reason === "answer" && run.builders >= 2 && run.inProgress === 0;
}

export const COMPACT_INSTRUCTIONS =
  "A ck-code-lite build run just finished. Keep every task built and its final state, " +
  "every branch named, the manual test checklist and any deferred manual tests word for " +
  "word, and the next command the run recommended. Drop per-wave agent reports, QA output " +
  "and diffs: tasks/PLAN.md and git hold them.";

// ---- progress bar and celebrations ----------------------------------------------------

// Kept word for word in both plugins' mods, so the two bands look like one family.

export function progressBar(done: number, total: number, width = 10): string {
  const filled =
    total > 0 ? Math.round((Math.min(done, total) / total) * width) : 0;
  return "▰".repeat(filled) + "▱".repeat(width - filled);
}

// Floored, so 100% means every item is done, never 199 of 200.
export function percent(done: number, total: number): number {
  return total > 0 ? Math.floor((Math.min(done, total) / total) * 100) : 0;
}

// `open` lists the IDs not done yet; a refresh compares it with the one before.
export type Progress = { done: number; total: number; open: readonly string[] };

// The toast for work finished between two refreshes. None on the first look (a session
// start or a mod reload), and none when nothing new is done.
export function celebration(
  before: Progress | undefined,
  after: Progress,
  nouns: string,
): string | undefined {
  if (!before || after.total === 0 || after.done <= before.done)
    return undefined;
  const score = `${after.done}/${after.total}`;
  if (after.done >= after.total)
    return `★ Plan complete — ${score} ${nouns} done!`;
  const finished = before.open.filter((id) => !after.open.includes(id));
  const what =
    finished.length > 0 && finished.length <= 3
      ? finished.join(", ")
      : `${after.done - before.done} more`;
  return `✦ ${what} done — ${score} (${percent(after.done, after.total)}%)`;
}

// ---- the cost guard ----------------------------------------------------------------------

// Kept word for word in both plugins' mods; with both enabled each rule applies twice and
// changes nothing the second time. No request and no dispatch thinks above `high`: `xhigh`
// and `max` cost far more for work `high` already does. A numeric budget is left alone.
export function cappedEffort<E>(effort: E): E | "high" {
  return effort === "xhigh" || effort === "max" ? "high" : effort;
}

// Built-in agent types that would otherwise inherit the session's model — the most
// expensive one in play — when a dispatch names none. A registered plugin agent pins its
// own model in its frontmatter and is left alone; a fork always inherits.
export const DEFAULT_SUBAGENT_MODEL: Readonly<Record<string, "haiku" | "sonnet">> = {
  Explore: "haiku",
  "claude-code-guide": "haiku",
  "general-purpose": "sonnet",
};

// Fable is never chosen by the model alone: the person approves it first.
export const FABLE_APPROVED = "[fable-approved-by-user]";
export const FABLE_DENY =
  `Fable is reserved for tasks the user approves. Ask the user with AskUserQuestion whether this task needs Fable; only on a yes, re-dispatch with ${FABLE_APPROVED} as the prompt's first line. Otherwise dispatch with haiku or sonnet.`;

export type Dispatch = {
  subagent_type?: string;
  model?: string;
  effort?: string;
  prompt: string;
};
export type DispatchPatch = { model?: string; effort?: string };

// What the guard does to one Agent dispatch: deny it, rewrite its model or effort, or
// nothing (undefined).
export function guardDispatch(
  d: Dispatch,
): { deny: string } | DispatchPatch | undefined {
  if (d.model === "fable" && !d.prompt.trimStart().startsWith(FABLE_APPROVED))
    return { deny: FABLE_DENY };
  const patch: DispatchPatch = {};
  const model = DEFAULT_SUBAGENT_MODEL[d.subagent_type ?? "general-purpose"];
  if (d.model === undefined && model) patch.model = model;
  if (d.effort !== undefined && cappedEffort(d.effort) !== d.effort)
    patch.effort = "high";
  return Object.keys(patch).length ? patch : undefined;
}
