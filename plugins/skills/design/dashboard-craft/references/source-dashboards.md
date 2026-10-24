# Source Dashboards (observed 2026-10-25)

Public reels from [@code.xr](https://www.instagram.com/code.xr/), stepped through frame by frame. Source code is sold privately, so nothing here is copied; these are notes on what each design does well. Use them to pick a direction, then build with your own tokens. Only the 12 most recent posts are visible without login, so V1–V13 and V17 weren't reviewed.

| Dashboard | Look | Shell | Worth borrowing |
|---|---|---|---|
| **V18** ([reel](https://www.instagram.com/code.xr/reel/De4N3s_zxmB/)) "Modern & Minimal", React + CSS | Light grey canvas, white cards, lavender/pink accent, a 3D-render illustration in the banner | Floating dark rail, icon-only, light-circle active state + edge notch, dark tooltip labels | Rail grows from a capsule on load; card surfaces appear empty first, then content blur-fades in; welcome banner heading reveals word by word; "9,4h" and "40 58" count up; route change keeps the rail, blanks content, re-staggers (profile page: banner → avatar → stat cards → bar chart growing up) |
| **V16** ([reel](https://www.instagram.com/code.xr/reel/De1uvwiza9R/)) Sales CRM, React + CSS | White cards, saturated blue accent, lime secondary used once per chart | Top pill nav, near-black active pill that slides between tabs | `$49,676.18` counting up with smaller cents; heatmap-style mini bar block filling in; spotlight bar (one blue bar with a lime cap) among pale bars; dark Q4 target card with a gauge arc; one blue-filled KPI on the Analytic page; spline area chart with crosshair + dark tooltip pill; **circular dark-mode reveal from the toggle** |
| **V15 "Ember"** ([reel](https://www.instagram.com/code.xr/reel/DezLDhlzeo3/)) Agency admin, React + CSS | White/grey with one orange accent, big headline-sized "Search something…" field in the header | Top pill nav, black active pill | KPI trio inline in the header; gauge with a needle sweeping in; orange-filled "Manage quotes" card as the single hero; hatched inactive bars with one solid orange bar + value pill; meeting heat calendar with peach circles and a dark floating "Upcoming meeting" popover; bottom-centre floating product switcher pill; circular dark-mode reveal |
| **V15 "Fluentis"** ([reel](https://www.instagram.com/code.xr/reel/DezD0vhzvvL/)) Language-learning, same bundle | Soft pastel gradient canvas (lilac → pink), white cards, pastel course cards | Floating rail on the left + top pill nav | Performance line chart over a dense field of thin bars; percent list with progress lines; leaderboard with avatars; switching to Ember uses a **diagonal wipe** across the viewport |
| **V14** ([reel](https://www.instagram.com/code.xr/reel/Dewo9q0zUIx/)) Finance, React + Framer Motion | Clean white, orange-red accent, one gradient-filled card | Top nav + thin icon rail | Code on screen shows `motion.div whileHover={{ y: -5 }}` cards and lucide-react icons; savings goals as a row of progress rings; auto-save toggles; route change blanks content, heading blur-fades in, cards re-stagger |
| **3D Dashboard + AI** ([reel](https://www.instagram.com/code.xr/reel/De4IKRxzZU1/)) "Neon HQ" | A 3D low-poly office scene as the canvas | Floating top icon bar + left rail over the scene | KPI/greeting cards floating over the scene; name + value labels pinned to 3D characters; an AI assistant panel sliding in from the right; agent detail popover on click |

## Patterns shared by all of them

- Persistent shell; only the content region animates on route change.
- Load order: shell → empty card surfaces in reading order → text → numbers counting up → charts drawing.
- One accent-filled hero card per view; everything else white on light grey.
- Dark floating elements (tooltips, popovers, switchers) over the light page.
- Charts with one focal element: a spotlight bar, a needle, a hovered point.
