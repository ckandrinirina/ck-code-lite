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
//
// Pure rules live in logic.ts. `$` never leaves this file except into the state helpers.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { LiteBand } from "../../types";
import {
  COMPACT_INSTRUCTIONS,
  celebration,
  countsLine,
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
} from "./logic";
import type { OpenTask, Progress } from "./logic";

const band = atom({ plugin: "ck-code-lite", key: "band" } as const, null);
const bandHidden = atom(
  { plugin: "ck-code-lite", key: "bandHidden" } as const,
  false,
);

// Module variables start over on a reload; the band itself lives in $.state.
let bandOn = true;
let compactOn = true;
let builders = 0;
let routingCache: string | undefined;
let tasks: OpenTask[] = [];
let progress: Progress | undefined;
let isRefreshing = false;

// The shell router's markers: tasks/PLAN.md or docs/ARCHITECTURE.md, and not a full ck-code
// project (docs/architecture/ or tasks/VERSION.md), whose own plugin owns the prompt.
async function isLiteProject($: EngineInterface): Promise<boolean> {
  const cwd = await $.session.cwd();
  if (await $.fs.exists(`${cwd}/docs/architecture`)) return false;
  if (await $.fs.exists(`${cwd}/tasks/VERSION.md`)) return false;
  if (await $.fs.exists(`${cwd}/tasks/PLAN.md`)) return true;
  return $.fs.exists(`${cwd}/docs/ARCHITECTURE.md`);
}

async function ckLite($: EngineInterface, args: readonly string[]) {
  return $.process.run([`${$.plugin.root}/bin/ck-lite`, ...args], {
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
  const ran = await ckLite($, args);
  return {
    text: (ran.stdout + ran.stderr).trim() || "ck-lite printed nothing.",
  };
}

async function refreshBand($: EngineInterface): Promise<void> {
  if (!bandOn || isRefreshing) return;
  isRefreshing = true;
  try {
    const cwd = await $.session.cwd();
    if (
      !(await isLiteProject($)) ||
      !(await $.fs.exists(`${cwd}/tasks/PLAN.md`))
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

// Runs between turns: $.session.compact rejects while one runs, and a person who has already
// typed the next prompt keeps the session as it is. The next command (ship, a held task's
// build) starts from tasks/PLAN.md, not from the transcript.
async function compactAfterWaves(
  $: EngineInterface,
  reason: string,
  dispatched: number,
): Promise<void> {
  try {
    if (!(await isLiteProject($))) return;
    const plan = parseOpen((await ckLite($, ["open"])).stdout);
    if (plan === null) return;
    const inProgress = plan.tasks.filter((t) => t.state === "doing").length;
    if (!isWaveRunOver({ reason, builders: dispatched, inProgress })) return;
    const out = await $.session.compact({ instructions: COMPACT_INSTRUCTIONS });
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

  on("session.start", async ($, e, next) => {
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
    $.clock.after(50, () => void refreshBand($));
    return next(e);
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
    return why && (await isLiteProject($)) ? { deny: why } : next(e);
  }).catch(($, e, next) => next(e));

  on("tool.call", { tool: "Edit" }, async ($, e, next) => {
    const why = planWriteReason(e.file_path);
    return why && (await isLiteProject($)) ? { deny: why } : next(e);
  }).catch(($, e, next) => next(e));

  // ---- after each turn, and in the prompt box ----

  on("turn.start", async ($, e, next) => {
    builders = 0;
    return next(e);
  });

  on("tool.call", { tool: "Agent" }, async ($, e, next) => {
    if (e.agentId === undefined && e.subagent_type === "ck-code-lite:task-builder")
      builders += 1;
    return next(e);
  }).catch(($, e, next) => next(e));

  on("turn.complete", async ($, e, next) => {
    const out = await next(e);
    if (e.agentId !== undefined) return out;
    $.clock.after(50, () => void refreshBand($));
    const dispatched = builders;
    builders = 0;
    if (compactOn && dispatched >= 2)
      $.clock.after(500, () => void compactAfterWaves($, e.reason, dispatched));
    return out;
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
    if (e.props.isWorking) {
      return data.current ? (
        <Text dimColor wrap="truncate-end">
          ⚡ ck-lite · {data.current} · {score}
        </Text>
      ) : (
        next(e)
      );
    }
    const isComplete = data.total > 0 && data.done >= data.total;
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
          {isComplete ? "🎉 all done" : data.counts}
        </Text>
      </Box>
    );
    const actions = (
      <Box key="next" gap={1}>
        {data.current !== "" && (
          <Text color="warning" wrap="truncate-end">
            ⚡ {data.current}
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
            onPress={() => $.prompt.fill({ text: `${data.next} ` })}
          />
        )}
        <Button
          key="hide"
          label="Hide"
          onPress={() => update($, bandHidden, () => true)}
        />
      </Box>
    );
    // One row left above the prompt: the next step matters more than the bar.
    if (e.props.maxRows < 2) return actions;
    return (
      <Box flexDirection="column">
        {header}
        {actions}
      </Box>
    );
  });
};
