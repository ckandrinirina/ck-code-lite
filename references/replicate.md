# Replicate — Shared Contract

Owns replicating an existing app: what `ck-lite-replicate` captures from each kind of software,
the pack it leaves in `docs/replica/<slug>/`, the `REPLICA.md` spec distilled from it, how a plan
maps its screens to tasks, and the fidelity loop a UI task runs against them.

Read by `design` (`replicate` mode writes the pack), `start` (screens → tasks), and `build`
(inline and the `task-builder` agent). Those files say *when*; this file says *how*.

The pack is **identical to ck-code's** `docs/replica/` — same path, same files — so
`/ck-code:migrate` leaves it where it is, and `bin/ck-lite-replicate` is byte-identical to
ck-code's `scripts/ck-replicate.mjs`. Never diverge from either without changing both.

## The off switch

No `docs/replica/` directory → no touchpoint does anything. It is created only by an explicit
`/ck-code-lite:design replicate …` run. Off-ramp: delete the folder.

## Sources

`ck-lite-replicate` (in `bin/`) has one command per kind of software. Run `ck-lite-replicate doctor`
first for the web and Electron kinds — they need Node ≥ 22 and a Chrome-family browser
(`CK_CHROME=/path` overrides). Every command writes into `--out docs/replica/<slug>`.

| The user gives | Command | What it yields |
| --- | --- | --- |
| A website or web app URL | `ck-lite-replicate capture <url> --out <dir> [--pages 12] [--explore 8]` | desktop 1440 + mobile 390 full-page screenshots per page, computed tokens, CSS variables, breakpoints, fonts, page outlines, forms, tables, repeated components, XHR/fetch endpoints with response shapes → `summary.md`, `capture.json` |
| …behind a sign-in | `ck-lite-replicate login <url>` once (the user signs in, closes the window), then `capture … --profile` | the same, signed in |
| A single-page app routed by buttons | add `--explore N` | nav items clicked, each new screen kept |
| An Electron desktop app (`.app`, or its executable) | `ck-lite-replicate electron <app> --out <dir> [--explore 10]` — the user quits the app first | its real DOM: every window plus each nav screen, tokens, packaged HTML/CSS/locales under `source/`, `package.json` libraries |
| A native macOS app | `ck-lite-replicate mac "<App>" --out <dir> --label "<screen>"`, once per screen | first run: `app.md` (bundle facts, toolkit, every shipped UI string, `Assets.car` named colors); each run: the window screenshot + accessibility tree in `snaps.md`, menu bar in `menus.md` |
| An Android app | `ck-lite-replicate android --out <dir> --label "<screen>"`, once per screen | adb screenshot + view hierarchy (texts, ids, tap targets, bounds) in `snaps.md` |
| An iOS app | `ck-lite-replicate ios --out <dir> --label "<screen>"` in a booted Simulator | screenshot only in `snaps.md` |
| A command-line tool | `ck-lite-replicate cli "<command>" --out <dir>` | the full `--help` tree in `cli.md` — it runs `--help` and nothing else, never `-h` or a bare `help` |
| A source tree (path) | no command — one `ck-code-lite:context-scout` dispatch: routes/screens, components, theme or Tailwind config, i18n files | the brief it returns |
| Only screenshots or a video, or Windows/Linux native software | no command — copy the images into `<dir>/screens/` | what the images show |

Snap-per-screen kinds (`mac`, `android`, `ios`) are user-driven: the user opens a screen, says
its name, Claude snaps it; repeat until they say done. One `AskUserQuestion` per screen at most,
with **Snapped — next screen** / **Done** — never a prompt per field.

`mac` without the terminal's Accessibility permission still saves the screenshot and says so;
an empty-looking screenshot means Screen Recording is missing. Both are System Settings ›
Privacy & Security grants the user makes — never script them.

Chrome cannot start inside Claude Code's sandbox (it fails to lock its profile): run the web
and Electron commands with the sandbox off for that one call — the user's own approval prompt
decides.

