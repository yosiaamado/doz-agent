# Changelog

Every meaningful change to the `doz-agent` plugin is recorded here, newest version at the top. Versions follow `plugins/.claude-plugin/plugin.json` (SemVer).

Rules for humans and AI changing this repo:

- Each version = one entry: the reason/source, then one line per change per file. Its commit is tagged `vX.Y.Z`.
- Going back to an older version: `git checkout vX.Y.Z -- plugins/` (or `git revert <commit>`). Comparing: `git diff vX.Y.Z..HEAD -- plugins/`.
- A change triggered by a usage audit names the file in `agent-usage/`, so its impact can be compared against the next audit.
- History before 1.15.0: see `git log`.

## [3.5.0] - 2026-11-08

Source: a user request for a private `company/` folder split by division, so agents can read company records as an archive. Checked on 2026-11-08: `Glob` finds gitignored files, and `Grep` from the project root skips them, so the skill tells agents to search with `path` set to the folder. No before/after: paths changed, no tuned behaviour changed.

- `skills/business/company-roles/SKILL.md`: Step 1 maps divisions to folders and roles, with a read-your-own-division rule and the search rule; profile path is `company/profile.md`, with the older `company-profile.md` still read.
- `agents/sales-director.md`: notes go to `company/sales/`.
- `skills/important/deal-check`, `director`, `sales-team`, `update-company`, `weekly-review`: new paths; `update-company` moves an older profile; reviews go to `company/leadership/weekly-reviews/`.
- `company-profile-template.md`, `README.md`, `plugin.json` (3.5.0), `.gitignore` (`company/`).

## [3.4.0] - 2026-11-08

Source: a user request for team shortcuts like `/ship-feature` (`/sales-team`, `/director`), kept in their own folder, and for any session to be able to say which shortcut covers what. Skills can call agents because they run in the main thread; agents can't call each other. Invocation names don't depend on the path, so moving skills breaks nothing. Not yet run in a real session. No before/after: new skills, no tuned behaviour changed.

- `skills/important/` (new area): shortcut skills. `ship-feature` moved from `engineering/`, `update-company` from `business/`.
- `skills/important/director/SKILL.md` (new): chooses seats by what the decision touches, runs them in parallel on one brief, reports verdicts, the split and a recommendation; one CEO tie-break round at most.
- `skills/important/sales-team/SKILL.md` (new): routes by customer stage to one role, or two when the situation spans them.
- `skills/important/deal-check/SKILL.md` (new): sales, money and legal checks with a table mapping their verdicts to GO, GO WITH CHANGES, HOLD or NO-GO.
- `skills/important/weekly-review/SKILL.md` (new): reads the profile, sales notes and last review, then saves one focus that fits the available hours to `weekly-reviews/`.
- `skills/important/shortcuts/SKILL.md` (new): the shortcut list any session can answer from.
- `tests/test_plugin_structure.py`: every skill in `important/` must have a row in `shortcuts`.
- `plugin.json` (3.4.0, `./skills/important`), `marketplace.json`, `README.md`, `.gitignore` (`weekly-reviews/`).

## [3.3.0] - 2026-11-08

Source: a user request to separate agents by area and add company-role agents (sales for discussing new prospects, CEO, CFO, CTO, COO and others), with knowledge researched from senior practitioners; names are a recommendation for the user to correct. Agents stay flat because subfolders change their names, so areas are shown by README group and colour. One skill holds all playbooks, so nine roles add one skill description rather than nine. Playbooks were researched on 2026-11-08 from first-hand and practitioner writing plus Indonesian regulations; what couldn't be verified is marked `⚠ NEEDS VERIFICATION`, and benchmarks are mostly US and often vendor-reported. No before/after: new agents, no tuned behaviour changed. A trial of `sales-director` on a made-up prospect (6 tool calls, `Recommendation: QUALIFY FIRST`) led to defining the A/B/C rating, placing the next move first under Next steps, and rewording the proposal gate. A `legal-counsel` run on a real question (14 tool calls, `Recommendation: NEED DOCUMENT`) caught a wrong amendment reference in its playbook, now corrected. Each description adds about 330 characters of resident context.

- `agents/ceo.md`, `cfo.md`, `cto.md`, `coo.md` (new, purple), `cmo.md`, `sales-director.md`, `customer-success-lead.md` (new, pink), `hr-lead.md`, `legal-counsel.md` (new, cyan): opus/high, `maxTurns` 20 with a 14-call checkpoint, first line `Recommendation:`, read-only except `sales-director` (`sales-notes/` only); `cfo` and `cto` have Bash for arithmetic and read commands.
- `skills/business/company-roles/SKILL.md` (new area `business`): position-first method, evidence labels, limits, hand-off table, several-roles rule, report template, excuse/reality table.
- `skills/business/company-roles/references/<role>.md` (new, nine files): what the role owns, first questions, decision frameworks, benchmarks, Indonesia, traps, push-back, hand-offs, sources.
- `skills/business/company-roles/references/company-profile-template.md` (new): the private profile the agents read; a role report's `Profile:` line has the main thread create or update it and add it to `.gitignore`.
- `skills/business/update-company/SKILL.md` (new): guided update of `company-profile.md` with follow-up questions per kind of change, a suggested `TODO`, and a history.
- `.gitignore`: `company-profile.md`, `sales-notes/`, `trading-journal/`.
- `plugin.json` (3.3.0, `./skills/business`, keywords), `marketplace.json`, `README.md`: agents grouped by area; list the new agents and skill.

## [3.2.0] - 2026-11-03

