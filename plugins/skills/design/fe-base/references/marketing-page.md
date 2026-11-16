# Marketing pages — anatomy, copy, and the generated tells

Read this when the §0 mode is **marketing / brand**: a landing page, a product or launch page, a site for a shop, studio, event or creator. App screens and dashboards don't need it. `fe-base` still applies; this adds what a page that has to sell needs. Ideas adapted from Hallmark (https://github.com/Nutlope/hallmark, reviewed 2026-11-16; MIT, `LICENSE-hallmark.md`), restated in original wording; `fe-scroll` takes over for scroll-driven experience pages.

## 1. Build around the visitor's job

Name the one thing a visitor came to do, then let it set where the action sits and how the page ends. The software-landing shape (hero, logo bar, three feature tiles, numbers band, email field) fits almost nothing else.

| Job | The action | Sections that belong | Ends with |
|---|---|---|---|
| Sign up (SaaS, API, dev tool) | "Start free" in nav + hero, terms in one line under it; for a dev tool the install command can be the action | The product at work (real screens), what it does as named moments, a code sample or integration, pricing with a period switch, FAQ | The hero action again, or the code sample. Never a newsletter |
| Buy (a product, a small shop) | Product + price + options, often as the hero; a sticky price bar on long pages | The range with prices, the product in use up close, how it's made, delivery and guarantee as plain facts, reviews only if real | The offer again or new arrivals; email only in the footer |
| Book (restaurant, clinic, class) | A date/time picker from nav and hero, or the next free slots as buttons | The room or food as a photo, the menu or timetable, hours and address as their own section | Hours, address, booking again |
| Visit (shop, gallery, venue) | Today's hours and address in nav or hero | What's on now, what's coming as dated rows, getting there | Visit info and address |
| Attend (event, conference) | Tickets in the nav from the first screen; date + place are the headline | Lineup/speakers set large, schedule by day, ticket tiers with prices, venue, FAQ | Tickets again |
| Try (app, game, desktop tool) | Store/download buttons under the headline, one per real platform | Key art or real screens, features as moments shown in screens (not icon tiles), before/after | Download again beside one last screen |
| Hire (studio, freelancer) | A plain contact (email, phone) in nav and after the work; no form needed | The work *is* the page: projects with client, year, pictures; one opened as a case | Contact details |
| Join / subscribe | Join, first visit, or the email field — often the hero itself | A sample issue or a session shown, schedule, membership rows with prices | The one job whose close may be an email field |

The nav carries the job's own verb (Book, Tickets, Shop, Start free). Proof comes in the category's own form — press quotes for a restaurant, client names for a studio — never a generic band of round numbers.

## 2. Copy

- **The swap test.** A headline that would also work on a competitor's page gets rewritten with a noun only this product has. "Software that works for you" fits anyone; "Invoices that chase themselves" fits one product.
- **Three tests per line:** can the reader picture it, could it be proven false, could only this business say it.
- **Subhead:** what it is, for whom, the one difference — twelve words or fewer.
- **Section heads say what the visitor gets** ("Three loaves a morning"), never a category label ("Features", "Why us", "Our story").
- **Budget:** headline ≤ 7 words, section head ≤ 6, a section intro one line, paragraphs two short sentences, ~450 visible words per page. Read only the headings and the hero: if they tell the story, the rest is the right length.
- **Buttons are the verb of the action** ("Book a fitting", "Download for Mac"). "Learn more →" and "Get started" on every block are tells.
- **Indonesian pages:** the same rules; write how the owner would say it to a customer ("Pesan meja", not "Lakukan reservasi sekarang juga!").

## 3. The generated tells — remove on sight

| Tell | Instead |
|---|---|
| Buzzwords: seamless, robust, empower, unlock, elevate, supercharge, game-changer, journey, "Say goodbye to…", "Whether you're X or Y", "It's not just X, it's Y" | The concrete noun and verb |
| Triads of adjectives ("fast, simple, powerful") | One specific claim |
| A tracked-caps eyebrow over every section ("FEATURES", "HOW IT WORKS") | Nothing, or a label that carries a real fact (a date, an issue number). Small caps stay fine in app chrome (sidebar group labels) |
| One word per heading in the accent colour or italics | The whole heading in one style |
| The framework's default palette (Tailwind indigo-500, a purple→blue gradient) | The brand's own accent; on a marketing page the accent covers ~5% of the viewport |
| Inter or Roboto as the display face | A display face with character; Inter is fine for body |
| Emoji as icons; a hand-drawn browser window or phone frame around a fake UI | One icon set; **screenshots of the real product** when it runs |
| Middle-dot meta strings ("Fast · Secure · Free"), decorative status dots | A real sentence, or nothing |
| An email sign-up band as the reflexive last section | The job's own ending (§1) |
| Staggered fade-up on every block | One reveal at most; content visible without JavaScript |

## 4. Honest content

- **A missing fact** (price, venue, date) is a visible text slot ("Venue to be announced", muted, dashed outline), at most two per page, listed in the report. Never an invented value.
- **A link with no known URL** points at the section of this page that does the most of it (`#pricing`), never an invented route.
- **A form with no endpoint** says plainly that nothing was sent and never shows "Sent!". A success state with no request behind it is a fake send.
- Sample data looks like samples (`example.com`, "Example Kitchen", round amounts), never a figure a visitor could take as a claim.

## 5. Before handing over

Score the page 1–5 on each: **hierarchy** (one thing first), **specificity** (passes the swap test), **restraint** (nothing decorative competing), **execution** (spacing, type, states). Name the weakest axis and what you changed; any axis under 3 → revise before handover. Then check at 1280×800 that the headline, subhead and primary action are all visible without scrolling.
