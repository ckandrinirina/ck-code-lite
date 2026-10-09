---
name: design
description: Use when a project with a user interface should be designed with Claude Design before building — describing the product and writing the prompt to paste into claude.ai/design, linking a finished design system from its URL, or refreshing the linked design. Also when the user pastes a claude.ai/design URL. Argument is an optional idea, spec path, or claude.ai/design URL.
argument-hint: "[idea | path/to/spec.md | claude.ai/design URL | link]"
effort: high
allowed-tools: Bash(git rev-parse*) Bash(ls*) Bash(grep*) Bash(mkdir*) Bash(shasum*) Bash(ck-lite*) Bash(pbcopy*) Bash(wl-copy*) Bash(xclip*) DesignSync Skill
---

# Design — Claude Design First

Designs the UI before any of it is built. Claude describes the project with the user, writes the
best possible prompt for [claude.ai/design](https://claude.ai/design), and — once the user hands
back the finished design system's URL — caches it in the repository so every UI task builds
against its exact tokens and markup.

One command, three modes, chosen from the argument and the project state:

| Mode        | When                                      | Writes                 |
| ----------- | ----------------------------------------- | ---------------------- |
| **BRIEF**   | no design linked, no URL given            | `docs/design-brief.md` |
| **LINK**    | a uuid or URL in the argument, or `link`  | `docs/design-system/`  |
| **REFRESH** | `docs/design-system/` exists, no argument | changed cards only     |

Contract — state, cache, lookup, fidelity: [design-system.md](../../references/design-system.md).
This skill never branches, commits, or creates a worktree, and never reads or edits
`tasks/PLAN.md` except through `ck-lite`.

## INPUT

`$ARGUMENTS`:

- **Contains a uuid**, or is `link` → LINK (`link` alone opens the project picker).
- **A path that exists** → BRIEF, with that file as the requirement source.
- **Other text** → BRIEF, with the text as the idea.
- **Empty** → REFRESH when `docs/design-system/` exists, otherwise BRIEF.

## PHASE 0: PLUGIN GUARD

ck-code markers: !`cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && ls -d tasks/VERSION.md docs/architecture 2>/dev/null | grep . || echo none`

`none` → continue. Anything else is a full ck-code project. Print exactly this, then **stop**:

```
⛔ This is a ck-code project, not a ck-code-lite one.
   Use /ck-code:spec (it writes the Claude Design brief) or /ck-code:design ds <url>.
```

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

3. Print the hand-off — four lines, no more:

```
## Design brief ready — docs/design-brief.md (copied to the clipboard)

1. Open https://claude.ai/design and start a **design system** project.
2. Paste the brief. Iterate there until it looks right.
3. Copy the project URL and run: /ck-code-lite:design <url> — now or in any later session.
```

Say plainly that nothing is waiting: the work stops here, and planning can continue while the
design is made. Then **NEXT**: no `tasks/PLAN.md` → offer via `AskUserQuestion` to plan now
with `/ck-code-lite:start` (**Plan while you design** recommended, **Later**); it reads the
brief as its requirement. A plan already exists → print `/ck-code-lite:build` as the next step;
UI tasks will ask for the link once.

## PHASE 3: LINK

1. **Tool check.** `DesignSync` unavailable → print the one line from
   [§ When DesignSync is unavailable](../../references/design-system.md#when-designsync-is-unavailable)
   and stop.
2. Run [§ Linking](../../references/design-system.md#linking) steps 1–6, with
   `mkdir -p docs/design-system/cards` before the first write. A project id different from an
   existing `manifest.json` → confirm the switch first.
3. When `docs/ARCHITECTURE.md` exists, set its `## Design` line to
   `- Claude Design: linked — <project name> (docs/design-system/)`. Keep
   `docs/design-brief.md` — it records what was asked for.
4. Report:

```
=== DESIGN SYSTEM LINKED ===
Project: <name> (<projectId>)
Cached:  <n> cards (<n> components, <n> screens) · <n> skipped (binary / too large)
Tokens:  <n> extracted · <m> low-confidence — confirm the ⚠️ rows in docs/design-system/index.md
Next:    /ck-code-lite:build — UI tasks build against it  |  /ck-code-lite:start — no plan yet
```

The cache ships with the next `/ck-code-lite:ship`.

## PHASE 4: REFRESH

Tool check as in LINK, then [§ Freshness](../../references/design-system.md#freshness) from
Tier 0, announcing the starting tier. Report `up to date — 1 call`, or the added / changed /
removed cards and any token that changed value — a changed token touches every screen, so name
it.

## RULES

- **Never run in a full ck-code project** — Phase 0 stops and names the ck-code command.
- **Never call a `DesignSync` write method** — pull-only.
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
