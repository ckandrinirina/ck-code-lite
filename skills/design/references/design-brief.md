# Claude Design Brief — Template & Authoring Rules

> Read by `design` BRIEF mode only. Produces `docs/design-brief.md`: one self-contained prompt
> the user pastes into [claude.ai/design](https://claude.ai/design) to build the project's
> design system in a single pass.

The brief has three jobs:

1. **Describe the product precisely enough that the first design is the right one** — real
   screens, real content, every state a user will actually hit. A vague brief buys a generic
   design and three rounds of revision.
2. **Leave nothing for the design tool to guess** — every open point is either decided from
   the project or asked as an explicit question in § 9.
3. **Make the result machine-readable for ck-code-lite** — § 8 makes the foundations CSS
   custom properties under the group names [design-system.md](../../../references/design-system.md)
   extracts, so linking yields zero `⚠️` tokens and `build` ports components verbatim.

## Authoring rules

- **Derive every fact from the project** — the confirmed description, `docs/ARCHITECTURE.md`,
  the plan's surface tasks, a spec file. Never introduce a product decision nobody made; an open
  point goes to § 9.
- **Name the screens the project actually has** — the plan's surface tasks and the
  description's flows. Three real screens beat twelve invented ones.
- **Real content, never lorem ipsum.** Sample rows, labels, names, numbers and error messages
  in the product's own domain. Realistic content is what exposes a layout that breaks on a long
  name or an empty list.
- **Every state, per screen** — empty, loading, error, populated, overflow. The states a design
  forgets are the ones `build` then improvises.
- **Plain product language in §§ 1–7** — no file paths, no framework names, no plugin
  vocabulary. The reader is a designer.
- **The user's language** for §§ 1–7 and § 9; § 8 stays in English — it names literal group
  labels and CSS syntax that must not be translated.
- **Fixed means fixed.** A brand color, typeface, logo or reference product the user named is
  stated as a constraint, never as a suggestion.

## Template

Write the file exactly in this shape. Omit § 6 when nothing in the product shows tabular or
list data; omit § 9 when nothing is open. Everything else is always present.

---

```markdown
# Design brief — <Product name>

Build a **design system project** for <Product name>: foundations, every component listed
below, and one card per key screen composed from those components. Follow § 8 exactly — the
system is consumed directly by the product's codebase.

<One paragraph: what the product is, who uses it, and the one thing it must make easy.>

## 1. Product & audience

- **Product** — <name, one-line description>
- **Primary users** — <who, their context of use, their expertise>
- **Core job** — <the single task the product exists for>
- **Tone** — <3–5 adjectives, e.g. "calm, precise, data-dense, unfussy">
- **Reference feel** — <a product the user named, or "none named">

## 2. Platform & layout

- **Platform** — <web / mobile web / iOS / Android / desktop>
- **Breakpoints** — <the sizes that matter, e.g. "phone 375, tablet 768, desktop 1280">
- **Navigation model** — <top bar / sidebar / tab bar / single page>
- **Input** — <touch, mouse, keyboard-first>

## 3. Brand direction

<Fixed elements stated as constraints; open ones stated as intent with their constraints.
Never an invented palette.>

| Element        | Direction                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Color          | <fixed values, or intent: "one calm accent, generous neutral range">      |
| Typography     | <fixed family, or intent: "one sans for UI, tabular figures for numbers"> |
| Density        | <compact / comfortable / spacious — and why>                              |
| Shape          | <radius feel: sharp / soft / pill>                                        |
| Motion         | <how much, and where it is forbidden>                                     |
| Dark mode      | <required / not required>                                                 |
| Logo & imagery | <exists and fixed / to design / none>                                     |

## 4. Screens

One block per screen, in the order a user meets them.

### <Screen name>

- **Purpose** — <what the user accomplishes here>
- **Content** — <the elements on it, top to bottom, with real sample content>
- **States** — empty: <…> · loading: <…> · error: <…> · populated: <…>
- **Actions** — <what the user can do, and where each leads>

## 5. Key flows

<2–4 flows, each a numbered path across screens: "1. Land on Home → 2. Tap Add → 3. Fill the
form → 4. See the new item highlighted in the list". Name the feedback at each step.>

## 6. Data & content realism

<What the heaviest screen holds and how much of it; the longest realistic strings; missing
values; numbers, dates and currencies and their formats; right-to-left or multi-language needs.>

## 7. Components needed

Grouped. Each line names the component and every variant and state the screens above use.

- **Actions** — <buttons: variants, sizes; default, hover, focus, disabled, loading>
- **Forms** — <inputs, selects, toggles; helper text, error, disabled>
- **Navigation** — <bars, tabs, breadcrumbs; active and inactive>
- **Feedback** — <toasts, banners, empty states, skeletons, error panels>
- **Data display** — <lists, tables, cards, badges, charts>
- **Overlays** — <modals, drawers, menus, tooltips>

**Accessibility** — text contrast at least WCAG AA (4.5:1, 3:1 for large text), a visible
focus style on every interactive component, touch targets at least 44 px, and no meaning
carried by color alone.

## 8. Output requirements

These conventions let the codebase consume the system directly. Please follow them exactly.

1. **Foundations as CSS custom properties** declared on `:root` — `--color-…`, `--font-…`,
   `--text-…`, `--space-…`, `--radius-…`, `--shadow-…`. Components reference those properties;
   no literal color, size, radius or shadow value inside a component's CSS.
2. **One foundations card per group, with these exact group labels:** `Type`, `Colors`,
   `Spacing`, `Radii`, `Shadows`, `Brand`. Omit an empty group rather than renaming it.
3. **One card per component**, every variant and state side by side in that card, grouped under
   `Actions`, `Forms`, `Navigation`, `Feedback`, `Data display` or `Overlays`.
4. **One card per screen in § 4**, grouped under `Screens`, built only from the component
   cards — no one-off styles.
5. **Self-contained cards** — each card's HTML carries its own styles and depends on no external
   stylesheet, script or font CDN. Web-safe stacks or embedded fonts only.
6. **Semantic, stable class names** on every element — markup and class names are copied
   verbatim into the codebase, so they are part of the deliverable.
7. **Both themes** when § 3 requires dark mode — dark values as overrides of the same custom
   properties, never a parallel set of names.

## 9. Open questions

<Only what the project left undecided and the design depends on. One bullet each, answerable
inline. The designer answers them in the design rather than guessing.>
```

---

The hand-back line (`/ck-code-lite:design <url>`) is printed by the skill, never written into
the brief — it would be pasted into the design tool as noise.
