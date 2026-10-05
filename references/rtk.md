# RTK — token-optimized command output

[RTK](https://github.com/ckandrinirina/rtk) is an optional CLI proxy that filters command
output before it reaches context. A full test suite comes back as its failing cases alone.

ck-code-lite never requires it. Every command works without it; the plugin's only
obligation is to write command forms RTK's hook recognizes.

## Install

```bash
rtk init      # registers a PreToolUse hook on Bash in ~/.claude/settings.json
rtk gain      # tokens saved so far
```

## The hook does the rewriting — never write `rtk` yourself

The hook rewrites the command on its way to the shell: the skill writes `npm run test`,
the shell runs `rtk test`. A hardcoded `rtk` in a skill would break every user who has
not installed it.

## Command forms that matter

| Write this | Not this | Why |
|---|---|---|
| `npm run test`, `pnpm run test` | `npm test`, `pnpm test` | exact aliases, but only the long form is filtered |
| `npm run build`, `pnpm run build` | `pnpm build` | same |
| a bare command | `npm run test \| tail -20` | a command feeding a pipe is left unfiltered — and RTK already returns failures only |

`cargo test`, `pytest`, `go test ./...`, `ctest`, `bundle exec rspec`,
`vendor/bin/phpunit`, `ruff check .`, `npx tsc --noEmit`, `npx eslint .` and all `git` /
`gh` commands are already recognized as written in [stack-commands.md](stack-commands.md).

`yarn` has no RTK filter at all — a yarn project simply gets no test savings.

Check any command's rewrite with `rtk hook check "<command>"`.

## Where lite gains most

Full test, build and lint runs go through `ck-lite-qa`, which already keeps their output in a
log and prints one line per command — RTK has nothing left to filter there. Its saving is in
the commands run directly — `git` and `gh`.

## Rules

- **Never write an `rtk` prefix** into a skill or reference command — the hook does it.
- **Always write `<runner> run <script>`** — `pnpm run test`, never `pnpm test`.
- **Never pipe a stack command** — the piped command is skipped. `&&` chains are fine.
- **Never make RTK a prerequisite** — no skill blocks or changes behaviour without it.