Source: a user request for a trading agent that searches recent news on an entity, classifies its sentiment, checks whether price already moved, compares the chart, and sets buy and sell prices, modelled on how a discretionary trader works (top-down context → macro & politics → catalyst → reaction → structure → plan → journal). A follow-up asked for more sources than two and for politics, geo-economics and every other market-moving factor to be weighed. Sources tested on 2026-11-03: Yahoo chart API (stocks, indexes, FX, futures, yields, DXY, VIX), Binance `data-api.binance.vision`, CoinGecko, Frankfurter, World Bank, SEC EDGAR, Google News RSS and crypto Fear & Greed work; FRED and bi.go.id timed out; GDELT is rate-limited; Stooq is behind a browser check and is not used. No before/after: new agent, no tuned behaviour changed. A trial run on BBCA.JK (2026-11-04, 24 tool calls, 11 searches + 3 fetches, `Recommendation: WAIT`, plan R:R 2.39) found seven gaps, fixed before release: the sizing unit is capital, a rule for script vs press price conflicts plus a report line for them, older sources allowed for unresolved slow-moving factors, scaled valuation ratios, the rubric's step reference, and the report cap raised to 700 words.

- `agents/trading-analyst.md` (new): opus/high, `maxTurns` 40 with a 28-call checkpoint, 12 searches + 8 fetches budget split between macro and company, writes only to `trading-journal/`, never places orders or asks for credentials. First line `Recommendation:` (BUY-ZONE/WAIT/AVOID/HOLD/TRIM/EXIT/NO-DATA). Report has a macro scorecard and regime. Preloads `trading-analysis`.
- `skills/markets/trading-analysis/SKILL.md` (new area `markets`): scope defaults, steps 1–8 including a macro/politics/geopolitics step and a fundamentals snapshot, the two-independent-outlets rule, company sentiment × macro regime, size halved in a hostile regime or across a binary event, modes (analyze, review a position, scan a watchlist), excuse/reality table.
- `skills/markets/trading-analysis/scripts/price_check.py` (new): MA20/50/200, RSI14, ATR14, returns, ranges, volume ratio, 20d relative strength and beta vs benchmark, move since a catalyst date in % and ATR, and `--macro idx|us|crypto|<list>`: each proxy's trend plus the symbol's 60d correlation (same-day and 1-session lag) and beta to it. Stdlib only.
- `skills/markets/trading-analysis/references/macro-factors.md` (new): 13 factors (monetary, currency, data, fiscal, domestic politics, regulation, geopolitics, trade/geo-economics, commodities, risk appetite, flows, calendar, fundamentals) with proxies and channels, IDX sector sensitivity map, scorecard format, background reading.
- `skills/markets/trading-analysis/references/data-sources.md` (new): price, macro, news and fundamentals sources with their 2026-11-03 test status and fallbacks.
- `skills/markets/trading-analysis/references/sentiment-rubric.md`, `references/market-rules.md` (new): scoring rubric and source tiers; dated IDX rules (lot, tick size, ARA/ARB marked for verification).
- `agents/technical-lead.md`: roster row for `trading-analyst`.
- `plugin.json` (3.2.0, `./skills/markets`, keyword), `marketplace.json`, `README.md`: list the new agent and skill.

## [3.1.0] - 2026-10-26

Source: a user request (via `ship-feature`) to rework studio's look with the fe skills, add a `technical-lead` agent that supervises and breaks down work (based on research into what tech leads do: staffeng.com archetypes, Thoughtworks on first-time tech leads and *Talking with Tech Leads*, Google eng-practices review standard, PostHog on tech-lead failure modes), make studio a "virtual office" where any agent can be chatted with and each agent's live activity is visible, visualize Claude Code's own features, support several Claude accounts as switchable profiles, and ship it all in the desktop app. Spec: `docs/specs/studio-office.md`. Verified by code review (BE and FE), security review and QA with an integration test against a fake `claude`; two fix rounds. Studio goes to 2.1.0.

### Plugin

- `agents/technical-lead.md` (new): opus/high, read-only, `maxTurns` 25 with a 17-call checkpoint. Three modes: breakdown (vertical slices with owner agent, files, interfaces, tests, order, checkpoints, risks with intervene signals), supervise (approach review, blocker/nit labels, next step), and questions about how the agents and skills fit together. Holds the team roster table. Doesn't delegate on its own.
- `plugin.json` (3.1.0), `marketplace.json`, `README.md`: list `technical-lead` (10 subagents).

### Studio 2.1.0

- Profiles (`server/infra/profileStore.js`, `server/lib/spawnEnv.js`, `server/services/profileService.js`, `server/routes/profileRoutes.js`, `web/src/features/profiles/`, `features/topbar/ProfileSwitcher.jsx`, `hooks/useProfiles.js`): each profile is its own `CLAUDE_CONFIG_DIR` with an optional encrypted API key; every child process gets an env built for its profile, and non-default profiles drop every inherited account variable. `process.env` is no longer written (`server/lib/secretEnv.js` removed). Usage and limits are per profile. Switching is blocked while work runs (409), and a folder can't be re-pointed while chats use it (`PROFILE_IN_USE`). The legacy single key migrates into the default profile; **downgrading to 2.0.0 loses the saved key**. A saved default-profile key now wins over a shell `ANTHROPIC_API_KEY`.
- Stream visibility (`server/runners/stream.js`, `web/src/lib/activity.js`, `features/logs/ActivityTree.jsx`): subagent calls are no longer dropped; they nest under their parent with their own tools, alongside Skill loads, todos, blocked tools, rate limits and session init (model, MCP servers, key source).
- Chat (`server/repositories/chatRepository.js`, `server/services/chatService.js`, `server/routes/chatRoutes.js`, `web/src/hooks/useChats.js`, `features/chat/`): chat with any agent, continued with `--resume`. Read-only by default (`--permission-mode dontAsk`, `--setting-sources user`, `--strict-mcp-config`, write/Bash/web/Task tools disallowed); "Allow edits" adds file edits only. Planted chat files in a cloned workdir can't grant edits or inject session ids. Deleting a chat keeps the Claude transcript.
- Office (`web/src/features/office/`, `web/src/lib/office.js`, `components/ui/ReconnectBanner.jsx`): agent roster with live status, activity, next node, todos, nested subagents, per-agent chat history.
- Restyle (`web/src/styles/*`): tokenized 4/8 spacing, 6/12/16 radii, one accent with ≥ 4.5:1 contrast in both themes, glass only on floating chrome with fallbacks, CSS-only entrance and theme-reveal motion with reduced-motion support; no new dependency.
- Hardening found in review: the server's Origin check is pinned to its own port (`scripts/dev.js` allows Vite's 5317); read-only pipeline agents no longer get git Bash prefixes (`git log --output` could write files); the api runner's bash tool runs with the profile env.
- `studio/package.json` 2.1.0; `studio/README.md`: Office, Chat, Activity and Profiles sections, architecture tree.

