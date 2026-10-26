# Design database (from ui-ux-pro-max)

A local, offline search over 192 product types with palettes and reasoning rules, 74 font pairings, 1,934 Google Fonts, 88 styles, 34 landing-page patterns, 25 chart types, 119 UX guidelines, 17 GSAP motion presets and per-stack implementation notes (22 stacks). Pure Python 3 stdlib, no network. Data and scripts adapted from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, `LICENSE-ui-ux-pro-max.md`).

Read this when **setting the visual direction for a product with no brand or design system yet**, or when you need a font pairing, a product-appropriate palette, or a stack-specific implementation note. Not for a small component fix.

## Results are candidates, the SKILL.md rules decide

The database leans decorative: it recommends glassmorphism for general SaaS, motion-driven styles for micro-SaaS, several accent colors per palette. Take its **product reasoning, palette hue family and font pairing** as input, then cut it down to `ui-design-taste` §1: one accent, graded neutrals, 3 semantics, one family (two max). An existing design system or brand beats both.

## Commands

The script lives in this skill, not the project. Use the full path; try `python`, then `python3`, then `py -3`.

```bash
S="<this skill folder>/scripts/search.py"

# New product or page → one design-system query (pattern, style, palette, type, effects, anti-patterns)
python "$S" "invoicing saas small business" --design-system -p "Kasir Pro" -f markdown

# One concern → one domain
python "$S" "fintech trust minimal" --domain color
python "$S" "geometric sans humanist body" --domain typography
python "$S" "error summary validation" --domain ux

# Implementation detail for the detected stack
python "$S" "form validation server actions" --stack nextjs
```

Domains: `product` `style` `color` `typography` `google-fonts` `chart` `ux` `landing` `icons` `gsap` `react` `web`. Stacks: `react nextjs vue svelte astro nuxtjs nuxt-ui angular laravel swiftui react-native flutter jetpack-compose html-tailwind shadcn threejs javafx wpf winui avalonia uno uwp`. Detect the stack from the project (`package.json`, `pubspec.yaml`, `*.csproj`…); never assume one.

Optional dials on `--design-system`, each 1–10: `--variance` (centered → asymmetric), `--motion` (subtle → choreographed), `--density` (spacious → dashboard). Dashboards: `--density 8`; marketing pages: `--density 3`.

## Query contract

- One dominant intent, 2–5 meaningful terms, one constraint (product, platform or interaction). Not a whole checklist in one query.
- Check that the returned domain and top result actually fit the product and platform before using it.
- Empty or off-topic → **retry once** with a narrower phrase or an explicit `--domain`/`--stack`. Still nothing → say "no database match, using general defaults" and fall back to SKILL.md. Never present an empty search as if it returned data.
- Auto-detected domain misroutes overlapping words ("font" hits both `typography` and `google-fonts`); pass `--domain` when results look off.
- Never put private project data (customer names, internal URLs) in a query.

## Persisting (writes files — ask first)

`--persist -p "<Name>" --output-dir "<project root>"` writes `design-system/<slug>/MASTER.md` (+ `pages/<page>.md` with `--page`). Only when the user wants a design-system file in their repo. Without `--output-dir` it writes wherever the shell happens to be. An existing `MASTER.md` is left untouched unless `--force`: read it first, and never pass `--force` without the user's explicit OK. When building a page later: a `pages/<page>.md` overrides `MASTER.md`.
