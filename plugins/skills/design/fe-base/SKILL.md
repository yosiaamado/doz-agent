---
name: fe-base
description: Use when building or fixing how something looks — a new page, dashboard, landing page or component — when choosing colors, sizes or spacing, or when the user says it looks messy, cramped or like a template ("bikin bagus", "kurang rapi"). For code structure, see frontend-patterns.
---

# FE Base — UI design taste

The code rules live in `frontend-patterns`. This file is about **taste**: why one screen looks expensive and another looks like a free template, even with identical content.

**The one sentence behind all of it:** good design isn't the most decorated, it's the fastest to read. Hierarchy is built from **space, size, and font weight** — not from lines, boxes, shadows, and color.

## 1. The five decisions that determine the outcome

Before writing a component, lock these five down. Put them in a comment or a token file; don't guess them per component.

| Decision | Safe default |
|---|---|
| **Spacing scale** | Multiples of 4: `4 8 12 16 24 32 48 64`. Nothing off the scale |
| **Radius scale** | `6px` small controls · `12px` cards (`16–24px` on a gapped canvas, §5) · `999px` pills/avatars. 3 values max per product |
| **Palette** | 1 accent color + a graded neutral grey + 3 semantics (success/warning/danger) |
| **Typography** | 1 font family (2 max), 3 weights: 400 / 500–600 / 700 |
| **Density** | Pick one: *comfortable* (table rows 48–56px) or *compact* (36–40px). Consistent across the whole app |

No brand or design system yet → read [references/design-database.md](references/design-database.md) and query the bundled database for a product-appropriate palette and font pairing, then cut its output down to these five.

## 2. Layout & space

- **Whitespace is a feature, not leftovers.** If a screen feels cramped, remove elements or add spacing — don't shrink the font.
- **Card padding 20–24px** on desktop, 16px on mobile. A card with 8px padding always looks cheap.
- **Space between blocks > space within a block.** A label sits 4px from its number; card to card 16–24px; section to section 32–48px. This is what tells the eye what belongs to what, with no divider lines.
- **A 12-column grid**, 24px gutters. Long body text is capped at **60–75 characters** per line.
- **One page = one purpose.** The most important element gets the top-left position and the largest size. If everything stands out, nothing does.
- **A long page beats a dense page.** Scrolling is cheap, confusion is expensive.

## 3. Typography

A scale you can use straight away (ratio ~1.25):

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display / large figure | 32–40px | 600–700 | For one headline number only |
| Page title | 24–28px | 600 | |
| Card / section title | 16–18px | 600 | |
| Body | 14–16px | 400 | `line-height` 1.5 |
| Labels & meta | 12–13px | 500 | Grey, `letter-spacing: .04em` + UPPERCASE is fine for an *eyebrow* |

- **Numbers use `font-variant-numeric: tabular-nums`.** Without it, columns of figures in tables and KPIs look wobbly.
- **On a headline figure, set decimals one step smaller and lighter** (`$4,857` `.16`): the eye reads the magnitude first.
- **Never use more than 3 font sizes in one card.** Usually enough: a small label, a big number, a small caption.
- **Weight, not size, for subtle emphasis.** Go 400 → 600 before you go bigger.
- Long text is left-aligned. Centre only 1–2 lines (a hero title, an empty state).
- Avoid grey text on grey: body copy at least around `#475569` on a light background.

## 4. Color

**The 60-30-10 formula:** 60% neutral (backgrounds & surfaces), 30% text, 10% accent. The accent is for **actions and indicators**, not decoration.

- **Layered neutrals, not lines everywhere.** Page background `#F7F8FA`, white cards, a 1px `#E5E7EB` border. That combination is far cleaner than white cards on white separated by heavy shadows.
- **One accent.** If you need to distinguish many categories (charts, tags), use shades of the accent + neutrals, not a rainbow.
- **Consistent semantics:** green = up/success, red = down/failure, yellow = needs attention, blue/accent = neutral information. Don't use red just because it looks nice.
- **One hero surface per view filled with the accent** (solid or gradient): a featured card, a welcome banner, a call-to-action. Everything else neutral. A second filled card halves the effect of both, and four multicoloured gradient cards is the tell-tale sign of a template.
- **Dark floating elements on a light page** for what sits above content: tooltips, popovers, a floating switcher pill. They read as a layer without a heavy shadow. One per region at most.
- **Color must never be the only carrier of meaning.** Always pair it with an icon, a sign, or text.
- **Contrast:** text 4.5:1, UI elements and icons 3:1. Check before you hand the work over.
- **Dark mode is not inverted colors.** Background `#0B0F14`–`#111827`, surfaces raised with lightness (not shadow), and accent colors desaturated so they don't glare.