When a command fails, report its one-line reason and continue with the next-best row (a URL
behind a wall → `login`; Electron with its debug port stripped → `mac` snaps). Never install a
browser, adb, or Xcode to make a row work.

## Copy policy

Asked once per replica, in the run's single question round, and recorded in `REPLICA.md`:

- **Own app** — the user owns it or is authorized to copy it (a rewrite, a port, a migration):
  copy text, icons, images and brand as captured.
- **Reference only** — someone else's product: replicate layout, flows, interaction patterns
  and the token *system* (scale, spacing, radii, roles), but never its logo, product name,
  trademarks, illustrations, photos or written copy. Those become placeholders named by role
  (`<Logo>`, `<Hero illustration>`, real-sounding but original text). Colors keep their roles
  with the brand hue swapped unless the user supplies their own.

Never capture a page or app the user has not named, and never try to get around a sign-in,
paywall, CAPTCHA or bot block — a wall is a limitation, written down as one.

## Pack layout

```
docs/replica/<slug>/
  REPLICA.md        # the spec — distilled by Claude; the only file a plan or task reads first
  summary.md        # capture digest (web, Electron) — tokens, outlines, API table
  capture.json      # full capture, incl. each page's visible text
  app.md menus.md   # macOS static facts and menu bar
  snaps.md          # snap-per-screen log (mac, android, ios)
  cli.md            # CLI help tree
  screens/          # reference screenshots — git-ignored
  source/           # extracted HTML/CSS/locales (Electron) — git-ignored
  fidelity/         # shots and diffs from the fidelity loop — git-ignored
```

`<slug>` is the product name, kebab-case. The text files are committed — worktrees inherit them.
Images are not: `design replicate` adds `docs/replica/*/screens/`, `docs/replica/*/source/` and
`docs/replica/*/fidelity/` to `.gitignore`, and a worktree reads screenshots by the **main
checkout's absolute path**. A clone without them re-runs the capture command written in
`REPLICA.md`'s header.

## REPLICA.md

Written by Claude from the raw files and the screenshots — never by the script. Template:

````markdown
# Replica — <Product>

Source: <url | app | command> · kind <web|electron|mac|android|ios|cli|source|screens> · captured <date>
Policy: <own app | reference only> · Fidelity: <pixel | structural>
Recapture: `ck-lite-replicate <exact command used>`

## Product
<one paragraph: what it does, for whom, the core job — as the captured screens show it>

## Screens
| ID | Screen | Reached by | Purpose | Reference | States seen |
| --- | --- | --- | --- | --- | --- |
| S-01 | Dashboard | `/` | … | `screens/01-home-desktop.png`, `…-mobile.png` | populated |

## Navigation and flows
- <flow>: S-01 → S-03 → S-04 — <what the user accomplishes>

## Tokens
| Role | Value | Evidence |
| --- | --- | --- |
| background / surface / text / muted / border / accent / danger … | `#121212` | backgrounds ×2316 |
Typography: <family stack>; scale <display 56/56 450 -3.36 · h2 24/32 · body 14/20 · caption 11/20 caps>
Spacing scale · radii · shadows · breakpoints · container widths — one line each.

## Components
| Component | Seen on | Anatomy | Variants / states |
| --- | --- | --- | --- |

## Content
<own app: real copy per screen, from capture.json / app.md / snaps.md. Reference only: the
placeholder rule applied, with one example per kind>

## Data
| Entity | Fields (from API shapes, forms, tables) | Seen on |
| --- | --- | --- |

## Behaviour
<what is observable: search, filters, sorting, pagination, auth, offline, keyboard shortcuts,
menus (`menus.md`), CLI commands (`cli.md`)>

## Gaps
- <every state not captured — hover, empty, error, loading, modals, permissions — as a question
  or a stated assumption marked ⚠️>
````

