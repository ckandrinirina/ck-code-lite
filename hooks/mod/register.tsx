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
//   AbovePrompt band   the task in progress, the counts, the next build command
//
// Pure rules live in logic.ts. `$` never leaves this file except into the state helpers.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import type { LiteBand } from "../../types";
import {
  countsLine,
  isRoutable,
  nextCommand,
  parseOpen,
  planWriteReason,
  splitArgs,
  stripRouting,
  taskSuggestions,
} from "./logic";
import type { OpenTask } from "./logic";

const band = atom({ plugin: "ck-code-lite", key: "band" } as const, null);
const bandHidden = atom(
  { plugin: "ck-code-lite", key: "bandHidden" } as const,
  false,
);

// Module variables start over on a reload; the band itself lives in $.state.
let bandOn = true;
let routingCache: string | undefined;
let tasks: OpenTask[] = [];
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
    const doing = plan.tasks.find((t) => t.state === "doing");
    const next: LiteBand = {
      current: doing ? `doing ${doing.id} ${doing.title}` : "",
      counts: countsLine(plan),
      next: nextCommand(plan),
    };
    await update($, band, () => next);
  } catch {
    // A failed probe leaves the band as it was; the next turn tries again.
  } finally {
    isRefreshing = false;
  }
}

export const register: Register = (on, options) => {
  bandOn = options.band !== false;

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

  on("turn.complete", async ($, e, next) => {
    const out = await next(e);
    if (e.agentId === undefined) $.clock.after(50, () => void refreshBand($));
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
    if (e.props.isWorking) {
      return data.current ? (
        <Text dimColor wrap="truncate-end">
          ck-lite · {data.current}
        </Text>
      ) : (
        next(e)
      );
    }
    return (
      <Box gap={1}>
        <Text wrap="truncate-end">
          <Text bold>ck-lite</Text>
          {data.current ? ` · ${data.current}` : ""} · {data.counts}
          {data.next ? ` · next: ${data.next}` : ""}
        </Text>
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
  });
};