## 5. Surfaces, borders & elevation

- **Pick one surface style per product:**
  - *Bordered* — canvas `#F7F8FA`, white cards, a 1px border + a very soft shadow (`0 1px 2px rgba(16,24,40,.06)`), 12px radius. For dense data apps and forms.
  - *Gapped* — light grey canvas, white cards with **no border and no shadow**, separated only by 12–16px gaps of canvas, 16–24px radius. For overview screens and dashboards; reads calmer and more premium.
  - Mixing the two on one screen looks accidental. Large dark shadows make either look dated.
- **Vary card sizes on a 12-column grid** (bento): spans of 3/4/5/6/8, a tall card beside two stacked short ones. A row of identical tiles reads generated.
- Raise the elevation only for things that genuinely float: dropdowns, popovers, modals, toasts.
- **Don't nest boxes.** A card inside a card inside a panel = three borders at once. Separate with space or a hairline instead.
- Keep radii consistent. A 6–8px button next to a 20px card looks accidental.
- **Boundaries stay visible on hover:** switch the background to the lightest grey; don't shift the layout.

## 6. Dashboards: the right anatomy

Single-component anatomy is here. Screen composition (shell, bento grid, hero card, premium chart patterns) and load/route/theme choreography are in `fe-dashboard`.

### KPI cards

The order is **label → number → change → context**:

```
TOTAL VISITS              ← label 12px, grey, uppercase optional
1.24M                     ← figure 32-36px, 600, tabular-nums
↗ +10%  vs last week      ← semantically coloured delta + comparison
```

- **A number with nothing to compare against is meaningless.** Always include a period or a target.
- One small icon, and only if it actually helps. A big coloured icon on every card = wasted space.
- Four KPIs is already a lot. If there are eight, nobody has decided what matters yet.

### Charts

- **Remove anything that doesn't explain:** heavy gridlines, dual axes, shadows, 3D effects, and legends far from the data.
- Series labels go **right next to the last point of the line/bar** where possible.
- The Y axis starts at zero for bar charts. Abbreviate figures (`1.2M`, `Rp 4.1M`).
- 5 series max in one chart. Beyond that, split it or use small multiples.
- Tooltips show the exact value + the period, and follow the cursor without covering the data.
- Sparklines for trends inside a table, full charts for analysis.

### Tables

- Text left-aligned, **numbers right-aligned with tabular-nums**, headers aligned with their column.
- Sticky headers, and a sticky identity column (name/ID) if the table is wide.
- Zebra striping is optional; thin horizontal rules are usually enough. **Avoid vertical rules.**
- Status uses a pill *badge* with a soft background (`bg` at 10% accent, full-colour text), not a block of solid color.
- Row actions: 2 visible buttons max, the rest behind a `⋯` menu. A destructive action must never sit next to a frequently used one.
- Provide the row count, visibly active filters, and pagination that states the range (`1–20 of 134`).

### Navigation

- The sidebar is grouped with small labels (`WORKSPACE`, `COMPONENTS`), and the active item is marked with a soft background + accent text, not just text color.
- 7±2 items max per group. Beyond that, group them or hide them behind a menu.
- Provide breadcrumbs for inner pages, and global search (`⌘K`) if there's a lot of data.

## 7. States are part of the design, not an add-on

- An **empty state** has one explanatory sentence + one primary action. Not just "No data".
- **Loading** uses a skeleton that mimics the shape of the content, not a spinner in the middle of the screen. For an action inside a button: change the label to the status, don't hide the button.
- **Errors** explain what failed and what can be done, with a retry button.
- **Success** is visible: a brief toast, or a change in the data you can see immediately. An action that gives no feedback feels broken.
- **First-run** differs from a normal empty state: show an example or dummy data so the user understands what it will look like.

## 8. Motion