Procedure: read the raw `.md` files first — `summary.md` / `app.md` / `snaps.md` / `cli.md`,
whichever exist — then `Read` each screenshot. Up to 10 screenshots read in this context; more
than 10 → split them into batches of 6 for `general-purpose` sub-agents (model `sonnet`, one
message, all parallel) that each return, per image: the screen's layout regions, components
with their anatomy, visible states and copy. A token is the captured value, never a guess from
the picture: when the screenshot and `summary.md` disagree, `summary.md` wins and the row is
flagged ⚠️. Screen IDs are stable once written — a recapture appends `S-NN`, never renumbers.

## Planning from a replica

`REPLICA.md` is a spec: `/ck-code-lite:start docs/replica/<slug>/REPLICA.md` reads it like any
other, and `docs/ARCHITECTURE.md`'s `## Design` section gains the line
`- Replica: <slug> — docs/replica/<slug>/REPLICA.md (<kind>, <policy>)`. Every screen becomes
at least one task whose acceptance criteria name it —
`- [ ] Matches S-03 (Settings) at desktop and mobile, per docs/replica/<slug>/REPLICA.md`.
A screen with no task is a planning gap, reported in the plan summary. Tokens and shared
components come first: the plan's first UI task materializes the `## Tokens` table into the
stack's token file, and later tasks use it.

## Fidelity loop

Runs inside a UI task whose acceptance criteria cite an `S-NN`, after the closing run and before QA.
It is a check, not a gate: findings are fixed in one pass, then recorded.

1. **Reference.** `Read` the cited screen's row and its screenshots from the main checkout —
   `MAIN=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)`, then
   `$MAIN/docs/replica/<slug>/screens/…` (a worktree has no screenshots of its own).
2. **Run.** Web stack with a dev command in the architecture docs → start it in the background
   (`run_in_background`), wait for its port, never in the foreground. Not a web stack, or no
   dev command → skip to step 4 and compare against the reference by reading the code's
   rendered structure; say `fidelity: visual review only`.
3. **Shoot and diff**, at the reference's viewport:

   ```bash
   ck-lite-replicate shot http://localhost:5173/settings --out docs/replica/acme/fidelity/S-03 --viewport both
   ck-lite-replicate diff "$MAIN/docs/replica/acme/screens/03-settings-desktop.png" docs/replica/acme/fidelity/S-03-desktop.png --out docs/replica/acme/fidelity/S-03-desktop-diff.png
   ```

   `diff` prints a mismatch % and the height bands over 5 %. Under **reference only**, copy and
   imagery differ by design — read the bands as layout signals, not failures.
4. **Compare.** `Read` the reference, the shot and the diff. List each visible difference in
   layout, spacing, type, color, radius, iconography or state — concrete (`header 64 px, ref
   56 px`), never "looks off".
5. **Fix once.** Correct every listed difference through tokens and components, never with
   one-off literals; repeat the closing run; shoot and diff once more.
6. **Record** one line — inline, `ck-lite note T-NN "<line>"`; a `task-builder` returns it
   as its verdict's `fidelity:` field and the orchestrator notes it:
   `Fidelity S-03: 18.4 % → 4.1 % (desktop), 9.0 % → 3.2 % (mobile); remaining: <diffs or none>`.

Stop the dev server before returning. Never loop past the one fix pass — what remains is
recorded for the user, not chased. QA (`qa-validator`) receives `replica: S-NN`; a cited screen
with no recorded line is a finding.

## RULES

- **Never create `docs/replica/`** outside an explicit `design replicate` run.
- **Never copy a non-owned product's logo, name, imagery or copy** — reference only means
  placeholders.
- **Never bypass a sign-in, paywall or bot block** — record it as a limitation.
- **Never commit screenshots, extracted sources or fidelity shots** — they are git-ignored.
- **Never invent a token** — a value in `## Tokens` is captured, or flagged ⚠️.
- **Never install a browser, adb or Xcode** to make a capture work.
- **Never run the fidelity loop more than once per task**, and never in the foreground.