## [3.0.0] - 2026-10-26

Source: a user request to rename `ui-design-taste` to `fe-base` and give the skills adapted from other repos the plugin's own names, while keeping their source references. Major version because invocation names change: `doz-agent:<old-name>` no longer resolves. Content is unchanged; source links, license notices in `references/`, and upstream engine paths (`~/.video-demo/`, the `video-demo` npm package name, `scrollcraft` workspace) are kept as they were, since the engines depend on them.

- `skills/design/ui-design-taste/` → `skills/design/fe-base/` (`name: fe-base`).
- `skills/design/apple-design/` → `skills/design/fe-native-feel/` (`name: fe-native-feel`).
- `skills/design/dashboard-craft/` → `skills/design/fe-dashboard/` (`name: fe-dashboard`).
- `skills/design/scroll-craft/` → `skills/design/fe-scroll/` (`name: fe-scroll`).
- `skills/media/video-demo/` → `skills/media/demo-video/` (`name: demo-video`); `references/windows.md` copies it to `~/demo-video` in WSL.
- `agents/video-demo.md` → `agents/demo-video.md` (`name: demo-video`, preloads `demo-video`).
- `agents/frontend-engineer.md`, `agents/code-reviewer.md`, `skills/engineering/frontend-patterns/SKILL.md`, and cross-references inside the renamed skills: new names.
- `plugin.json` (3.0.0), `marketplace.json`, `README.md`: new names, plus a rename table in the README.

## [2.7.0] - 2026-10-26

