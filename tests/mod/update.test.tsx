// Kept word for word in ck-code, ck-code-lite and ck-tools (tests/mod/update.test.tsx), but for PLUGIN.
import { expect, mock, test } from "claude-code/testing";
import type { On } from "claude-code";

import {
  CODE_URL,
  MANIFEST_URL,
  installOf,
  isNewer,
  latestOf,
} from "../../hooks/mod/update";

const PLUGIN = "ck-code-lite";
const NOW = Date.parse("2026-10-16T12:00:00Z");

// The public manifest as the marketplace serves it: ck-code local, the others by ref.
function manifest(ref: string): string {
  return JSON.stringify({
    plugins: [
      { name: "ck-code", source: "./" },
      { name: "ck-code-lite", source: { source: "github", ref: `v${ref}` } },
      { name: "ck-tools", source: { source: "github", ref: `v${ref}` } },
    ],
  });
}

const BAND = {
  plugin: PLUGIN,
  surface: "terminal",
  component: "AbovePrompt",
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 160,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const;

// A session that has loaded PLUGIN at `have` while the marketplace serves `latest`.
function session(
  on: On,
  have: string,
  latest: string,
  env: Record<string, string> = { CK_UPDATE_CHECK: "always" },
  saved: Record<string, unknown> = {},
) {
  const toasts: string[] = [];
  const fetched: string[] = [];
  mock.clock(on, { now: NOW });
  on("store.get", (_$, e) => ({ value: saved[e.key] }));
  on("store.set", (_$, e) => {
    saved[e.key] = e.value;
    return { value: undefined };
  });
  on("env.get", (_$, e) => ({ value: env[e.name] }));
  on("fs.read", (_$, e) =>
    e.path.endsWith("/.claude-plugin/plugin.json")
      ? { value: JSON.stringify({ name: PLUGIN, version: have }) }
      : { value: "{}" },
  );
  on("http.fetch", (_$, e) => {
    fetched.push(e.url);
    const text =
      e.url === MANIFEST_URL
        ? manifest(latest)
        : e.url === CODE_URL
          ? JSON.stringify({ version: latest })
          : "";
    return { value: { status: 200, ok: true, headers: {}, text } };
  });
  // What each plugin's own session.start reads: an empty project.
  on("session.root", () => ({ value: "/p" }));
  on("session.cwd", () => ({ value: "/p" }));
  on("fs.exists", () => ({ value: false }));
  on("fs.list", () => ({ value: [] }));
  on("process.run", () => ({
    value: { exitCode: 0, stdout: "", stderr: "", isStdoutTruncated: false, isStderrTruncated: false },
  }));
  on("ui.invalidate", () => ({ value: undefined }));
  on("command.register", (_$, e) => ({ value: { command: e.name } }));
  on("session.usage", () => ({
    value: { startedAt: NOW, context: { window: 200000 }, rateLimits: [] },
  }));
  on("ui.toast", (_$, e) => {
    toasts.push(e.text);
    return { value: undefined };
  });
  on("session.start", () => ({ cwd: "/p" }));
  on("ui.render", () => ({
    type: "Text",
    props: {},
    children: ["other band"],
  }));
  return { toasts, fetched, saved };
}

const start = { surface: "terminal", isInteractive: true, cwd: "/p" } as const;

test("a newer marketplace version toasts once and stays as a row above the other bands", async ($, on) => {
  const s = session(on, "1.0.0", "9.0.0");
  await $.session.start(start);
  const ui = await $.ui.mount(BAND as never);
  expect(await ui.find({ text: /9\.0\.0 is out \(you have 1\.0\.0\)/ })).toBeDefined();
  expect(await ui.find({ text: "other band" })).toBeDefined();
  expect(s.toasts.length).toBe(1);
  expect(s.toasts[0]).toContain(`/plugin update ${PLUGIN}@ck-marketplace`);
  await $.session.start(start);
  expect(s.toasts.length).toBe(1);
});

test("an up-to-date plugin draws nothing and toasts nothing", async ($, on) => {
  const s = session(on, "9.0.0", "9.0.0");
  await $.session.start(start);
  const ui = await $.ui.mount(BAND as never);
  expect(await ui.find({ text: /is out/ })).toBeUndefined();
  expect(s.toasts.length).toBe(0);
});

test("a checkout outside the plugin cache is never checked", async ($, on) => {
  const s = session(on, "1.0.0", "9.0.0", {});
  await $.session.start(start);
  expect(s.fetched.length).toBe(0);
});

test("CK_UPDATE_CHECK=off and the nonessential-traffic switch both skip the check", async ($, on) => {
  const s = session(on, "1.0.0", "9.0.0", {
    CK_UPDATE_CHECK: "off",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  });
  await $.session.start(start);
  expect(s.fetched.length).toBe(0);
});

test("the update_check option off skips the check", { options: { update_check: false } }, async ($, on) => {
  const s = session(on, "1.0.0", "9.0.0");
  await $.session.start(start);
  expect(s.fetched.length).toBe(0);
});

test("installOf reads the marketplace and name from the cache path", () => {
  expect(installOf("/u/.claude/plugins/cache/ck-marketplace/ck-code/7.17.0")).toEqual({
    marketplace: "ck-marketplace",
    name: "ck-code",
  });
  expect(installOf("/Users/me/Dev/ck-code")).toBe(null);
});

test("isNewer compares numerically and refuses junk", () => {
  expect(isNewer("7.19.0", "7.17.0")).toBe(true);
  expect(isNewer("7.10.0", "7.9.9")).toBe(true);
  expect(isNewer("v2.4.1", "2.4.0")).toBe(true);
  expect(isNewer("7.17.0", "7.17.0")).toBe(false);
  expect(isNewer("7.2.1", "7.19.0")).toBe(false);
  expect(isNewer("latest", "1.0.0")).toBe(false);
});

test("latestOf reads a github ref, or ck-code's own plugin.json", () => {
  expect(latestOf("ck-tools", manifest("2.5.0"))).toBe("2.5.0");
  expect(latestOf("ck-code", manifest("2.5.0"), JSON.stringify({ version: "7.20.0" }))).toBe(
    "7.20.0",
  );
  expect(latestOf("ck-code", manifest("2.5.0"))).toBe(undefined);
  expect(latestOf("other", manifest("2.5.0"))).toBe(undefined);
  expect(latestOf("ck-tools", "not json")).toBe(undefined);
});
