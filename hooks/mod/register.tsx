// ck-code-lite mod: the plugin's in-process hooks (Claude Code ≥ 2.1.287).
//
// Small on purpose, like the plugin. Nothing here is load-bearing: it calls `ck-lite`, the
// same script the skills call, so under --bare, --safe-mode or an older Claude Code every
// skill still does the whole job.
//
//   prompt.submit      routes free-text prompts (was scripts/prompt-router.sh)
//   attribution.text   no AI attribution in commits and PRs (skills/ship rule)
//   tool.call          tasks/PLAN.md is written only through ck-lite
//   commands           /lite-status, /lite-waves, /lite-check with no model turn; /lite-band
//   AbovePrompt band   a progress bar, the task in progress, the next build command
//   toasts             a cheer when a task is done, a bigger one when the plan is
//   session.compact    compacts the session once a wave run of builders has finished
//   cost guard         caps effort at high, gates Fable on the user, cheap default subagent model
//   look               flat-glyph tool rows and groups, workflow words (look.tsx, theme.ts)
//   task board         the builders' own task lists, mirrored into the band
//
// Pure rules live in logic.ts. `$` never leaves this file except into the state helpers.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { LiteBand, LiteBoard } from "../../types";
import { registerUpdateCheck, startUpdateCheck } from "./update";
import { registerLook } from "./look";
import { boardLine, taskCreated, taskUpdated, todosWritten } from "./theme";
import {
  COMPACT_INSTRUCTIONS,
  celebration,
  countsLine,
  isLiteLayout,
  isRoutable,
  isWaveRunOver,
  nextCommand,
  parseOpen,
  percent,
  planWriteReason,
  progressBar,
  splitArgs,
  stripRouting,
  taskSuggestions,
  cappedEffort,
  guardDispatch,
} from "./logic";
import type { OpenTask, Progress } from "./logic";

const band = atom({ plugin: "ck-code-lite", key: "band" } as const, null);
const bandHidden = atom(
  { plugin: "ck-code-lite", key: "bandHidden" } as const,
  false,
);

const board = atom({ plugin: "ck-code-lite", key: "board" } as const, []);
// True once the band's action row has been up for BAND_ACTIONS_MS: the band folds to its
// progress line until the next turn ends.
const bandQuiet = atom(
  { plugin: "ck-code-lite", key: "bandQuiet" } as const,
  false,
);
const BAND_ACTIONS_MS = 8000;

// Module variables start over on a reload; the band itself lives in $.state.
let updateOn = true;
let bandOn = true;
let compactOn = true;
let costGuardOn = true;
// Task builders dispatched from the main loop since the last compaction. Not reset per turn:
// background builders end in later notification turns, which dispatch none themselves.
let builders = 0;
let routingCache: string | undefined;
let tasks: OpenTask[] = [];
let progress: Progress | undefined;
let isRefreshing = false;
let themeOn = true;
let isLiteHere = false;
let lookRoot = "";
let quietTimer: { cancel: () => void } | undefined;
// A builder's label on the task board, by agent id: its Agent call's description.
const boardLabels = new Map<string, string>();

// Kept word for word in both plugins' mods. The project is the nearest folder, from the
// session's cwd up, holding tasks/ or docs/ — never past the repository's top (.git) — so a
// shell cd into a subfolder keeps the band, the routing and the guards.
async function projectRoot($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd();
  for (let dir = cwd; ;) {
    if (
      (await $.fs.exists(`${dir}/tasks`)) ||
      (await $.fs.exists(`${dir}/docs`))
    )
      return dir;
    const up = dir.replace(/\/[^/]+$/, "");
    if ((await $.fs.exists(`${dir}/.git`)) || up === dir || up === "")
      return cwd;
    dir = up;
  }
}

// The lite-project rule (logic.ts isLiteLayout) on the four markers at the project's root;
// a full ck-code project's own plugin owns the prompt.
async function isLiteProject($: EngineInterface): Promise<boolean> {
  const root = await projectRoot($);
  return isLiteLayout({
    stamp: await $.fs.exists(`${root}/tasks/VERSION.md`),
    plan: await $.fs.exists(`${root}/tasks/PLAN.md`),
    architectureDir: await $.fs.exists(`${root}/docs/architecture`),
    architectureDoc: await $.fs.exists(`${root}/docs/ARCHITECTURE.md`),
  });
}

