# Figma — Shared Contract

Owns importing a Figma Design file into the design cache, creating a design in Figma, and what
the fidelity loop does differently for a Figma card. A Figma file links into the same
`docs/design-system/` cache as a Claude Design project
([design-system.md](design-system.md)), with `projectType: figma`. Everything after linking —
component lookup, token materialization, fidelity rules, the 3-pass loop, QA — is unchanged.

Read by `design` (link, refresh, create) and `build` (the fidelity loop on a Figma card).

## Tiers

| Tier      | Needs                                         | Each frame gets                                                                                                                                                      |
| --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **exact** | a Figma personal access token                 | `frame.png` (Figma's own 1× render), `node.json` (raw layer tree), `spec.md` (every layer's CSS, derived by fixed rules), `index.html` (static rebuild), SVG icons, image fills, named-style tokens |
| **mcp**   | the official Figma plugin, signed in          | `frame.png` from `get_screenshot`, `context.md` from `get_design_context` (Figma's own reference code), assets from `download_assets`, tokens from `get_variable_defs` |

Probe once per run:

```bash
{ [ -n "$FIGMA_TOKEN" ] || [ -s "$HOME/.config/ck/figma-token" ]; } && echo "figma: token" || echo "figma: no token"
```

Token → **exact**. No token, but a Figma MCP tool whose name ends in `get_design_context` is in
the session → **mcp**, announced as `Figma: MCP tier — a token gives the exact tier (§ Token
setup)`. Neither → print § Token setup and the plugin install line from § Create in Figma, and
stop. Nothing is written.

In both tiers the reference is Figma's own render, never a re-render. The tiers differ in the
spec: the exact tier reads every value from the layer tree, while the mcp tier's `context.md` is
Figma's React + Tailwind interpretation of it.

## Token setup

The user runs these steps. Claude never asks for the token in chat, never types it, never echoes
it, and never writes it anywhere.

1. figma.com → Settings → Security → **Personal access tokens** → Generate. Scope
   **File content: Read-only** (add **Variables: Read** on an Enterprise plan).
2. In their own terminal, with the token copied:

   ```bash
   mkdir -p ~/.config/ck && pbpaste > ~/.config/ck/figma-token && chmod 600 ~/.config/ck/figma-token
   ```

   On Linux, `wl-paste` or `xclip -o` replaces `pbpaste`. `export FIGMA_TOKEN=…` in their shell
   profile works too.

The engine sends the token only to `api.figma.com`, in the `X-Figma-Token` header — never in a
URL, never to an asset host. It never prints the token or writes it to a file.

## URLs

`figma.com/design/<key>/<name>?node-id=1-2` — also `/file/`, `/proto/` and branch URLs
(`/design/<key>/branch/<branch>/…`). The URL's `node-id` decides what is imported:

- a **frame** imports that frame
- a **page** or **section** imports its top-level frames
- **none** imports every top-level frame in the file, up to `--max` (30)

`--frames <regex>` and `--page <regex>` narrow the selection. When the engine prints
`N more frames not pulled`, relay that line and ask for a page or frame link.

A **Make**, FigJam, Slides or Sites file is refused by name, because it has no design layers. A
Make file is code, so its design must first be built in a Design file.

## Import — exact tier

`DS` is `docs/design-system`. A paired import writes to `$DS/cards/paired` instead
([design-system.md § Design system and design together](design-system.md#design-system-and-design-together)).

```bash
ck-lite-replicate figma pull "<figma URL>" --out docs/design-system/cards
```

The import is a handful of API calls. On a rate limit (HTTP 429) the engine waits and says so.
It prints one line per frame. When Chrome is present, that line includes
`rebuild matches Figma N%`. Below 98 %, name the frame and its ⚠️ count. The usual cause is a
font missing on this machine; `spec.md`'s `Fonts:` line names it.

Then write the cache files from `cards/figma.json`.

**`manifest.json`**

| Key                | Value                                    |
| ------------------ | ---------------------------------------- |
| `projectId`        | `fileKey`                                |
| `projectName`      | `fileName`                               |
| `projectType`      | `"figma"`                                |
| `projectUpdatedAt` | `version`                                |
| `syncedAt`         | `pulledAt`                               |
| `figmaSource`      | `source`                                 |
| `figmaTier`        | `"exact"`                                |
| `cards`            | one entry per `figma.json` `cards` path  |

Each card entry has `path`, `sha256` and `cached: true`. A frame's `index.html` also carries
`group` (`Screens` for a screen, `Components` for a component) and `name` (the frame name). Every
other file is `group: "Figma"`.

**`index.md`**

- **§ Foundations** comes from `figma.json` `tokens`: name, value, source. A named style or
  variable is exact, so it gets no ⚠️.
- When `variables` reads `unavailable` and Figma MCP tools are in the session, call
  `get_variable_defs` on up to 5 frames. Add each variable it names, with source
  `variable (MCP)`.
- **§ Components** has one row per frame: group, frame name, `<dir>/index.html`, cached.
- After § Components, add `## Figma`: source URL, version, tier, and the fonts the app must load.

**Freshness.** Re-run the same pull. When the version is unchanged, it prints
`up to date — 1 call` and nothing is rewritten. Otherwise it rewrites the frames. Diff the new
digests against the manifest's, and report the added, changed and removed frames and any token
whose value changed.

## Import — mcp tier

1. Call `get_metadata` on the URL's node (or the file) to list the frames. The selection and cap
   follow § URLs.
2. For each frame:
   1. `get_screenshot` → its URL →
      `ck-lite-replicate figma fetch "<url>" --out "$DS/cards/<page>/<frame>/frame.png" --width <frame width>`.
      The engine scales a 2× or 3× render down to 1× and fetches only from Figma's own hosts.
   2. `get_design_context` → its output saved to `<dir>/context.md`. When the harness saved the
      output to a file, copy that file; never retype or reflow it.
   3. Each asset URL `context.md` lists → `figma fetch` into `$DS/cards/assets/`. Record each
      URL → path pair in `<dir>/assets.md`; `context.md` itself is never edited.
   4. `get_variable_defs` → tokens.
3. Write `cards/figma.json` with `source`, `fileKey`, `fileName`, `tier: "mcp"` and `frames[]`.
   Each frame has `id`, `name`, `page`, `kind`, `dir`, `width` and `height`. Then write
   `manifest.json` (`figmaTier: "mcp"`, `projectUpdatedAt: null`) and `index.md` as in the exact
   tier.

The mcp tier has no version, so every refresh refetches every frame and rewrites a file only
when its digest changed.

## Fidelity loop on a Figma card

Everything in [§ Design fidelity loop](design-system.md#design-fidelity-loop) applies, except the
following.

- **Step 0, fonts.** There is no card shot to lend fonts to. `spec.md`'s `Fonts:` line lists
  every face the app must load. A missing face shows up as a text difference.
- **Step 1, viewport.** Use the frame's `viewport` from `figma.json`, which is the size of `frame.png`
  (Figma rounds a fractional frame like 526.33 × 2327.16 when it renders). When it is absent, read
  the PNG's size with `file frame.png`. Then pass `--viewport <width>x<height>`.
- **Step 2, reference.** There is no shot to take, because Figma's render is the reference:

  ```bash
  cp "$DS/cards/screens/settings/frame.png" "$OUT/settings-card-400x300.png"
  ```

- **Step 4.** Shoot the app with `--out "$OUT/settings-app" --viewport 400x300`, then diff
  `settings-card-400x300.png` against `settings-app-400x300.png` into
  `settings-400x300-diff.png`. With these names, the preview pairs the shots.
- **The diff floor.** A pixel-exact port still diffs about 0.5–1.5 % from anti-aliasing. The
  verdict is the list of differences, never the percentage.

**What "the card is the spec" means for a Figma card**
([§ Fidelity rules](design-system.md#fidelity-rules)):

- **Exact tier.** The spec is `spec.md`.
  - Build the element tree as the layer tree, in the same order.
  - Port every declaration exactly as written: flex for auto-layout, exact px, colors,
    radii, shadows, strokes.
  - Use each SVG and image asset file as it is — never an icon-library substitute, never
    redrawn.
  - The `.f…` class names belong to the rebuild; the app is free to name its own classes.
- **MCP tier.** The spec is `context.md`. Keep every value it holds, translate its Tailwind
  classes to the project's stack, and never round a value.

## Create in Figma

When the user wants the design made in Figma, write the brief as usual, then pick the path:

- **The official Figma plugin is enabled** (its `figma:figma-generate-design` skill is listed)
  and its MCP is connected → offer **Draw it in Figma now** (Recommended):
  1. Invoke `figma:figma-create-new-file` to create a new Design file in the user's drafts.
  2. Invoke `figma:figma-generate-design` with the brief as the screens to build: one frame per
     brief screen, with every state the brief lists, using the library the user names (or
     none).
  3. Link the file URL it returns (§ Import). The user may edit the file in Figma first;
     a later link or refresh picks up their edits.
- **The plugin is absent** → print the setup, which the user runs:

  ```bash
  claude plugin install figma@claude-plugins-official
  ```

  then `/plugin` → figma → sign in. Or they design the brief in a Figma Design file themselves,
  by hand or with Figma's AI. Either way, they hand back the frame or page URL:
  `/ck-code-lite:design <figma URL>`.

The official plugin's `figma-design-to-code` skill adapts a design to existing components.
Builds never use it: they port from the cache under § Fidelity rules.

## RULES

- **Never ask for, type, echo, log or store the Figma token** — the user saves it (§ Token setup).
- **Never write to a Figma file the user linked.** The only Figma write is § Create in Figma,
  into a new file, on the user's request.
- **Never approximate a Figma value** — a value `spec.md` or `context.md` does not hold is a gap
  to report, never a guess.
- **Never import a Make, FigJam, Slides or Sites file** — it has no design layers.
- **Never substitute an icon or image** — the cached SVG or image file is the asset.
- **Never call the Figma API or the Figma MCP from `build`** — the committed cache is the only
  source during a build.
- **Commit `frame.png` and every asset** — the reference must survive offline. Fidelity shots
  stay in the git dir.