Source: a user request to grow the FE and UI/UX skills from [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) and [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), and to make a `video-demo` agent from [nilbuild/video-demo](https://github.com/nilbuild/video-demo). All three are MIT; license notices are kept in each skill's `references/`. scroll-craft covers a gap (experience-style landing pages), so it is a new skill. ui-ux-pro-max overlaps `ui-design-taste`, so only its offline database and the audit rules not already covered were merged, as on-demand references; its decorative style picks are framed as candidates under the existing taste rules. The bundled scripts were read, not run, here. No `claude plugin eval` run yet: additive, on-demand material.

- `skills/design/scroll-craft/SKILL.md` (new): the upstream skill condensed from 25k to under 12k characters — spine rules, layered-hero requirement, brief with delegation and a subagent `needs-decision` path, bootstrap with explicit consent before paid kie.ai generation, journey, grammar/signature/fingerprint gate/feeling curve/score checks, assets, build, scroll verification, hard rules, report.
- `skills/design/scroll-craft/{engine,scripts,templates,references}/` (new): upstream engine, doctor/workspace/serve/shoot/encode/kie scripts, fingerprint template and reference files, unchanged; `references/LICENSE-scroll-craft.md`.
- `skills/media/video-demo/SKILL.md` (new): upstream workflow with a "Use when" description, pointers to the Windows notes, and the plugin-cache caveat (reinstall after a plugin update; durable engine fixes go in this repo).
- `skills/media/video-demo/{engine,scripts,template,references,package.json,package-lock.json,.gitignore}` (new): upstream engine and scripts, unchanged; `references/LICENSE-video-demo.md`.
- `skills/media/video-demo/references/windows.md` (new): the engine is POSIX-only (symlinks, `nice`, `.venv/bin/python`), so on Windows it runs from a copy inside WSL2.
- `agents/video-demo.md` (new): sonnet/medium, `maxTurns` 60 with a 42-call checkpoint, preloads `video-demo`; maps the skill's three user stops to `Status: needs-decision`, treats relayed feedback as a re-film, never touches the filmed repo.
- `skills/design/ui-design-taste/references/design-database.md` (new) + `scripts/` + `data/`: ui-ux-pro-max's offline search (product palettes and reasoning, font pairings, Google Fonts, styles, landing patterns, charts, UX guidelines, GSAP presets, 22 stacks), with the query contract and a rule that `--persist`/`--force` need the user's OK.
- `skills/design/ui-design-taste/references/ux-audit.md` (new): the ui-ux-pro-max rules not already in this plugin (WCAG 2.2 focus-not-obscured, drag alternatives, target sizes, error summaries, back-state preservation, chart accessibility, native-app pre-delivery).
- `skills/design/ui-design-taste/SKILL.md`: §1 points to the database when there is no brand; §11 points to the UX audit and to `scroll-craft`.
- `agents/frontend-engineer.md`: loads `scroll-craft` on demand for scroll-driven or cinematic marketing pages.
- `plugin.json`: 2.7.0, registers the new `media` area; `plugin.json`, `marketplace.json`, `README.md`: list the new agent and skills.

## [2.6.0] - 2026-10-25

Source: user review of the 2.5.0 dashboards — the patterns are good beyond dashboards, so the general ones move into `ui-design-taste` (preloaded by `frontend-engineer`, so every screen gets them) and `dashboard-craft` keeps only dashboard specifics, pointing back instead of repeating.

- `skills/design/ui-design-taste/SKILL.md`: §1 card radius 16–24px on a gapped canvas; §3 smaller decimals on headline figures; §4 one accent-filled hero surface per view and dark floating elements on light pages; §5 bordered vs gapped surface styles and bento spans; §8 still chrome on navigation, reading-order entrances once per mount, fast flat exits, blur-in for headings, tween from the old value, hover lift only on clickable cards, circular theme reveal, reduced motion in JS too; §9 realistic dummy data; §10 two new anti-patterns; §11 two checklist lines.
- `skills/design/dashboard-craft/SKILL.md`: canvas, numbers and interaction sections now reference those `ui-design-taste` rules and keep only the dashboard-specific parts.

## [2.5.0] - 2026-10-25

Source: a user request to turn the dashboard reels of [@code.xr](https://www.instagram.com/code.xr/) into a skill for `frontend-engineer`. Reviewed by stepping through frames of Dashboard V14, V15 (Ember and Fluentis), V16, V18 and 3D Dashboard + AI; V1–V13 and V17 need an Instagram login and weren't reviewed. The source code isn't public, so nothing is copied and timings are team decisions fitted to the frames. No `claude plugin eval` run yet: additive, on-demand skill.

- `skills/design/dashboard-craft/SKILL.md` (new): persistent shell (floating rail / sliding pill nav), bento canvas with one accent hero card, number styling, six chart patterns with one focal point each, first-load choreography with timings, route change, circular theme reveal and workspace wipe, hover and live-data rules, a traps table (count-up replay, animating height, blur cost, table stagger, screen readers, hydration, reduced motion), 3D scene dashboards, checklist.
- `skills/design/dashboard-craft/references/recipes.md` (new): Motion variants for the entrance, a count-up that tweens from the previous value, SVG bar/line/ring/gauge draws, hatched bars, Recharts props, `layoutId` nav pill with a persistent shell, View Transitions circular reveal and wipe, hover lift, reduced-motion summary.
- `skills/design/dashboard-craft/references/source-dashboards.md` (new): what each observed dashboard does well, with links, dated.
- `agents/frontend-engineer.md`: loads `dashboard-craft` on demand for dashboard/admin/analytics screens; not preloaded, per `CLAUDE.md`.
- `agents/code-reviewer.md`: loads `dashboard-craft` when the diff has dashboard entrance, chart, route or theme-switch animation.
- `skills/design/ui-design-taste/SKILL.md` §6: points to `dashboard-craft` for composition and choreography.
- `plugin.json`, `marketplace.json`, `README.md`: register the skill.

## [2.4.0] - 2026-10-25

Source: a user request to give `frontend-engineer` an Apple-style design skill built from [emilkowalski/skills — apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), its [ui-skills.com mirror](https://www.ui-skills.com/skills/emilkowalski/apple-design), and [dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill), merged into one skill with no duplicate content. Emil's repo is MIT; dickwu's has no license and its `references/hig/` is Apple's HIG text, so everything is rewritten and Apple's text is linked, not copied.

- `skills/design/apple-design/SKILL.md` (new): the eight HIG principles as review questions (merged from both sources); response and direct manipulation; springs and interruptibility with damping/response values; spatial consistency; materials and depth with accessibility fallbacks; type tracking and Apple's size minimums; control-size targets; reduced motion and vestibular rules; feedback, alerts, undo and data entry; wayfinding and wording; a craft lens with the generated-default looks to avoid. Topics already owned by `ui-design-taste` (spacing, palette, type scale, contrast, states, motion timing) are referenced, not repeated — checked line by line.
- `skills/design/apple-design/references/motion-physics.md` (new): drag tracking with velocity, Motion springs, velocity handoff, momentum projection, rubber-banding, translucent chrome CSS with fallbacks, reduced motion, and how to review motion.
- `skills/design/apple-design/references/platform.md` (new): framework vocabulary, mobile and desktop conventions, glass/blur in Electron, Tauri and React Native, Apple Pay on the web, and HIG pages by topic.
- `skills/design/apple-design/references/review.md` (new): the five-lens review method, severities, report format, and the plan-then-critique improvement mode.
- `skills/design/apple-design/references/LICENSE-emilkowalski.md` (new): the MIT notice for the adapted material.
- `agents/frontend-engineer.md`: loads `apple-design` on demand for drag/swipe/sheets/drawers/carousels, grabbable transitions, glass chrome, or Electron/Tauri app chrome — not preloaded, per `CLAUDE.md`; adds a "Feel" self-review item.
- `agents/code-reviewer.md`: loads `apple-design` when the diff has gestures, springs, sheets, glass or desktop chrome.
- `skills/design/ui-design-taste/SKILL.md` §8: grabbable motion follows `apple-design` instead of fixed durations.
- `plugin.json`, `marketplace.json`, `README.md`: register the skill.

## [2.3.0] - 2026-10-23

Source: a user request to learn from [obra/superpowers](https://github.com/obra/superpowers) and make agents more efficient. Every change maps to a measured finding there or in `agent-usage/2026-09-25.md`.

- `skills/engineering/ship-feature/SKILL.md` §3: the brief records **decisions, not code** — a five-part recipe per slice (files + pattern, exact interfaces, spec values, tests by name with assertions, Review focus items); code bodies only for algorithms those don't determine. New `Interfaces`, `Tests` and `Review focus` sections in the spec template. Superpowers measured plans written this way at ¼ the time and ⅓ the tokens with the same execution quality.
- `skills/engineering/ship-feature/SKILL.md` §3–5: **Review focus** (≤5 items) — inputs or failure modes the requirement implies but no AC names, each owned by a slice and pinned by a named test. The checklist starts with the five bugs that slipped past self-review in the 2026-09-25 audit. Passed to engineers, `code-reviewer` and `qa-tester`.
- `agents/system-analyst.md`: the same decisions-not-code rule and Review focus, plus `Interfaces`, `Tests` and `Review focus` in its spec template.
- `agents/backend-engineer.md`, `agents/frontend-engineer.md`: every Review focus item of the slice needs a test that would fail; the report's map becomes **AC/RF → test map**.
- `agents/qa-tester.md`: starts from untested ACs **and** Review focus items, including one-branch "A or B" tests.
- `agents/code-reviewer.md`: checks each Review focus item first; one with no failing-capable test is `issue (blocking)`.
- All 8 agents and 12 skills: **descriptions rewritten as triggers only**, starting "Use when", ≤400 characters, with a few Indonesian trigger phrases. Superpowers found that a description summarizing the workflow makes the model follow the description and skip the body. Total description text: 10,505 → 5,644 characters, resident in every session.
- `tests/test_plugin_structure.py` (new): fails when a `SKILL.md` reaches 20,000 characters (Claude Code truncates skills there after compaction), a description doesn't start with "Use when", exceeds 400 characters or isn't YAML-safe, a skill area folder isn't registered in `plugin.json`, `agents/` has subfolders, or an agent has no `maxTurns`.
- `CLAUDE.md` (new, repo root): authoring rules for agents and skills — where cost comes from, repo facts, description style, frontmatter defaults, size limits, phrasing that measurably works, evidence before changing tuned behavior, and a pre-commit checklist.
- `README.md`: Review focus in "Reducing review rounds", the brief recipe in "Saving tokens", and a pointer to `CLAUDE.md`.

Known, not fixed here: 6 tests in `tests/test_token_audit.py` were already failing before this release — they still expect the Indonesian category labels that 2.0.0 replaced with English.

## [2.2.0] - 2026-10-22

Source: a user request for a finance & accounting skill that researches what senior finance/accounting people do, searches the web for current rules and trusted formulas, and acts as a supervisor/product owner for engineers.

- `skills/consultant/finance-accounting/SKILL.md` (new): role as finance supervisor/PO for engineers; the questions each senior role asks; a 6-step workflow (business events → standards → journals → formulas & rounding → spec → acceptance); a research protocol with tiered trusted sources, two-source verification, effective-date checks and a `⚠ NEEDS VERIFICATION` fallback when no web tool is available; the finance spec template; a review checklist; red flags.
- `skills/consultant/finance-accounting/references/senior-roles.md` (new): controller, senior accountant, revenue, tax, FP&A, treasury, cost accounting and internal audit work mapped to system requirements.
- `skills/consultant/finance-accounting/references/indonesia-regulations.md` (new): dated snapshot (2026-10-22) with sources — SAK EP, PSAK renumbering, PSAK 118, PPN under PMK 131/2024, Coretax NSFP, PPh 21 TER, final MSME tax under PP 20/2026, 10-year retention — plus a list of topics not yet researched.
- `skills/consultant/finance-accounting/references/formulas.md` (new): TVM, PMT, NPV/IRR, depreciation, effective interest, leases, FX, break-even, variances, ratios, WACC and rounding, each with a worked example recomputed in Python `Decimal`.
- `skills/consultant/finance-accounting/references/ledger-design.md` (new): double-entry invariants, data model, money/date/period rules, subledgers, multi-currency, controls, reconciliation, retention and required tests.
- `agents/product-owner.md`: `WebSearch`/`WebFetch` added (3 searches + 2 fetches max, inside the existing budget); money features load `finance-accounting`, acceptance criteria use real numbers, and every rule a decision depends on is cited with source + access date or marked `⚠ NEEDS VERIFICATION`.
- `agents/system-analyst.md`: `WebSearch`/`WebFetch` added (4 searches + 3 fetches max); money features load `finance-accounting` (plus `ledger-design.md` when writing to a ledger), and the spec template gains an optional **Finance** section — journals, formulas & rounding, golden test cases, invariants. Never invent a rate or rounding rule.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`: register the skill.

## [2.1.0] - 2026-10-21

Source: a user request — engineer agents were writing too many documentation comments.

- `skills/engineering/backend-patterns/SKILL.md` §10: a "Comments: few, and only for why" rule — none by default, no doc comments on internal members, no restating/narration/change history/banners/commented-out code, match the file's density.
- `skills/engineering/frontend-patterns/SKILL.md` §2: the same rule for components, hooks and props (no JSDoc on internals).
- `agents/backend-engineer.md`, `agents/frontend-engineer.md`: a "Comments" self-review item (count added comments, delete any that aren't a non-obvious why); "full sentences" no longer applies to code comments.
- `agents/devops-engineer.md`: config/pipeline comments are rare, one line, why only.
- `agents/qa-tester.md` step 5: the same rule for test code — no Arrange/Act/Assert labels, no comments restating assertions, no doc comments on tests or fixtures.
- `agents/code-reviewer.md`: excess comments flagged as non-blocking.

## [2.0.0] - 2026-09-30

Source: a user request to make the product sellable — two languages, a packaged desktop app, and a one-click update button. Major version because every agent and skill file switched from Indonesian to English, and the report markers the orchestrator matches on changed (`Keputusan:`/`Rekomendasi:` → `Decision:`/`Recommendation:`).

### Breaking

- `plugins/**` (36 files): all agent, skill, reference, workflow and action files translated to English. English is now the only maintained version. `name:` values, workflow node ids and workflow filenames are unchanged, so `/doz-agent:<name>` and `run-workflow <name>` keep working.
- `skills/engineering/token-audit/scripts/token_audit.py`: the verdict regex accepts `Decision`/`Recommendation` alongside the old Indonesian markers, and "Fix mode" alongside "mode perbaikan", so old and new transcripts both parse. Finding-category labels are English now, so rows in an existing `findings.csv` stop grouping with new ones for the recurring-pattern feature; it self-heals within 5 runs.
- Update manifest and `installed.json`: field `version` → `contentVersion`, and `minAppVersion` is now required. Manifests using the old shape are rejected.

### Studio: runtime & packaging

- `server/infra/runtimePaths.js` (new): resolves `plugins/` and `web/dist` in three modes — dev inside the repo, an extracted zip, and a packaged Electron app — with a `DOZ_PLUGIN_DIR` override and one-time seeding into app-data.
- `server/infra/configStore.js` (new): config moves to the OS app-data folder (`%APPDATA%/doz-studio`, `~/Library/Application Support/doz-studio`, `~/.config/doz-studio`) with a one-time migration from `studio/.local.json`; secrets are stripped from the legacy file once the copy is verified.
- `server/app.js`: `startServer()` is callable as a module, falls back across ports when 4317 is taken, and writes `runtime.json` with the port actually used.
- `electron/main.js` (new) + `electron-builder` config: Windows NSIS installer, `contextIsolation`/`sandbox` on, external links handed to the OS browser, single-instance lock. `plugins/` and `web/dist` ship as `extraResources`.
- `.github/workflows/desktop-build.yml` (new): verify job (i18n check, tests, `npm audit`) then a packaging matrix; actions pinned to full SHAs; the macOS slot is prepared but not built.

### Studio: two languages

- `web/src/i18n/` (new): own i18n layer, no new dependency. 613 keys per locale, English default and fallback, language chosen in the Setup wizard and Settings.
- Server-produced text moved to ~80 `code` + `params` pairs translated on the client, so `/api/setup`, runner chips, run/engine errors and API errors are language-neutral on the wire.
- `scripts/i18n-check.js` (new): fails on missing translations, mismatched placeholders, unpaired plural forms and hardcoded strings. Runs in CI.

### Studio: one-click updates

- `server/services/updateService.js` + `routes/updateRoutes.js` + `infra/update{Keys,Config}.js` (new): `/api/update/{status,check,apply,settings}`. Manifests are ed25519-signed and verified before a single byte is downloaded; per-file sha256; HTTPS enforced on the endpoint, `baseUrl`, every file URL and every redirect hop; path traversal, symlinks, hardlinks and Windows device names rejected; staging → backup → write → rollback, with `UPDATE_ROLLBACK_INCOMPLETE` keeping the backup when rollback fails.
- Fail-closed by design: `PUBLIC_KEYS` ships as a placeholder, so every manifest is rejected until the product owner fills in a real key. `tests/releaseKeys.test.js` fails a tag build while the placeholder is still there.
- `scripts/keygen.js` (new): generates the signing pair on the owner's machine, refuses to write the private key inside the repo, prints only the public key.
- App version (binary) and content version (plugins + web) are reported separately, and `minAppVersion` stops a content update from landing on an app too old to run it.
- `web/src/features/update/` + `hooks/useUpdate.js` (new): Updates button with a badge, release notes, the list of files the buyer edited with an overwrite choice, and a configurable endpoint in Settings.

### Security (audit: 0 critical, 0 high, 2 medium, 5 low — all fixed)

- `server/infra/apiKeyStore.js` (new) + `electron/main.js`: the Anthropic API key is encrypted with Electron `safeStorage` (DPAPI on Windows) and only the ciphertext is stored; without a codec it falls back to plain text with a warning in the log. The previous `mode: 0o600` comment claimed protection that does not exist on Windows.
- `server/lib/secretEnv.js` (new): the key studio injects is no longer passed to shell-action and git child processes; `claude -p` still receives it.
- `server/http/static.js`: CSP, `X-Content-Type-Options`, `Referrer-Policy`, an `isInsideDir` boundary check, and a fix for a malformed `decodeURIComponent` that returned 500.
- `DOZ_UPDATE_ALLOW_HTTP` now only applies under the test runner.

### Docs & packaging

- `README.md`, `CHANGELOG.md`, `studio/README.md`, `agent-usage/**`, `docs/desktop-install.md` translated to English.
- `LICENSE.md` (new): personal and commercial use by the purchaser, no redistribution or resale.
- `.gitignore`: `dist-electron/` and release zips.
- Tests: 179 passing, 2 pre-existing Windows path failures, 2 skipped.
- `plugin.json` and `studio/package.json`: version 2.0.0.

## [1.20.0] - 2026-09-28

Source: a user request for first-time setup (connecting a Claude account until `claude -p` works, testing the API key, testing the GitHub account, etc.) before studio is used.

### Studio

- `server/services/setupService.js` + `routes/setupRoutes.js` (new): checks for Node, git (+ filling in the global identity), Claude Code installed & logged in (`claude auth status`), the doz-agent plugin, the API key, the doz-agent repo & the project; real tests of `claude -p` (haiku), the Claude API (haiku, 16 tokens), and GitHub access (`git ls-remote`); triggers `claude auth login` (Claude account or Console); SDK error messages are translated (401/403/429/connection).
- The API key can be set for the session or remembered in `studio/.local.json` (gitignored); it's used automatically at startup; the API client is reset when the key changes (`runners/api.js`: `resetClient`, `testApiConnection`).
- `web/src/features/setup/` (new): a 5-step Setup wizard that opens automatically the first time and from the Setup button in the top bar (a yellow dot while incomplete); the Finish button activates once Node & git are fine and at least one AI brain passes its test.
- Tests: `test/setup.test.js`; 43 tests in total.
- `plugin.json`: version 1.20.0.

## [1.19.0] - 2026-09-28

Source: a user request to be able to push and pull to GitHub directly from Doz Studio.

### Studio

- `server/services/gitService.js` + `routes/gitRoutes.js` (new): status (branch, upstream, ahead/behind, changed files, last commit), fetch, pull (`--rebase --autostash`), commit all changes, push (creating the upstream if absent, never force). The target is `repo` (doz-agent) or `workdir` (the active project). Tokens in the remote URL and in git messages are masked. `GIT_TERMINAL_PROMPT=0` so the server never waits on a password.
- `web/src/features/dialogs/GitDialog.jsx` (new) + a GitHub button in the top bar with a badge for the number of changed files; push asks for confirmation via a modal; after a pull/commit in the doz-agent repo, the agent/skill/workflow lists are reloaded.
- Tests: `test/git.test.js` using a local bare remote (commit → push → pull in another clone, autostash, a branch with no upstream, token masking). 39 tests in total.
- `plugin.json`: version 1.19.0.

## [1.18.0] - 2026-09-28

Source: user feedback on the studio UI (16 points: snap grid, modern dropdowns, logo/favicon, hover menu, light/dark theme, document attachments, Claude Code usage, modals replacing alerts, a folder picker, etc.) and a request to apply the [everything-claude-code](https://github.com/worldflowai/everything-claude-code) patterns so the FE is modern and the BE readable/SOLID. The agent files did not change.

### Studio: backend (`studio/server/`)

- Split per layer: `app.js` (composition root), `http/` (router, localhost middleware, `{ success, data | error }` responses, zod schemas, static, socket), `routes/`, `services/`, `repositories/`, `domain/`, `runners/`, `infra/`, `lib/`.
- The engine is split into `graph.js` (pure functions), `executors.js` (per node type), `engine.js` (orchestration); run state is no longer mutated.
- Engine bug fix: a node that becomes ready after another node is skipped within the same pass is no longer missed (e.g. the "clean" path in the audit workflow).
- The `claude-cli` runner: the prompt goes via stdin, agent definitions via a temporary file (short arguments, safe on Windows `claude.cmd`), and it records `rate_limit_event`.
- New: document attachments (`/api/attachments`, md/txt/code/docx text is inlined, pdf/images go by path), Claude Code usage (`/api/usage`: the 5-hour & 7-day limits + local tokens from `~/.claude/projects`), a folder browser (`/api/folders`).
- A structured JSON logger, `ApiError` + a central error handler, and the API runner's `bash` tool using the same `shell.js`.
- Tests: 34 (unit, API integration, the runner with a fake `claude`, workflow templates), line coverage ~89%.

### Studio: frontend (`studio/web/`)

- Dark & light themes (following the system or set manually), colour tokens in `styles/tokens.css`.
- A new logo (a robot + a 4-step flow) in the menu and as the favicon.
- The left menu: an icon rail that expands on hover and narrows when you leave; Editor | Executions tabs inside the menu; drag-and-drop on a small screen; the "edit" tag removed.
- The canvas: snap to a 20px grid, pan with a left click, Shift+drag to multi-select.
- Custom dropdowns (Select/Combobox) and modals (confirm/prompt), fully keyboard-operable; the built-in `alert`/`confirm`/`prompt` removed.
- A file-manager-style folder picker for the project folder and source folders; the top bar no longer stacks on a small screen.
- The run dialog can attach documents; a Claude Code usage widget in the top bar; a New Workflow dialog built from templates.
- Titles use Title Case; a per-feature structure (`components/ui`, `features/*`, `hooks`, `lib`, `state`, `styles`), lazy-loaded dialogs, an ErrorBoundary.

### Plugin

- `plugins/workflows/`: new templates `perbaikan-bug`, `fitur-lengkap`, `audit-keamanan`, `rilis`.
- `plugin.json`: version 1.18.0.
- `.gitignore`: `studio/.usage.json`.

## [1.17.0] - 2026-09-28

Source: a user request for an n8n-style studio UI (dark grey, Figma-style canvas panning), active-blue/finished-green status carried through to the edges, managing agents/skills/actions from the UI, and per-node detail (tokens, duration, history, file diffs, the CLI command). The agent files did not change.

### Studio (`studio/`)

- The UI rewritten in the n8n style: a left palette (search, drag, `+` to create, a pencil to edit, source folders), Editor/Executions tabs, a dotted-grid canvas with Figma-style navigation, box nodes labelled below + wide agent nodes, resizable sticky notes, a floating Run button.
- Run status: a running node pulses blue with an animated blue edge, nodes/edges already passed turn green, unselected branches dim; live duration, live tokens, the execution count, and the file count below the node.
- The Logs panel: a node tree + per-node detail (Info + execution history, Input, Output, Files + a diff loaded on selection, a copyable CLI Command, Activity).
- The component editor: create/edit agents, skills, actions (Form mode changes frontmatter keys one at a time, Raw mode the whole file), showing which workflows use it.
- Source folders are configurable (`plugins/*`, `{workdir}/.claude/*`, `~/.claude/*`, etc.).
- A new `action` node: a shell command in the project folder, exit code 0 = PASS, read directly by a condition.
- Server: `library.js` (read/write components from several folders), `gitdiff.js` (a working-tree snapshot per node via a temporary index), `runners/shell.js`; the runner sends the command it displays, live tokens, and the files written; `claude -p` uses `--plugin-dir plugins`.

### Plugin

- `plugins/actions/` (new): `cek-perubahan.md`, `jalankan-test.md`.
- `plugins/workflows/README.md`: the `action` node, sticky note sizing, the stored-action format.
- `skills/engineering/run-workflow/SKILL.md`: running action nodes via Bash; conditions using an action's exit code.
- `plugin.json` & `marketplace.json`: version 1.17.0.

## [1.16.0] - 2026-09-28

Source: a user request for an n8n-style GUI (boxes + edges) so agent flows can be designed, configured, and watched live, with the brain coming from Claude Code or an API key. Flows are stored as separate workflow files; the agent files did not change.

### Workflows (`plugins/workflows/`, new)

- `README.md`: the format specification (start/agent/skill/condition/approval/info/output nodes, `when`/`loop` edges, node settings > defaults > agent > built-in, the `.doz-studio/runs/` progress log).
- `fitur-kecil.md`: an example PO → BE → QA with a fix loop capped at 2 rounds and an info node.
- `review-pr.md`: an example code review ∥ security review (read-only) → human approval.

### Skills (`plugins/skills/engineering/`)

- `run-workflow/SKILL.md` (new): runs a workflow file from Claude Code without studio (parallelism, conditions via VERDICT, loops, approvals via AskUserQuestion) and writes JSONL progress for studio.

### Studio (`studio/`, new, not installed)

- A local Node server (127.0.0.1): the graph engine (parallelism, branches, loops, approvals, retry, timeout, budget), the `claude-cli` runner (`claude -p --agents/--agent`, stream-json) and the `api` runner (the Claude API + local tools sandboxed to the workdir), JSONL run logs + a watcher for runs started from the terminal.
- A React Flow UI: an agent/skill/node palette, settings panels per node and per workflow, live status/activity/cost per box, a log & output panel, approval buttons.
- `npm test`: tests for the engine, validation, settings, CLI arguments, and the API tool sandbox.

### Other

- `README.md`: the Visual workflows section, the `run-workflow` skill, the `studio/` and `plugins/workflows/` structure.
- `plugin.json` & `marketplace.json`: version 1.16.0, 12 skills.
- `.gitignore`: `studio/node_modules`, `studio/web/dist`, `studio/.local.json`, `.doz-studio/`.

## [1.15.0] - 2026-09-25

Source: an audit of one large `ship-feature` workflow (8 requests, 4 slices, BE+FE, ≈ $41), see [`agent-usage/2026-09-25.md`](agent-usage/2026-09-25.md). The main problems: agents stopped at `maxTurns` with no report 6 times, an engineer was handed 4 slices at once without a `too-big`, continuations via SendMessage cost ~$13, and bugs slipped through self-review. Every change is general (not specific to one project). Agent frontmatter did not change.

### Agents (`plugins/agents/`)

- `backend-engineer.md`: a turn checkpoint at ~35 tool calls → a `Status: partial` report; a quantitative too-big check (>1 slice or >~15 non-test files); `blocked: env` and `blocked: cannot reproduce` under Verification; self-review: a new status column → grep every query on that entity, an AC with ≥2 conditions tested per condition, aggregate endpoints using the underlying resource's permission; a Status template + `partial`.
- `frontend-engineer.md`: a turn checkpoint at ~35 → `partial`; a quantitative too-big check; `blocked: env`/cannot reproduce; self-review: ACs with ≥2 conditions, map-shaped state merged, style overrides (inline style vs `:hover`), data by id fetched through the by-id endpoint; a Status template + `partial`.
- `devops-engineer.md`: a turn checkpoint at ~28 → `partial`; a Status template + `partial`.
- `product-owner.md`: the search budget tied to a checkpoint at ~10 tool calls.
- `system-analyst.md`: a turn checkpoint at ~17; the spec skeleton (headings + slices) written up front; the spec template gains a `Slices` section, `[S1]` tags in the file map, and file owners when there's >1 engineer per layer; an execution plan of one engineer call per slice.
- `code-reviewer.md`: a diff of >~25 files → logic files first; a turn checkpoint at ~17 → a report with `Not reviewed`.
- `security-tester.md`: a turn checkpoint at ~21 → a report with `Not reviewed`; A01 + aggregate endpoints; A08 + prototype pollution (user-controlled keys).
- `qa-tester.md`: a turn checkpoint at ~28; environment unavailable/cannot reproduce goes under `Not covered`; an AC with ≥2 conditions = one test per condition; `Recommendation` + `Cannot decide yet`.

### Skills (`plugins/skills/engineering/`)

- `ship-feature/SKILL.md`: step 1 asks the user to log in in the browser when there's a visual AC and browser tooling (no browser → "visual not checked"); the brief template gains `Slices` and slice tags in the file map; file owners when there's >1 engineer per layer; one engineer call = one slice, parallel only when the file maps don't overlap; a `partial` status is continued via SendMessage; a diff of >~25 files → code-reviewer split per layer/module.
- `frontend-patterns/SKILL.md` §9: object lookups with user-controlled keys use `Map`/`Set`/`Object.hasOwn`.
- `backend-patterns/SKILL.md`: §2 lower and upper bounds for every numeric query param (400) + an offset without overflow; §4 response DTOs containing only the fields consumers use.
- `backend-patterns/references/dotnet.md`: the `CreateAsync` example no longer calls `BeginTransactionAsync` directly (it conflicts with `EnableRetryOnFailure`); the manual-transaction rule via `CreateExecutionStrategy().ExecuteAsync`; pagination validating the `page` and `pageSize` bounds.
- `token-audit/SKILL.md`: falls back to `python` when `python3` is absent; documents the `(continued-maxTurns)`/`(next slice)` labels, the maxTurns status, and the new categories.

### The `token-audit/scripts/token_audit.py` script

- Output forced to UTF-8 (`reconfigure`), so it no longer crashes with `UnicodeEncodeError` on a cp1252 Windows console.
- The `Status:` regex recognises `partial`.
- A run that hit `maxTurns` (an "N-turn limit" notification, or a turn count at the limit with no Status/decision line) shows as "⚠ stopped at maxTurns", feeds the "Nearly out of turns" signal, and has its own suggestion.
- Continuation labels: after maxTurns → `(continued-maxTurns)`; after `done` with a prompt containing "slice" → `(next slice)`. Neither counts as a "report sent back".
- Finding categories: matched from the text without severity labels and at word boundaries (previously `"lock"` matched "blocking" and `"race"` matched "traceId", so many findings landed wrongly in transaction/concurrency). New categories `aggregate-authz`, `state-update`, `css-cascade` at the very top.
- `max_turns_of` closes the file it reads.

### Repo

- `plugins/.claude-plugin/plugin.json`: version 1.14.0 → 1.15.0.
- New: `CHANGELOG.md` (this file), `agent-usage/README.md` (the usage log format), `agent-usage/2026-09-25.md` (the audit that triggered this version).
- `README.md`: the repo structure + `CHANGELOG.md`, `agent-usage/`, `tests/`; the `partial` status and turn checkpoints under the agent report format; the release step of writing a changelog entry and a tag.

### Tests

- New: `tests/test_token_audit.py` (12 tests: categories, continuation labels, the maxTurns status, cp1252 output). Run with: `python3 -m unittest discover -s tests`.
