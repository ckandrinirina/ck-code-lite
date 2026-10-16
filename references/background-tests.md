# Background tests — no test run takes the user's focus

An e2e suite that opens a browser or an app window in front of the user steals focus while
they work in another app: keystrokes land in the test window, and a click can break the run.
Every test ck-code-lite runs is a **background run**. A window that never shows, or shows without
taking focus, is the only acceptable kind.

## The contract

1. **Every QA run goes through `ck-lite-qa`**, which runs each command with `E2E_HEADLESS=1`
   and `PWDEBUG` unset. A suite converted below reads the variable and keeps its window hidden.
2. **Before any task code, `ck-lite-headless` lists the foreground setups**, one
   `FOREGROUND <file>:<line> <kind> — <text>` line each. `build` converts every hit **at once,
   without asking**:
   - **one task** — inline, on the task branch, before RED. The edits stay uncommitted like the
     rest of the task: `ck-lite files T-NN <paths>` records them, `ck-lite note T-NN "e2e moved
     to the background: <paths>"` says why, and `ship` commits them.
   - **PARALLEL MODE** — one conversion agent on `$TARGET` before the first wave, committed as
     `test(e2e): run e2e suites in the background`, because a worktree only sees committed
     work ([parallel-mode.md § P1](../skills/build/references/parallel-mode.md#p1-freeze-the-target)).
3. **Every new e2e test is written background-first**, with the recipes below. A headed
   launch is a QA failure, never a style note.
4. **Opt-out is the user's.** A line carrying `ck-headless: allow` is skipped by the detector.
   Never write that marker yourself.

## Conversions

| Kind | Found | Convert to |
|---|---|---|
| `headed-browser` | `headless: false` in a Playwright, Puppeteer or WebdriverIO config or launch | delete the option, since Playwright and Puppeteer default to headless, or set `headless: true` |
| `headed-browser` | `headless=False` (Python) | `headless=True` |
| `headed-browser` | `devtools: true` | delete it, because DevTools forces a headed browser |
| `headed-command` | `--headed`, `--ui`, `--debug`, `PWDEBUG=1` or `HEADED=1` in a test script | drop it from the script. A developer who wants to watch passes the flag by hand (`npx playwright test --headed`) |
| `headed-command` | `cypress open` as a test command | `cypress run`, which is headless by default |
| `electron-window`, `electron-launch` | an Electron e2e suite (`_electron.launch`) | the two edits below |

**Electron.** Playwright's `headless` never applies to Electron, so the app keeps its own
window hidden. `electron.launch` passes the runner's environment to the app, so one line in
the Playwright config covers every launch, manual runs included:

```ts
// playwright.config.ts
process.env.E2E_HEADLESS ??= '1'   // e2e runs never open the app window in front
```

The app's main process reads it. Only the e2e run sets it, so `npm run dev` and the packaged
app show their window as before:

```ts
const background = process.env.E2E_HEADLESS === '1'
if (background) app.dock?.hide()   // macOS: no Dock icon, the app never activates

const win = new BrowserWindow({
  show: false,
  paintWhenInitiallyHidden: true,   // a hidden window still renders, so tests can read it
  webPreferences: { backgroundThrottling: !background /* , …existing options */ }
})
win.once('ready-to-show', () => { if (!background) win.show() })
```

Merge these into the existing `BrowserWindow` options and `ready-to-show` handler, never
beside them. A spec that needs a shown window, such as a native focus or blur test, uses
`win.showInactive()` behind the same flag: the window shows but never takes focus.

**Other desktop shells** (Tauri, a native window under WebDriver): the detector does not see
them. Apply the same rule by hand, with a hidden or inactive window behind `E2E_HEADLESS`.
On a Linux runner without a display, wrap the e2e command in `xvfb-run -a`.

## Verify the conversion

Re-run `ck-lite-headless`, which must print `ck-lite-headless: OK`, then run the e2e suite once through
`ck-lite-qa`. It must still pass. A suite that passes headed and fails hidden needs the
`showInactive()` fallback for that spec. Never go back to a foreground window.
