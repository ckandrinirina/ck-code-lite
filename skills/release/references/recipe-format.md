# Release recipe — `docs/RELEASE.md`

How one project releases, written once and followed by every release after it. Read by
`/ck-code:release` and `/ck-code-lite:release`; this file is identical in both plugins, so
keep both copies in step. The recipe is committed, so every machine and every worktree
releases the same way.

## Format

One `Key: value` line per setting, in this order. A key that does not apply says `none`.
Values use `X.Y.Z` for the new version; the skill fills it in.

```markdown
# Release

<!-- Followed by the release skill. Change it when the release process changes. -->

Version files: <file (how)>, <file (how)>, …
Changelog: <path> | none
Check: <command that proves the bump is consistent> | none
Base: <branch the release PR targets and the tag is cut from>
Branch: chore/release-X.Y.Z
Merge: auto | ask
Tag: vX.Y.Z
Build: dispatch <owner/repo> <workflow-file> -f <input>=vX.Y.Z | on-tag <owner/repo> <workflow-file> | none
Verify: <command that shows the published release> | none
Assets: <expected file names, X.Y.Z filled in> | none
Manual: <step only the user can do> | none
Expected failures: <run that fails on purpose, and why> | none
```

| Key | Meaning |
|---|---|
| `Version files` | Every tracked file that pins the version, with how to change it when it is not a plain string swap (`npm version X.Y.Z --no-git-tag-version`, `versionCode = M×10000 + m×100 + p`) |
| `Check` | Runs on the release branch before the PR. A failure stops the release before anything is pushed |
| `Merge` | `auto` — the skill merges the release PR (`gh pr merge --merge`). `ask` — the user merges it, the skill asks and then checks the PR state |
| `Build` | `dispatch` — the skill starts a workflow by hand after the tag is pushed (a public build repo, a manual-only workflow). `on-tag` — pushing the tag starts it. `none` — no CI; the skill runs `gh release create vX.Y.Z` in this repo |
| `Verify` | Proves the release is live, for example `gh release view vX.Y.Z -R <owner/repo> --json assets -q '.assets[].name'` |
| `Manual` | Steps only a person can do, such as a store upload. Asked once at the end, never waited on |
| `Expected failures` | Runs that fail on every release on purpose. Never reported as the blocker |

## Worked example — a private source repo built in a public repo

The source repo is private and has no Actions minutes left, so its workflows fail on budget.
Installers are built for free in a public repo that checks out the private one with a read-only
token, but only when it is started by hand:

```markdown
# Release

Version files: package.json and package-lock.json (npm version X.Y.Z --no-git-tag-version), android/app/build.gradle (versionName X.Y.Z, versionCode = M×10000 + m×100 + p), ios/App/App.xcodeproj/project.pbxproj (MARKETING_VERSION, both configurations), test/release/checkVersion.test.ts
Changelog: CHANGELOG.md
Check: npx vitest run test/release
Base: main
Branch: chore/release-X.Y.Z
Merge: auto
Tag: vX.Y.Z
Build: dispatch ckandrinirina/ck-tiona-releases release.yml -f tag=vX.Y.Z
Verify: gh release view vX.Y.Z -R ckandrinirina/ck-tiona-releases --json assets -q '.assets[].name'
Assets: CK-Tiona-X.Y.Z-arm64.dmg, CK-Tiona-X.Y.Z-x64.dmg, CK-Tiona-Setup-X.Y.Z.exe, CK-Tiona-X.Y.Z.apk, latest.json
Manual: none
Expected failures: the source repo's Mobile workflow, on every tag (no Actions budget in the private repo)
```

Without this recipe, a release tags the private repo and then waits on a build that never runs.