// The guard's question: is this tasks/PLAN.md inside a lite project — its own, or a builder
// worktree's copy under .claude/worktrees/? A relative path is the session cwd's, as the tool
// reads it.
async function isLitePlan($: EngineInterface, path: string): Promise<boolean> {
  if (!(await isLiteProject($))) return false;
  const abs = path.startsWith("/") ? path : `${await $.session.cwd()}/${path}`;
  return abs.startsWith(`${await projectRoot($)}/`);
}

async function ckLite($: EngineInterface, args: readonly string[]) {
  return $.process.run([`${$.plugin.root}/bin/ck-lite`, ...args], {
    cwd: await projectRoot($),
    timeoutMs: 30_000,
  });
}

async function liteCommand(
  $: EngineInterface,
  args: readonly string[],
): Promise<{ text: string }> {
  if (!(await isLiteProject($)))
    return {
      text: "Not a ck-code-lite project here (no tasks/PLAN.md). Run /ck-code-lite:start.",
    };
  try {
    const ran = await ckLite($, args);
    return {
      text: (ran.stdout + ran.stderr).trim() || "ck-lite printed nothing.",
    };
  } catch (err) {
    return {
      text: `ck-lite could not run: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function refreshBand($: EngineInterface): Promise<void> {
  // A hidden band costs no `ck-lite open`. The cheers and the T- completions wait with it:
  // /lite-band refreshes on show, and that refresh cheers whatever finished meanwhile.
  if (!bandOn || isRefreshing || (await read($, bandHidden))) return;
  isRefreshing = true;
  try {
    const root = await projectRoot($);
    if (
      !(await isLiteProject($)) ||
      !(await $.fs.exists(`${root}/tasks/PLAN.md`))
    ) {
      await update($, band, () => null);
      return;
    }
    const plan = parseOpen((await ckLite($, ["open"])).stdout);
    if (plan === null) return;
    tasks = plan.tasks;
    const now: Progress = {
      done: plan.done,
      total: plan.total,
      open: plan.tasks.map((t) => t.id),
    };
    const cheer = celebration(progress, now, "tasks");
    progress = now;
    if (cheer) $.ui.toast(`ck-code-lite: ${cheer}`);
    const doing = plan.tasks.find((t) => t.state === "doing");
    const next: LiteBand = {
      current: doing ? `${doing.id} ${doing.title}` : "",
      counts: countsLine(plan),
      done: plan.done,
      total: plan.total,
      next: nextCommand(plan),
    };
    await update($, band, () => next);
  } catch {
    // A failed probe leaves the band as it was; the next turn tries again.
  } finally {
    isRefreshing = false;
  }
}

// The look and the task board ask this on every draw: probed at session start and after
// each turn, never while drawing.
async function probeProject($: EngineInterface): Promise<void> {
  try {
    isLiteHere = await isLiteProject($);
    lookRoot = await projectRoot($);
  } catch {
    // A failed probe keeps the last answer.
  }
}

// The action row (next command, Use, Hide) comes up when a turn ends and folds away after
// BAND_ACTIONS_MS, leaving the progress line; the next turn's end brings it back.
async function wakeBand($: EngineInterface): Promise<void> {
  try {
    quietTimer?.cancel();
    await update($, bandQuiet, () => false);
    quietTimer = $.clock.after(BAND_ACTIONS_MS, () => void update($, bandQuiet, () => true));
  } catch {
    // No clock: the action row simply stays up.
  }
}

async function boardLabel($: EngineInterface, agent: string): Promise<string> {
  const known = boardLabels.get(agent);
  if (known !== undefined) return known;
  const info = (await $.agent.list()).find((a) => a.id === agent);
  const label = info?.name ?? info?.description ?? "agent";
  boardLabels.set(agent, label);
  return label;
}

// Builders that ended leave the board once the main loop's turn ends.
async function pruneBoard($: EngineInterface): Promise<void> {
  const rows = await read($, board);
  if (rows.length === 0) return;
  const live = new Set(
    (await $.agent.list())
      .filter((a) => ["pending", "running", "waiting"].includes(a.status))
      .map((a) => a.id),
  );
  if (rows.every((b) => live.has(b.agent))) return;
  await update($, board, (old) => (old ?? []).filter((b) => live.has(b.agent)));
}

// Runs between turns: $.session.compact rejects while one runs, and a person who has already
// typed the next prompt keeps the session as it is. The next command (ship, a held task's
// build) starts from tasks/PLAN.md, not from the transcript. Background builders end in later
// turns, so the count runs since the last compaction and every clean turn end checks it,
// once no builder is still live. An interrupt or an error keeps the count for a later turn.
async function compactAfterWaves(
  $: EngineInterface,
  reason: string,
): Promise<void> {
  try {
    if (!(await isLiteProject($))) return;
    const live = (await $.agent.list()).some(
      (a) =>
        a.type === "ck-code-lite:task-builder" &&
        ["pending", "running", "waiting"].includes(a.status),
    );
    if (live) return;
    const plan = parseOpen((await ckLite($, ["open"])).stdout);
    if (plan === null) return;
    const inProgress = plan.tasks.filter((t) => t.state === "doing").length;
    if (!isWaveRunOver({ reason, builders, inProgress })) return;
    const out = await $.session.compact({ instructions: COMPACT_INSTRUCTIONS });
    // Compacted, or skipped (the next prompt is typed): either way this run is spent.
    builders = 0;
    $.ui.toast(
      out.skip
        ? `ck-code-lite: not compacted, ${out.skip}`
        : "ck-code-lite: wave run finished, session compacted",
    );
  } catch {
    // A turn already running, or a failed probe: the session stays as it is.
  }
}

export const register: Register = (on, options) => {
  bandOn = options.band !== false;
  compactOn = options.compact_after_waves !== false;
  costGuardOn = options.cost_guard !== false;
  themeOn = options.theme !== false;
  updateOn = options.update_check !== false;
  registerUpdateCheck(on);

  registerLook(on, {
    isOurs: () => themeOn && isLiteHere,
    root: () => lookRoot,
  });

  on("session.start", async ($, e, next) => {
    await startUpdateCheck($, updateOn);
    await $.command.register({
      name: "lite-status",
      description: "Open ck-code-lite tasks and counts, with no model turn",
      immediate: true,
    });
    await $.command.register({
      name: "lite-waves",
      description:
        "Dependency-ordered waves of the open ck-code-lite tasks, with no model turn",
      argumentHint: "[T-NN…]",
      immediate: true,
    });
    await $.command.register({
      name: "lite-check",
      description: "Validate tasks/PLAN.md (ck-lite check), with no model turn",
      immediate: true,
    });
    await $.command.register({
      name: "lite-band",
      description: "Show or hide the ck-code-lite band above the prompt",
      immediate: true,
    });
    if ((await $.store.get("bandHidden")) === true)
      await update($, bandHidden, () => true);
    await probeProject($);
    $.clock.after(50, () => void refreshBand($));
    await wakeBand($);
    return next(e);
  });

  // ---- the cost guard: effort cap, the Fable gate, a cheap default subagent model ----
  // Kept word for word in both plugins' mods. Runs in every project, not only adopted ones:
  // it is a spending rule, not a workflow rule. Off with the cost_guard option.

  on("tool.call", { tool: "Agent" }, async ($, e, next) => {
    const g = costGuardOn ? guardDispatch(e) : undefined;
    if (g && "deny" in g) return { deny: g.deny };
    return next(g ? ({ ...e, ...g } as typeof e) : e);
  }).catch(($, e, next) => next(e));

  on("turn.step", async function* ($, e, next) {
    const effort = costGuardOn ? cappedEffort(e.effort) : e.effort;
    return yield* next(effort === e.effort ? e : { ...e, effort });
  });

  // ---- routing and attribution ----

  on("prompt.submit", async ($, e, next) => {
    if (
      !isRoutable(e.text, e.origin?.kind ?? "composer") ||
      !(await isLiteProject($))
    )
      return next(e);
    if (routingCache === undefined) {
      routingCache = stripRouting(
        String(
          await $.fs.read(`${$.plugin.root}/references/prompt-routing.md`),
        ),
      );
    }
    if (!routingCache) return next(e);
    return next({ ...e, context: [...(e.context ?? []), routingCache] });
  }).catch(($, e, next) => next(e));

  // skills/ship: no AI attribution in a commit or a PR, removed at the source.
  on("attribution.text", async ($, e, next) => {
    if ((e.kind === "commit" || e.kind === "pr") && (await isLiteProject($)))
      return { text: "" };
    return next(e);
  });

  // ---- the PLAN.md guard (fails open) ----

  on("tool.call", { tool: "Write" }, async ($, e, next) => {
    const why = planWriteReason(e.file_path);
    return why && (await isLitePlan($, e.file_path)) ? { deny: why } : next(e);
  }).catch(($, e, next) => next(e));

  on("tool.call", { tool: "Edit" }, async ($, e, next) => {
    const why = planWriteReason(e.file_path);
    return why && (await isLitePlan($, e.file_path)) ? { deny: why } : next(e);
  }).catch(($, e, next) => next(e));

  // ---- after each turn, and in the prompt box ----

  on("tool.call", { tool: "Agent" }, async ($, e, next) => {
    if (
      e.agentId === undefined &&
      e.subagent_type === "ck-code-lite:task-builder"
    )
      builders += 1;
    return next(e);
  }).catch(($, e, next) => next(e));

  // ---- task board: a subagent's task list, mirrored (its own never reaches the session's) ----

  on("tool.call", { tool: "TaskCreate" }, async ($, e, next) => {
    const out = await next(e);
    if (e.agentId === undefined || !isLiteHere || !("result" in out) || out.isError)
      return out;
    const id = out.result?.task?.id;
    if (!id) return out;
    const label = await boardLabel($, e.agentId);
    await update($, board, (old) =>
      taskCreated(old ?? [], e.agentId!, label, { id, subject: e.subject, activeForm: e.activeForm }),
    );
    return out;
  }).catch(($, e, next) => next(e));

  on("tool.call", { tool: "TaskUpdate" }, async ($, e, next) => {
    const out = await next(e);
    if (e.agentId === undefined || !isLiteHere) return out;
    await update($, board, (old) => taskUpdated(old ?? [], e.agentId!, e));
    return out;
  }).catch(($, e, next) => next(e));

  on("tool.call", { tool: "TodoWrite" }, async ($, e, next) => {
    const out = await next(e);
    if (e.agentId === undefined || !isLiteHere) return out;
    const label = await boardLabel($, e.agentId);
    await update($, board, (old) => todosWritten(old ?? [], e.agentId!, label, e.todos));
    return out;
  }).catch(($, e, next) => next(e));

  on("turn.complete", async ($, e, next) => {
    const out = await next(e);
    if (e.agentId !== undefined) return out;
    await probeProject($);
    $.clock.after(50, () => void refreshBand($));
    await wakeBand($);
    void pruneBoard($);
    if (compactOn && builders >= 2 && e.reason === "answer")
      $.clock.after(500, () => void compactAfterWaves($, e.reason));
    return out;
  });

  on("session.end", async ($, e, next) => {
    if (e.reason === "clear") builders = 0;
    return next(e);
  });

  on("prompt.autocomplete", { token: /^T-\d*$/ }, async ($, e, next) => {
    const out = await next(e);
    return {
      suggestions: [...out.suggestions, ...taskSuggestions(e.token, tasks)],
    };
  });

  // ---- commands with no model turn ----

  on("command.run", { command: "lite-status" }, async ($) =>
    liteCommand($, ["open"]),
  );

  on("command.run", { command: "lite-waves" }, async ($, e) => {
    const ids = splitArgs(e.args);
    return liteCommand($, ["waves", ...(ids.length ? ids : ["--all"])]);
  });

  on("command.run", { command: "lite-check" }, async ($) => {
    const out = await liteCommand($, ["check"]);
    return {
      text:
        out.text === "ck-lite printed nothing."
          ? "ck-lite check: the plan is valid."
          : out.text,
    };
  });

  on("command.run", { command: "lite-band" }, async ($) => {
    const hidden = !(await read($, bandHidden));
    await update($, bandHidden, () => hidden);
    await $.store.set("bandHidden", hidden);
    if (!hidden) await refreshBand($);
    if (!hidden) await wakeBand($);
    return {
      text: hidden
        ? "ck-code-lite band hidden (/lite-band shows it again)."
        : "ck-code-lite band shown.",
    };
  });

  // ---- the band ----

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const data = await read($, band);
    if (data === null || e.props.hasSurvey || (await read($, bandHidden)))
      return next(e);
    const { Box, Button, Text } = $.ui.resolve(e);
    const score = `${data.done}/${data.total}`;
    // The mods after this one (ck-tools' plan-limit rows) draw under ours, in the rows we
    // leave; a tree that ignored next(e) would hide them. Kept word for word in both mods.
    const below = async (rows: number) =>
      e.props.maxRows > rows
        ? await next({
            ...e,
            props: { ...e.props, maxRows: e.props.maxRows - rows },
          })
        : null;
    // The builders' task lists, one line each, in the rows the band can spare.
    const tasks: LiteBoard[] = (await read($, board)).filter((b) => b.tasks.length > 0);
    const boardRows = (room: number) =>
      tasks.slice(0, Math.max(0, room)).map((b) => (
        <Text key={`board-${b.agent}`} color="claude" wrap="truncate-end">
          ◈ {boardLine(b)}
        </Text>
      ));
    if (e.props.isWorking) {
      if (!data.current && tasks.length === 0) return next(e);
      const lines = [
        ...(data.current
          ? [
              <Text key="current" dimColor wrap="truncate-end">
                ▸ ck-lite · {data.current} · {score}
              </Text>,
            ]
          : []),
        ...boardRows(e.props.maxRows - (data.current ? 1 : 0)),
      ];
      const rest = await below(lines.length);
      return (
        <Box flexDirection="column">
          {lines}
          {rest}
        </Box>
      );
    }
    const isComplete = data.total > 0 && data.done >= data.total;
    // Off the fullscreen layout no click reaches a Button: name its hotkey and the chord that
    // focuses the band (ctrl+x tab). Kept word for word in both mods.
    const keys = e.surface === "terminal" && e.viewport?.isFullscreen !== true ? true : undefined;
    const header = (
      <Box key="head" gap={1}>
        <Text bold color="claude">
          ◆ ck-lite
        </Text>
        <Text color="success">{progressBar(data.done, data.total)}</Text>
        <Text bold>
          {score} {percent(data.done, data.total)}%
        </Text>
        <Text dimColor wrap="truncate-end">
          {isComplete ? "★ all done" : data.counts}
        </Text>
      </Box>
    );
    // Folded: the action row has had its seconds; the progress line and the board stay.
    if (await read($, bandQuiet)) {
      const boardEls = boardRows(e.props.maxRows - 1);
      const rest = await below(1 + boardEls.length);
      return (
        <Box flexDirection="column">
          {header}
          {boardEls}
          {rest}
        </Box>
      );
    }
    const actions = (
      <Box key="next" gap={1}>
        {data.current !== "" && (
          <Text color="warning" wrap="truncate-end">
            ▸ {data.current}
          </Text>
        )}
        {data.next !== "" && (
          <Text color="suggestion" wrap="truncate-end">
            → {data.next}
          </Text>
        )}
        {data.next !== "" && (
          <Button
            key="fill"
            label="Use"
            hotkey="u"
            plain={keys}
            onPress={() => $.prompt.fill({ text: `${data.next} ` })}
          />
        )}
        <Button
          key="hide"
          label="Hide"
          hotkey="h"
          plain={keys}
          onPress={async () => {
            await update($, bandHidden, () => true);
            await $.store.set("bandHidden", true);
          }}
        />
        {keys && (
          <Text key="keys" dimColor>
            (ctrl+x tab)
          </Text>
        )}
      </Box>
    );
    // One row left above the prompt: the next step matters more than the bar.
    if (e.props.maxRows < 2) return actions;
    const boardEls = boardRows(e.props.maxRows - 2);
    const rest = await below(2 + boardEls.length);
    return (
      <Box flexDirection="column">
        {header}
        {boardEls}
        {actions}
        {rest}
      </Box>
    );
  });
};
