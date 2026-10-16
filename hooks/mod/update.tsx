// Update check: when the marketplace serves a newer version of this plugin than the one the
// session loaded, one toast per new version and a row above the prompt until it is updated.
//
// Kept word for word in ck-code, ck-code-lite and ck-tools (hooks/mod/update.tsx); each
// register.tsx calls registerUpdateCheck(on) and, from its session.start, startUpdateCheck.
// Holds no $.state: the row reads a module variable and the fetch redraws it. Only an install from the marketplace cache is
// checked, so a --plugin-dir checkout never nags; CK_UPDATE_CHECK=always forces a check (tests,
// the playground). The latest version is the one the public marketplace.json serves — a
// github entry's `ref`, or ck-code's own plugin.json for the local `./` entry — fetched at
// most once per CHECK_MS and kept in $.store, so most sessions start without a request.

import type { EngineInterface, Register } from "claude-code";

type On = Parameters<Register>[0];

const RAW = "https://raw.githubusercontent.com/ckandrinirina/ck-code/main/.claude-plugin";
export const MANIFEST_URL = `${RAW}/marketplace.json`;
export const CODE_URL = `${RAW}/plugin.json`;
export const CHECK_MS = 6 * 3_600_000;

export type Install = { marketplace: string; name: string; version: string };
export type Latest = { version: string; at: number };

// Where the loader put this plugin: …/plugins/cache/<marketplace>/<name>/<version>.
export function installOf(root: string): Omit<Install, "version"> | null {
  const m = /\/plugins\/cache\/([^/]+)\/([^/]+)\/[^/]+\/?$/.exec(root);
  return m?.[1] && m[2] ? { marketplace: m[1], name: m[2] } : null;
}

// "v7.19.0" or "7.19.0" → [7, 19, 0]; anything else → null.
export function parseVersion(text: unknown): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// True when `want` is a strictly higher version than `have`.
export function isNewer(want: string, have: string): boolean {
  const a = parseVersion(want);
  const b = parseVersion(have);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

// The version the marketplace serves for `name`: a github entry's ref, or for a local
// ("./") entry the version in `codeText`, ck-code's plugin.json. Undefined when unknown.
export function latestOf(
  name: string,
  manifestText: string,
  codeText?: string,
): string | undefined {
  try {
    const manifest = JSON.parse(manifestText) as {
      plugins?: { name?: string; source?: unknown }[];
    };
    const entry = manifest.plugins?.find((p) => p.name === name);
    if (!entry) return undefined;
    const src = entry.source as { ref?: string } | string | undefined;
    if (typeof src === "object" && src?.ref) {
      const v = parseVersion(src.ref);
      return v ? v.join(".") : undefined;
    }
    if (codeText === undefined) return undefined;
    const v = parseVersion((JSON.parse(codeText) as { version?: string }).version);
    return v ? v.join(".") : undefined;
  } catch {
    return undefined;
  }
}

// True when the marketplace entry for `name` is the local one, read from ck-code's plugin.json.
export function needsCodeManifest(name: string, manifestText: string): boolean {
  try {
    const manifest = JSON.parse(manifestText) as {
      plugins?: { name?: string; source?: unknown }[];
    };
    return typeof manifest.plugins?.find((p) => p.name === name)?.source === "string";
  } catch {
    return false;
  }
}

export function updateRow(i: Install, want: string): string {
  return `▸ ${i.name} ${want} is out (you have ${i.version}) · /plugin update ${i.name}@${i.marketplace}, then restart`;
}

export function updateToast(i: Install, want: string): string {
  return `${i.name} ${want} is out, you have ${i.version}. Run /plugin update ${i.name}@${i.marketplace}, then restart Claude Code.`;
}

let install: Install | null = null;
let want: string | undefined;

async function fetchLatest($: EngineInterface, name: string): Promise<string | undefined> {
  const manifest = await $.http.fetch(MANIFEST_URL);
  if (!manifest.ok) return undefined;
  let code: string | undefined;
  if (needsCodeManifest(name, manifest.text)) {
    const res = await $.http.fetch(CODE_URL);
    if (!res.ok) return undefined;
    code = res.text;
  }
  return latestOf(name, manifest.text, code);
}

async function check($: EngineInterface, force: boolean): Promise<void> {
  if (!install) return;
  const t = await $.clock.now();
  const saved = (await $.store.get("update-latest")) as Latest | undefined;
  let latest = saved?.version;
  if (force || !saved || t - saved.at > CHECK_MS) {
    try {
      const fresh = await fetchLatest($, install.name);
      if (fresh) {
        latest = fresh;
        await $.store.set("update-latest", { version: fresh, at: t });
      }
    } catch {
      // Offline or refused: the saved answer, if any, stands until the next check.
    }
  }
  want = latest && isNewer(latest, install.version) ? latest : undefined;
  $.ui.invalidate("ui.render");
  if (!want) return;
  // One toast per new version, whichever session sees it first.
  if ((await $.store.get("update-toasted")) === want) return;
  await $.store.set("update-toasted", want);
  $.ui.toast(updateToast(install, want), { timeoutMs: 12000 });
}

// Called from the plugin's own session.start hook (a module holds one unmatched hook per
// event). Never throws, and never holds the start for the network.
export async function startUpdateCheck($: EngineInterface, isOn: boolean): Promise<void> {
  if (!isOn) return;
  try {
    const mode = await $.env.get("CK_UPDATE_CHECK");
    if (mode === "off" || (await $.env.get("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC")))
      return;
    const where = installOf($.plugin.root);
    const forced = mode === "always";
    if (!where && !forced) return;
    const manifest = JSON.parse(
      await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`),
    ) as { name?: string; version?: string };
    const version = parseVersion(manifest.version);
    if (!version) return;
    install = {
      marketplace: where?.marketplace ?? "ck-marketplace",
      name: where?.name ?? manifest.name ?? $.plugin.name,
      version: version.join("."),
    };
    void check($, forced).catch(() => undefined);
    $.clock.every(CHECK_MS, () => void check($, false).catch(() => undefined));
  } catch {
    // No manifest to read: nothing to compare, nothing drawn.
  }
}

export function registerUpdateCheck(on: On): void {
  // One row, above whatever the other bands draw; they get the rows left.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    if (!install || !want || e.props.hasSurvey || e.props.maxRows < 1) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const mine = (
      <Text key="update" color="warning" wrap="truncate-end">
        {updateRow(install, want)}
      </Text>
    );
    const left = e.props.maxRows - 1;
    if (left < 1) return mine;
    const theirs = await next({ ...e, props: { ...e.props, maxRows: left } });
    return (
      <Box flexDirection="column">
        {mine}
        {theirs}
      </Box>
    );
  }).catch(($, e, next) => next(e));
}
