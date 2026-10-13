# Plugin redirect — a lite skill in a full ck-code project

Read by `start`, `design`, `build` and `ship` when their Phase 0 plugin guard finds a full
ck-code project. ck-code's state (stories, epics, the layout stamp) is something ck-code-lite
cannot read or keep in step, so the skill hands the request to its ck-code counterpart
instead of running.

## When it applies

The guard injects `ls -d tasks/VERSION.md docs/architecture tasks/PLAN.md`. The project is
ck-code's when the output lists `tasks/VERSION.md` (ck-code's layout stamp), or lists
`docs/architecture` (its feature docs) **without** `tasks/PLAN.md`. Anything else is lite's
own — continue. A lite plan beside an unstamped `docs/architecture/` stays lite's: ck-code
reads that same project as lite (`tasks/PLAN.md` with no stamp) and redirects here, so the
two guards are disjoint and can never bounce a request between them. Both plugins' mods use
this same rule (`isLiteLayout`, in `hooks/mod/logic.ts`), so the mods and the guards agree.

## Redirect

Before any read, write or command, print one line, then call
`Skill({ skill: "ck-code:<skill>", args: "<args>" })` with no question — the user's command
is the consent — and end the lite skill once it returns:

```
↪ ck-code project — running /ck-code:<skill> <args>
```

Each skill's Phase 0 names its own `<skill>` and `<args>`. An argument with no ck-code meaning
(a `T-NN`, `--waves`) is dropped, and the `↪` line says so:
`(T-NN ids are lite only — dropped)`. `--auto` has one — ck-code's `build` runs unattended
too — and is carried over to `ck-code:build`.

## BLOCK — when there is nothing to redirect to

Print, then stop with no hand-off, when the `Skill` call fails (ck-code is not installed), or
when this lite skill was itself started by a ck-code redirect (the previous step of this turn
was a `↪ … running /ck-code-lite:…` line):

```
⛔ This is a ck-code project, not a ck-code-lite one.
   /ck-code-lite:<skill> would write lite state beside ck-code's stories.
   Use /ck-code:<skill> <args> instead.
```

When the `Skill` call failed, add `Install it: /plugin install ck-code@ck-marketplace`.

## Rules

- **Never redirect twice** — a skill reached by a redirect from ck-code BLOCKs instead of
  redirecting back.
- **Never read or write project state before the redirect** — it runs first, in Phase 0.
- **Never ask before redirecting** — the user typed the command; asking turns a typo into
  a round trip.
