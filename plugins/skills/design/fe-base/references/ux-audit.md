# UX audit pass

Read this for a **review or audit of a whole screen or flow**, before handing over a new flow, or when something "feels off" and the SKILL.md checklist (§11) found nothing. It lists what most often slips past a visual pass. Distilled from ui-ux-pro-max's 119 guidelines and pre-delivery checklist (MIT, `LICENSE-ui-ux-pro-max.md`); the database search (`design-database.md`, `--domain ux` / `--domain web`) has the full text with rationale.

Work in priority order and stop to fix at each level; a polished chart on an inaccessible form is still a broken screen.

## 1. Accessibility (critical)

- Focus is visible **and not hidden by sticky headers, cookie banners or toasts** (WCAG 2.2 focus-not-obscured).
- Every drag action (reorder, slider, kanban) has a single-click and keyboard alternative.
- Web pointer targets ≥ 24×24 CSS px; touch ≥ 44×44 pt (iOS) / 48×48 dp (Android), with the hit area extended past a small icon.
- Sign-in allows paste and password managers; no puzzle-only or memory-only authentication.
- Information already entered in the same flow is not asked again.
- Icon semantics follow use: decorative icon beside text → `aria-hidden`; standalone meaningful icon → text alternative; icon button → accessible name plus its pressed/expanded/selected state.
- A changing count or status is announced as a full phrase ("3 unread messages") in one polite live region, without moving focus.
- Carousels and auto-moving content have pause, and stop on focus and under reduced motion.
- After a route change, focus moves to the main content; headings go h1→h6 without skips; a skip link exists.
- Help (chat, contact, FAQ link) sits in the same relative place on every page.
- Text at 200% and the page at 320 CSS px wide lose no content or action (WCAG reflow); no fixed heights clipping enlarged or translated text.
- Windows forced-colors / high-contrast mode keeps focus rings, borders and selected states visible (`outline` survives; `box-shadow` rings and background-only states don't).
- Reduced motion swaps motion for a fade or an instant change; it never zeroes transitions that a focus move or a visibility change depends on (no blanket `* { transition: none }`).

## 2. Touch and interaction (critical)

- Pressed feedback within ~100 ms; press states change color/opacity/elevation, **never layout bounds**.
- Nothing important lives behind hover only; every gesture-only action also has a visible control.
- A movement threshold before a drag starts; no horizontal swipe on main scrolling content; system gestures (back swipe, edge swipes) are never hijacked.
- Primary controls stay clear of notch, home indicator and screen edges; fixed bars reserve content insets so lists aren't hidden under them.
- Rapid repeated taps cancel or replace the previous micro-interaction and set the final state explicitly; correctness never depends on an `animationend` event.

## 3. Performance felt as UX

- Images and async content reserve their space (`width`/`height` or `aspect-ratio`): no layout jump.
- `font-display: swap`/`optional`; preload only the one or two critical font files.
- Lists over ~50 rows virtualize; scroll/resize/input handlers debounce or throttle.
- Feedback matches the wait: nothing for near-instant work, a skeleton past ~300 ms, progress plus explanation past a few seconds. Timeouts show a message and a retry.
- Offline or slow network shows a state, not a frozen screen.

## 4. Layout and responsive

- `width=device-width, initial-scale=1`; zoom never disabled. `min-h-dvh` instead of `100vh` on mobile.
- Body text ≥ 16 px on mobile (smaller triggers iOS input zoom); 35–60 characters per line on mobile.
- One z-index scale (e.g. 0/10/20/40/100/1000), no ad-hoc 9999.
- No nested scroll regions fighting the page scroll.
- Landscape stays readable and operable.
- Long URLs, IDs and user content wrap with `overflow-wrap: anywhere` on a shrinkable flex/grid child; never `word-break: break-all` on prose.
- Chip/badge collections wrap before labels shrink; a `+3` overflow is an operable disclosure, and truncated labels show the full text to pointer and keyboard users.

## 5. Forms and feedback

- Visible label on every field; placeholder is never the label. Helper text persists under complex inputs.
- Validate on blur, not per keystroke. The error sits under its field, says cause + fix, and is linked with `aria-describedby`.
- **Failed submit with several errors**: a focusable summary at the top, each item linking to its field, focus moved to it; inline errors stay.
- Semantic input types and `autocomplete` so the right keyboard and autofill appear.
- Read-only looks and behaves differently from disabled.
- Destructive actions: danger color, spatially separated, and either confirmed or undoable ("Undo" toast). Unsaved changes in a sheet or modal confirm before dismiss; long forms autosave drafts.
- Toasts don't steal focus (`aria-live="polite"`) and auto-dismiss in 3–5 s, never carrying the only copy of an error.

## 6. Navigation

- Back restores the previous scroll position, filters and input; the stack is never silently reset to home.
- Every key screen is reachable by URL (shareable, linkable from notifications).
- One primary pattern per level: don't mix tabs, sidebar and bottom nav at the same level. Bottom nav ≤ 5 top-level items, icon + label. ≥ 1024 px prefers a sidebar.
- Modals never carry a primary navigation flow, and always have a clear close.
- An unavailable destination explains why instead of disappearing.
- Logout and account deletion sit apart from ordinary nav items.

## 7. Charts (beyond SKILL.md §6)

- A text summary or `aria-label` states the chart's key insight; a table alternative exists for data that matters.
- Series are distinguishable without color (shape, pattern, direct label); avoid red/green-only pairs.
- Interactive points are keyboard-reachable and tooltips don't depend on hover.
- 1,000+ points aggregate or sample, with drill-down; a pie with > 5 slices becomes a bar chart.
- Loading uses a chart-shaped skeleton; a failed load shows an error with retry, never an empty axis frame.

## 8. Native and mobile apps (iOS, Android, React Native, Flutter)

- Vector icons from one family, one stroke width, one filled-or-outline style per level; never emoji as structural icons.
- Official brand logos at correct proportions and clear space.
- Prefer native controls with proper roles over styled containers.
- Support Dynamic Type / the largest system text size without truncating or breaking layout.
- Test on a small phone (375 pt), a large phone and a tablet, portrait and landscape.
- Light and dark are each tested on their own: text ≥ 4.5:1 in both, dividers and pressed/focused/disabled states visible in both, modal scrims measured against the real background.
