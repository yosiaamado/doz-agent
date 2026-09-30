# Visual Case Studies

Reference material for `ui-design-taste`. The color and typography figures below are taken straight from the sites' CSS (inspected September 2026), not estimated.

## Part 1: Five admin dashboards

### A. The dense template dashboard ("Architect" style)

A light grouped sidebar, a green header, many small widgets, tabs, a table with sparklines.

- **Borrow:** labelled sidebar grouping (`MENU`, `UI COMPONENTS`, `FORMS`), sparklines inside table rows, pill status badges.
- **Avoid:** too many equally weighted widgets on one screen, so nothing stands out; 11–12px text everywhere; badge colors competing with each other (yellow, green, red, blue at full saturation in a single column).
- **Lesson:** high density is fine for a daily work tool, but there must still be **one** element that is the largest on screen.

### B. The roomy SaaS dashboard ("Consult" style)

Large cards at ~20px radius, one dominant purple card holding the headline number, a calendar on the right, a list of interviews.

- **Borrow:** one "hero" card in full accent color for the most important number, while the other cards stay white and quiet. This is the cheapest way to create hierarchy in a dashboard.
- **Borrow:** the bold use of whitespace, and a schedule list with avatars + times on the right.
- **Avoid:** a big illustrated "Upgrade" CTA eating a third of the sidebar.
- **Reference palette:** purple `#5B4CC4` (accent), mint `#7DE0E6` and coral `#F4846B` (supporting, small doses), surfaces `#FFFFFF` with a very light grey page.

### C. The gradient dashboard ("Purple" style)

Three gradient KPI cards (pink, blue, teal) in a row, a multicoloured bar chart, a three-colour donut.

- **This is the headline anti-pattern.** Gradients on every card mean nothing is more important than anything else, and white text on a light gradient often fails contrast.
- **If you do want a gradient:** one card only, or a hero. Everything else white with coloured deltas.
- **Worth borrowing:** the small icon in the card's top-right corner as a category marker, and the change caption ("Increased by 60%") right below the number.

### D. The themed dashboard ("EduAdmin" style)

A dark navy sidebar, a blue welcome banner with an illustration, course cards with coloured category chips and progress bars.

- **Borrow:** the personal welcome banner at the top ("Welcome, Jhone") gives it the feel of a product rather than a raw panel. A thin progress bar with the percentage above it is easy to scan.
- **Avoid:** category chips in assorted solid colors (blue, orange, red, cyan) with no systematic meaning; multicoloured notifications that pull more attention than the main content.
- **Lesson:** a dark sidebar + light content is a safe combination and looks tidy, as long as the accent color in the content stays singular.

### E. The data-first dashboard ("Adminator" style)

Almost entirely neutral, small uppercase labels, large figures in monospaced-width digits, deltas with a comparison line, a region list with thin bars.

- **This is the best reference for an internal dashboard.** Almost no color, yet the fastest to read.
- **Borrow all of it:**
  - The summary sentence at the top: "Total visits +10% week over week… Two new regions came online overnight." One human paragraph beats four cards with no context.
  - The KPI anatomy: label → number → delta → comparison line (`up from 1.12M last week`).
  - Small section labels (`GEOGRAPHY`, `PERFORMANCE`, `PERSONAL`) as dividers, rather than heavy rules.
  - Figures with `tabular-nums` so columns line up.
  - Color appearing only on deltas and progress bars.

## Part 2: Three Indonesian sites

### Gojek — a mature system

- **Typography:** one family (Maison Neue) with Book/Demi/Bold/Extended variants. Body 16px, `line-height` 24px, headings 24–26px. Hierarchy comes from font weight, not from many sizes.
- **Color:** green `#00AA13` as the single accent, dark ink `#101820` and `#27455C` for text/backgrounds, grey `#696969` for secondary text, white as the main canvas. Pastels (pink, orange, light green) appear only as small accents in illustrations.
- **Shape:** extreme radii used deliberately — `2px` for small elements, but `40px`, `64px`, `96px` for large cards and panels. That radius contrast is what makes it feel friendly yet confident.
- **Shadows:** soft and coloured (`rgba(16,24,32,.2) 0 0 10px`, and a coloured glow `rgb(208,180,212) 0 0 32px 10px` on certain cards) — used as an accent, not as a separator.
- **What to take for a dashboard:** one strong accent, a single type family, and the confidence to use large radii consistently on cards.

### Toko Kopi Tuku — character from palette and type

- **Color:** cream `#F3EAD2`, tan `#C0AF90`, orange `#EA9330`, blue-grey `#5D84A3`, brown `#B76545`. A warm, low-saturation palette that feels like product packaging.
- **Shape:** `border-radius: 0` across the whole site, **no shadows at all**. Flat, editorial, like a printed poster.
- **Typography:** a custom display font + a handwritten font for accents. Small sizes (10–16px) for body, large for headings.
- **Lesson:** character doesn't come from effects, it comes from **a consistent palette + typography with character**. Square corners and no shadows actually read as more expensive than floating cards.
- **When to use it:** strongly branded products, landing pages, or public pages. For a dashboard, take the palette only — not the zero radius on interactive controls.

### Good Day "Hidup Banyak Rasa" — a single-color campaign

- **Color:** red `#E1241C` on white, ink text `#212529`. Effectively two colors.
- **Typography:** Poppins, weights 400 and 700 only.
- **Motion:** a consistent `0.2s` transition across every interactive element.
- **Lesson:** one bold color + one font + uniform transitions is already enough to look polished. Complexity is not a requirement.

## Part 3: The directly usable summary

| Need | Visual direction |
|---|---|
| Internal dashboard, dense data | Style E: neutral, small labels, large tabular figures, color only on deltas |
| Customer-facing product dashboard | Style B + Gojek: one dominant accent card, consistent large radii, lots of space |
| Branded product / public page | Tuku: a consistent warm palette, display typography, minimal effects |
| A campaign or single-focus page | Good Day: two colors, two font weights, one call to action |

**Three things present in every good example, and absent from every weak one:**

1. A single accent, used with discipline.
2. One font family with few weights, rather than many sizes.
3. Numbers always accompanied by context: a period, a comparison, or a target.
