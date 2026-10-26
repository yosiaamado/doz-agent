# Review and Improvement Modes

Read this when asked to review a design, screenshot or UI code against Apple's HIG, or to improve or "make it less generic". The principles and rules it checks against are in `SKILL.md`.

## 1. Review mode

When asked to review a design, screenshot or UI code:

1. **Context first:** platform, framework, audience, the artifact (and what it can't show — contrast needs real hex values, not a JPEG), the screen's single job.
2. **Five lenses, in order:** accessibility (failures are Critical) → platform conventions (usually High) → visual craft (High/Medium) → interaction (usually Medium) → wording (usually Medium).
3. **Numbers, not adjectives:** "12px `#AAAAAA` on white, 2.3:1, needs 4.5:1".
4. **Cite the HIG page or label it as judgment.** Never invent a guideline. HIG changes several times a year — open the current page (links in `platform.md` §6) before quoting it.
5. **Speak the user's framework** (`BottomNavigationBar`, not `UITabBarController`, in Flutter).
6. **Don't over-critique and don't flatten personality.** A strong design gets a short review that says why it's strong.

Report: Summary (rating Excellent / Good / Needs work / Critical issues, plus the design's one memorable thing) → Critical → Improvements (tagged High/Medium/Low) → Craft notes → What works → Platform notes. Each finding: **What** (with numbers) · **Why** (principle or HIG page) · **Fix** (concrete, in the user's framework). Include only sections with content.

## 2. Improvement mode

When asked to improve or "make it less generic": review first, then plan before touching layout — a 4–6 color set with roles and contrast figures, a restrained display face plus body face, a one-sentence layout, **one signature element** and why it belongs to this product, and at most one orchestrated motion moment. **Critique the plan: would you have produced the same plan for a different product?** Then it's a default — revise it and say what changed. Sequence the work: accessibility → conventions → craft → polish, and finish by checking the smallest width, keyboard focus, reduced motion/transparency and the largest text size.