- **120–200ms** for hover and small changes, **200–300ms** for panels entering/leaving. Slower than that feels heavy.
- `ease-out` for things entering, `ease-in` for things leaving.
- Animate only `transform` and `opacity`. Don't animate `width`, `height`, or `top`.
- Motion explains origin: a dropdown grows out of its trigger, a modal rises slightly, rather than popping into existence in the middle.
- Respect `prefers-reduced-motion: reduce`: final state immediately, cross-fade instead of slide — in JS-driven animation too, not only CSS.
- **Persistent chrome (sidebar, top nav, header) never re-animates on navigation.** Only the content region transitions; the active-tab indicator slides to the new item (one shared element carries the continuity).
- **Entrances run in reading order, once per mount:** surfaces first, then their text, then numbers and charts. Stagger groups (cards, sections) 40–60ms apart, not every element; whole screen ≤ ~1.2s; never block input. Refetches and filter changes don't replay it.
- **Exits are fast and flat:** opacity only, ≤150ms. Navigation must never wait on an exit.
- **A short `blur(6px)→0` with the fade** makes headings materialise rather than pop. Headings and short text only — blur is expensive on large surfaces.
- **Numbers that change tween from the old value** to the new one; only the first appearance counts up from 0.
- **Hover lift (`y: -4px` + deeper shadow) only on clickable cards.** On a static card it promises an action that isn't there.
- **Theme toggle:** a circular reveal from the toggle button (View Transitions API) feels deliberate; fall back to an instant switch.
- Exact timings and code for these: `fe-dashboard` §2–4 and its `references/recipes.md`.
- Anything the user can drag, swipe or throw follows `fe-native-feel` (springs, velocity, interruptibility) instead of these fixed durations.

## 9. The touches that make it look "expensive"

Pick **one or two**, not all of them:

- One element with character: an illustration, a product photo, or display typography in a single place (hero, empty state, featured card).
- A sentence written by a human: "Two new regions went live overnight" is far more alive than "Data updated". Same for dummy data: avatars with names and specific labels ("Q4 revenue", "Brainstorm 12:45"), never "Item 1".
- Micro-detail: a subtle hover, a clear focus ring, a number that animates up once on first appearance.
- Icon consistency: one set, one stroke weight, one size per context (16/20/24).
- Correct local formatting: `Rp 1.250.000`, `12 May 2026`, `14:30`, and consistent wording (don't mix "Submit" with "Save").

## 10. Anti-patterns (the free-template tells)

- Four multicoloured gradient KPI cards in a row.
- Five accent colors for no reason, a different one per card.
- Heavy shadows on everything, plus borders, plus a grey background.
- A big coloured icon on every card that adds no information.
- A card's title and its content sitting as far apart as the cards sit from each other.
- A table with full vertical rules and 28px-tall rows.
- A chart with an 8-colour legend in the corner that can't be matched to the data.
- Pale grey text on grey, "to keep it calm".
- A primary and a secondary button that are equally loud.
- Every corner rounded to 20px, inputs and tables included.
- A sidebar that slides in again on every click, or every card lifting on hover.

## 11. Checklist before handing over a screen

- [ ] Every gap is on the 4/8 scale. No `13px`, `17px`, `23px`.
- [ ] 3 radius sizes max, consistent between similar components.
- [ ] One accent. Other colors are only semantic or neutral.
- [ ] Numbers use tabular-nums and the correct local format.
- [ ] Every important number has something to compare against, or context.
- [ ] Loading, empty, error, and success are designed, not browser defaults.
- [ ] Text contrast ≥ 4.5:1, keyboard focus clearly visible.
- [ ] Checked at 360px wide: no horizontal scroll, tables scroll or turn into cards.
- [ ] One surface style and at most one accent-filled hero surface per view.
- [ ] Hover and transitions ≤ 200ms, chrome stays still on navigation, entrances play once, and `prefers-reduced-motion` respected.
- [ ] This screen can be described in one sentence: "this page is for ___".

Reviewing or handing over a whole flow (forms, navigation, mobile, a native app) → also run [references/ux-audit.md](references/ux-audit.md). A scroll-driven or cinematic landing page → `fe-scroll`.

## 12. Visual references

The full case studies (what to borrow and what to avoid from five dashboards and three Indonesian sites) are in [references/case-studies.md](references/case-studies.md). Read it **if** you're setting the visual direction for a new product, choosing a palette, or asked to make something feel like it has character — not for a small component fix.
