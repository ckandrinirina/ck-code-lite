---
name: design
description: Use when a UI project should be designed before building, in Claude Design or in Figma, when a finished Claude Design project or Figma file should be linked by URL or refreshed, when the linked design should be previewed in a browser, or when an existing app (website, desktop or mobile app, CLI) should be copied. Also when a claude.ai/design, claude.ai/artifact or figma.com URL is pasted. Argument is an optional idea, spec path, design URL, `figma [idea]`, `preview`, or `replicate <source>`.
argument-hint: "[idea | path/to/spec.md | claude.ai/design, claude.ai/artifact or figma.com URL | figma [idea] | preview | link | replicate <url|app|cli cmd|path>]"
effort: high
allowed-tools: Bash(git rev-parse*) Bash(ls*) Bash(grep*) Bash(mkdir*) Bash(shasum*) Bash(cp*) Bash(ck-lite*) Bash(pbcopy*) Bash(wl-copy*) Bash(xclip*) DesignSync Artifact Skill
---

# Design — Design First, in Claude Design or Figma

Designs the UI before any of it is built. Claude describes the project with the user, writes the
best possible brief — for [claude.ai/design](https://claude.ai/design), or drawn in Figma — and,
once the user hands back the URL of the finished Claude Design project or Figma file (a system
and a design may pair), caches it in the repository so every UI task builds against its exact
tokens and markup. Figma frames are imported exactly: Figma's own render, and CSS read from the
layer tree ([figma.md](../../references/figma.md)).

One command, five modes, chosen from the argument and the project state:

| Mode          | When                                               | Writes                     |
| ------------- | -------------------------------------------------- | -------------------------- |
| **BRIEF**     | no design linked, no URL given; `figma [idea]`      | `docs/design-brief.md`     |
| **LINK**      | a claude.ai/design, claude.ai artifact or figma.com URL, a uuid, `link` | `docs/design-system/` |
| **REFRESH**   | `docs/design-system/` exists, no argument          | changed cards only         |
| **PREVIEW**   | `preview`                                          | nothing                    |
| **REPLICATE** | `replicate <source>`                               | `docs/replica/<slug>/`     |

Replicating an existing app — website, Electron, macOS, Android, iOS, CLI, source tree or
screenshots: [replicate.md](../../references/replicate.md).

Contract — state, cache, lookup, fidelity: [design-system.md](../../references/design-system.md).
This skill never branches, commits, or creates a worktree, and never reads or edits
`tasks/PLAN.md` except through `ck-lite`.

## INPUT

`$ARGUMENTS`:

- **Starts with `replicate`** → REPLICATE; the rest is the source.
- **Is `preview`** → PREVIEW.
- **Contains a `figma.com` URL** → LINK, Figma.
- **Contains a `claude.ai/artifact/` or `claude.ai/code/artifact/` URL** → LINK, artifact —
  checked before the uuid rule, since a `code/artifact` uuid is not a `DesignSync` id.
- **Starts with `figma`** (no URL) → BRIEF with target **Figma**; the rest is the idea or spec path.
- **Contains a uuid**, or is `link` → LINK (`link` alone opens the project picker).
- **A path that exists** → BRIEF, with that file as the requirement source.
- **Other text** → BRIEF, with the text as the idea.
- **Empty** → REFRESH when `docs/design-system/` exists, otherwise BRIEF.

## PHASE 0: PLUGIN GUARD

Plan markers: !`cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && ls -d tasks/VERSION.md docs/architecture tasks/PLAN.md docs/design-system 2>/dev/null | grep . || echo none`

A full ck-code project — `tasks/VERSION.md` listed, or `docs/architecture` listed without
`tasks/PLAN.md` — is ck-code's, whose state ck-code-lite cannot read or keep in step.
[Redirect](../../references/plugin-redirect.md) before any read, write or command:

- `replicate <source>` → `ck-code:design replicate <source>`
- a uuid, claude.ai/design, claude.ai artifact or figma.com URL → `ck-code:design ds <url>`
- `preview` → `ck-code:design ds preview`; `figma [idea]` → `ck-code:spec <idea>` (it offers Figma)
- `link`, or empty with `docs/design-system` listed → `ck-code:design ds`
- anything else → `ck-code:spec <text or path>` (it writes the Claude Design brief)

Anything else → continue.

## PHASE 1: STATE

```bash
ls -d docs/design-system docs/design-brief.md docs/ARCHITECTURE.md tasks/PLAN.md 2>/dev/null; grep -h 'Claude Design:' docs/ARCHITECTURE.md 2>/dev/null
```

Derive the status ([§ Design state](../../references/design-system.md#design-state)) and the
mode (INPUT). Announce both in one line: `Design: pending — mode LINK`.

BRIEF while a brief already exists → one `AskUserQuestion`: **Link the finished design**
(→ LINK with the picker), **Rewrite the brief**, **Cancel**. BRIEF on a `declined` project
runs — the user asked; the `## Design` line is rewritten to `pending` in Phase 2.4.

## PHASE 2: BRIEF

### 2.1 Gather — hard cap 5 reads

Read what exists, in this order, and stop at five: the spec file from `$ARGUMENTS`,
`docs/ARCHITECTURE.md`, then the plan's surface tasks —

```bash
ck-lite open
```

— and `ck-lite show T-NN` for at most two surface tasks whose criteria describe screens. With
none of these, `$ARGUMENTS` is the whole source.

### 2.2 Describe the project — one round

Write the **project description** Claude understood, and print it before asking anything:

```
## <Product name> — as I understand it

<one paragraph: what it is, for whom, the core job>

Platform: <…> · Tone: <…>
Screens: <screen> — <purpose> · <screen> — <purpose> · …
Key flows: <flow> · <flow>
```

Then **exactly one `AskUserQuestion`, at most 4 questions**. The first is always
**"Is this description right?"** — `Yes` / `Adjust` (with Other for the correction). The rest
cover only the gaps that change the design and that nothing read in 2.1 answers, picked in
this order:

1. Brand constraints — fixed colors, typeface, logo, a reference product (`None — open`)
2. Platform and primary device, when the description left it open
3. Dark mode — required or not
4. Density and tone, when the product type does not imply them

Never ask what the description already states. An `Adjust` answer is folded into the
description silently — no second round.

### 2.3 Write the brief

Write `docs/design-brief.md` from [design-brief.md](references/design-brief.md), every section
derived from the confirmed description and the 2.1 reads. `mkdir -p docs` first.

### 2.4 Hand off

1. When `docs/ARCHITECTURE.md` exists, set its `## Design` line to
   `- Claude Design: pending — brief docs/design-brief.md` (add the section after
   `## Conventions` when absent; `Edit`, never `Write`).
2. Copy the brief to the clipboard, best-effort — the first of these that exists:

   ```bash
   pbcopy < docs/design-brief.md      # macOS
   wl-copy < docs/design-brief.md     # Wayland
   xclip -selection clipboard < docs/design-brief.md
   ```

   None available → say the file is the prompt to paste.

3. **Target Figma** → hand off by [figma.md § Create in Figma](../../references/figma.md#create-in-figma)
   instead of the block below: offer **Draw it in Figma now** when the official Figma plugin is
   enabled, and on a file URL coming back run Phase 3 with it; otherwise print its setup lines
   and `/ck-code-lite:design <figma URL>`. Then **NEXT** as below.
4. Target Claude Design → print the hand-off — four lines, no more:

```
## Design brief ready — docs/design-brief.md (copied to the clipboard)

1. Open https://claude.ai/design and start a **design system** project (a design project links too).
2. Paste the brief. Iterate there until it looks right.
3. Copy the project URL and run: /ck-code-lite:design <url> — now or in any later session.
```

Prefer Figma? `/ck-code-lite:design figma` draws the same brief in a Figma file.

Say plainly that nothing is waiting: the work stops here, and planning can continue while the
design is made. Then **NEXT**: no `tasks/PLAN.md` → offer via `AskUserQuestion` to plan now
with `/ck-code-lite:start` (**Plan while you design** recommended, **Later**); it reads the
brief as its requirement. A plan already exists → print `/ck-code-lite:build` as the next step;
UI tasks will ask for the link once.

## PHASE 3: LINK

**A `figma.com` URL** → [figma.md](../../references/figma.md): probe the tier (§ Tiers), then
§ Import for that tier, `mkdir -p docs/design-system/cards` first. A linked project of another
source pairs or replaces exactly as below (step 2). Then steps 3–4, with the `## Design` line
`- Claude Design: linked — <file name> (Figma) (docs/design-system/)` and `Project:` reading
`<file name> (<fileKey>) · figma <exact|mcp>`; a frame whose rebuild matched under 98 % is
named in the report. No `DesignSync` is needed.

**A claude.ai artifact URL** → [§ Link from an artifact](../../references/design-system.md#link-from-an-artifact),
`mkdir -p docs/design-system/cards` first; it pairs or replaces as in step 2, then steps 3–4
with `Project:` reading `<name> (<projectId>) · design · artifact`. It needs `Artifact`, not
`DesignSync`, so step 1 is skipped.

1. **Tool check.** `DesignSync` unavailable → print the one line from
   [§ When DesignSync is unavailable](../../references/design-system.md#when-designsync-is-unavailable)
   and stop.
2. Run [§ Linking](../../references/design-system.md#linking) steps 1–6, with
   `mkdir -p docs/design-system/cards` before the first write. A project id different from an
   existing `manifest.json` → pair or replace per
   [§ Design system and design together](../../references/design-system.md#design-system-and-design-together),
   asked before anything is written.
3. When `docs/ARCHITECTURE.md` exists, set its `## Design` line to
   `- Claude Design: linked — <project name>[ + <paired name>] (docs/design-system/)`. Keep
   `docs/design-brief.md` — it records what was asked for.
4. Report:

```
=== DESIGN SYSTEM LINKED ===
Project: <name> (<projectId>) · <system | design>[ · paired with <name> (<type>)]
Cached:  <n> cards (<n> components, <n> screens) · <n> skipped (binary / too large)
Tokens:  <n> extracted · <m> low-confidence — confirm the ⚠️ rows in docs/design-system/index.md
Next:    /ck-code-lite:build — UI tasks build against it  |  /ck-code-lite:start — no plan yet
```

The cache ships with the next `/ck-code-lite:ship`.

## PHASE 4: REFRESH

A Figma project (`projectType: figma` in `manifest.json`) refreshes by re-running its import
([figma.md § Import](../../references/figma.md#import--exact-tier)) with `figmaSource` — one call when
its version is unchanged. A manifest with `artifactUrl` refreshes from that artifact by
[§ Freshness](../../references/design-system.md#freshness), never `DesignSync`. Otherwise: tool check as in LINK, then [§ Freshness](../../references/design-system.md#freshness) from
Tier 0 (Tier 1 for a design project) — for each linked project — announcing the starting tier. Report `up to date — 1 call`, or the added / changed /
removed cards and any token that changed value — a changed token touches every screen, so name
it.

## PHASE 4b: PREVIEW

No design linked → say so, and offer BRIEF or LINK; stop. Otherwise start
[§ Preview](../../references/design-system.md#preview) with `run_in_background` and relay its
URL and counts in two lines — tokens, screens, components, comparisons. Say how to stop it, and
that a reload shows a later build's shots.

## PHASE 5: REPLICATE

Capture an app the user wants copied and distil it into `docs/replica/<slug>/REPLICA.md` — the
requirement `start` plans from, screen by screen. [replicate.md](../../references/replicate.md)
owns the sources, copy policy, pack layout and template; run them, never restate them.

1. **Identify.** Match the source to a row of [§ Sources](../../references/replicate.md#sources):
   an http(s) URL → web; a macOS `.app` or app name →
   `ck-lite-replicate mac "<app>" --out docs/replica/<slug> --static-only`, whose toolkit line
   routes an Electron app to the `electron` row; a connected phone or an `.apk` → android;
   `cli <command>` → cli; a directory with source → source tree; image paths → screenshots.
   Announce `Replicate: <source> — <kind> → docs/replica/<slug>/`.
2. **Ask — one round.** One `AskUserQuestion`, at most 3 questions (plus the source, when
   none was given): **Copy policy** — `Own app` / `Reference only`
   ([§ Copy policy](../../references/replicate.md#copy-policy)), always; **Fidelity** — `Pixel`
   (Recommended for an own app) / `Structural` (Recommended otherwise); **Scope**, web only —
   `Whole site, up to 12 pages` / `Specific sections` (Other → the paths, passed as `--include`).
3. **Capture.** `mkdir -p docs/replica/<slug>`; append the three ignore lines from
   [§ Pack layout](../../references/replicate.md#pack-layout) to `.gitignore` when absent. Web
   and Electron → `ck-lite-replicate doctor` first. Run the row's command; snap-per-screen kinds
   loop as § Sources says. Relay each command's last line; on a failure take § Sources' fallback.
4. **Distil.** Write `REPLICA.md` by [§ REPLICA.md](../../references/replicate.md#replicamd).
   When `docs/ARCHITECTURE.md` exists, add the `- Replica: …` line of
   [§ Planning from a replica](../../references/replicate.md#planning-from-a-replica) to its
   `## Design` section (`Edit`, never `Write`). Report:

```
=== REPLICA READY ===
Source:  <source> (<kind>) · policy <own app|reference only> · fidelity <pixel|structural>
Screens: <n> (S-01 … S-NN) · tokens <n> · components <n> · entities <n>
Gaps:    <n> — listed in REPLICA.md § Gaps
Pack:    docs/replica/<slug>/  (screenshots are git-ignored; REPLICA.md has the recapture command)
```

5. **Hand off.** One `AskUserQuestion`: **Plan from it now** (Recommended) → invoke
   `/ck-code-lite:start docs/replica/<slug>/REPLICA.md`; **Write a Claude Design brief first** →
   Phase 2 with `REPLICA.md` as the requirement source and its reference screenshots named for
   the user to attach; **Stop here** → print that `start` command.

## RULES

- **Never capture an app the user did not name, or get around a sign-in or bot block** — and
  under `Reference only`, never copy its logo, name, imagery or copy
  ([replicate.md § Copy policy](../../references/replicate.md#copy-policy)).
- **Never run in a full ck-code project** — Phase 0 hands it to `/ck-code:design ds` or
  `/ck-code:spec`, once; never bounce a request ck-code just redirected here.
- **Never call a `DesignSync` write method, or `Artifact` `publish`/`delete`** — pull-only. Never write to a linked Figma file;
  the only Figma write is a new file the user asked for ([figma.md](../../references/figma.md#rules)).
- **Never ask for, type or echo a Figma token** — the user saves it ([figma.md § Token setup](../../references/figma.md#token-setup)).
- **Never ask more than one question round in BRIEF**, never more than 4 questions, and never
  ask what the project already answers.
- **Never invent a product decision in the brief** — an open point is a § 9 question.
- **Never write lorem ipsum or a generic screen into the brief** — real screens, real content.
- **Never write the hand-back command into the brief** — it is printed, not pasted.
- **Never fall back to the picker when a user-supplied project cannot be reached** — say which
  one and stop.
- **Never `Write` over `docs/ARCHITECTURE.md`** — its `## Design` line is `Edit`ed.
- **Never commit, branch or create a worktree** — `/ck-code-lite:ship` commits the brief and
  the cache.
