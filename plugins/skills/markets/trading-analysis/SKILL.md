---
name: trading-analysis
description: Use when the user asks whether to buy, sell or hold a stock, crypto, forex pair or commodity, wants news sentiment on a ticker or company, asks how politics, rates, the rupiah, commodities or a war affect a price, asks if a move is already priced in ("udah naik belum"), or wants entry, stop-loss and target prices ("harga beli", "harga jual", "cuan").
---

# Trading Analysis — how a disciplined discretionary trader works

The method behind the `trading-analyst` agent. It mirrors a trader's desk routine: **context → macro & politics → catalyst → reaction → structure → plan → journal**. Macro sets the tide, news tells you *why* one asset might move, price tells you whether the market already agrees. A plan without a stop and a size is not a plan.

## Non-negotiables

1. **Numbers come from tools, never from memory.** Every price, level, rate and % comes from `scripts/price_check.py` or a fetched page with its date. Model memory of prices, rates, governments and wars is stale.
2. **Every news or macro item has a date and a source.** No date → not used. High-materiality items need **two independent outlets** (one wire story copied by ten sites is one source).
3. **Sentiment is measured against expectations, not in absolute terms.** "Profit up 10%" is negative if consensus was +20%; a rate cut is old news if it was fully expected. No expectation found → lower confidence.
4. **A story without a channel doesn't count.** A war, an election or a tariff matters to this asset only through a channel (oil, currency, flows, a regulation, demand). Name the channel or drop the factor.
5. **No trade is a valid answer.** R:R below 2, no clear stop level, illiquid, a binary event (election, central-bank decision) inside the holding period with no edge, or news and price disagree with no explanation → `WAIT` or `AVOID`.
6. **Analysis, not execution.** Never place orders, never ask for broker logins. The output is a scenario plan the user decides on; say once, at the end, that it isn't financial advice.

## Step 0 — Scope (assume, don't interrogate)

Fill from the request; otherwise use the default and list it under Assumptions:

| Field | Default |
|---|---|
| Market + symbol | Resolve to a Yahoo symbol: IDX `BBCA.JK`, US `AAPL`, crypto `BTC-USD`, forex `EURUSD=X`, gold `GC=F`. Index: IHSG `^JKSE`, S&P 500 `^GSPC`, Nasdaq `^IXIC`, crypto bench `BTC-USD` |
| Horizon | Swing, 1–4 weeks (daily chart, news from the last 14 days, macro from the last 30) |
| Risk per trade | 1% of capital. Capital unknown → size per Rp10,000,000 (or $1,000) **of capital**, i.e. Rp100,000 ($10) at risk |
| Position | Flat (no holding). If the user holds it, switch to Mode B |

Read [references/market-rules.md](references/market-rules.md) when the market is IDX (lots, tick sizes, auto-rejection, settlement).

## Step 1 — Market context and numbers (1 tool call)

Run the price script for the symbol with its benchmark, 2–3 sector peers and the macro preset (`idx`, `us`, `crypto`, or your own comma list, e.g. add `BZ=F` for an oil name):

```
python -I "<base directory of this skill>/scripts/price_check.py" BBCA.JK --bench ^JKSE --peers BBRI.JK,BMRI.JK --macro idx --range 1y
```

Read off: is the **benchmark** above or below MA50/MA200 (risk-on/off)? Is the **sector** moving with it? What's the symbol's **beta** to the benchmark? During market hours the last row is today's live price, not a close; the latest session can also be missing — state the date you actually have. If the script fails, read [references/data-sources.md](references/data-sources.md) for fallbacks.

**Data conflicts**: the script is the source for every computed number (MA, ATR, levels). When a dated press source gives a different close by more than ~1%, keep the script's number, list the conflict under "Data conflicts" in the report, and drop confidence one level if the conflicting bar sets a level or the priced-in reading.

## Step 2 — Macro, politics and geopolitics

Read [references/macro-factors.md](references/macro-factors.md) and work its factor list (monetary policy, currency, data, fiscal, domestic politics, regulation, geopolitics, trade, commodities, risk appetite, flows, calendar, fundamentals) through the sector map:

1. Keep the factors with a channel to this asset; for IDX that's usually 4–6 of them.
2. Find each one's **current state, direction and next scheduled event** with a dated source. A slow-moving factor (politics, fiscal, a trade dispute) with no news inside the 30-day window may use an older source if the issue is still unresolved: mark it `standing, <date>` and cap its materiality at Medium. Batch the searches: one query per factor group, e.g. `Bank Indonesia rate decision <month year>`, `Indonesia politics market <month year>`, `<commodity> price outlook <month year>`, `<conflict or tariff> markets <month year>`.
3. Check the `--macro` block: |corr| or |lag1| ≥ 0.3 means the market is trading that factor now. A loud story with corr ≈ 0 is noise for this asset.
4. Score each kept factor as a scorecard line (format in the reference): Tailwind / Headwind / Neutral, materiality, already priced or not.
5. Net it into a **macro regime**: supportive / neutral / hostile. Hostile → smaller size or wait, even for a good company.

## Step 3 — Company catalyst search

Query pattern, newest first, within the horizon window:

- `"<company>" <ticker> news`, then `"<company>" earnings OR guidance OR downgrade OR upgrade OR dividend OR rights issue`.
- One aggregator fetch (Google News RSS, see data-sources) to see coverage across outlets; then open the originals for the facts that matter.
- IDX: the company's disclosures (keterbukaan informasi) and Indonesian outlets; US: SEC filings (8-K) and earnings dates.
- **Fundamentals snapshot**: P/E, P/BV, dividend yield vs its own history and peers, from a dated page (macro-factors M13). If the quote is older than the last price, scale it by `last price / price on the quote date`, mark it `scaled from <date>`, and don't scale across an earnings release.
- **Next scheduled event**: earnings, ex-dividend, RUPS, index rebalancing, token unlock. A trade that spans it carries gap risk; say so.

Keep only items that could change cash flows, ownership, regulation or flow. Drop "stock X rises 3%" recaps: they describe the move, they don't cause it.

## Step 4 — Classify sentiment

Read [references/sentiment-rubric.md](references/sentiment-rubric.md) and score each company item, one line per item:

`N1 | 2026-10-28 | Reuters + Kontan | Q3 net profit +18% vs consensus +12% | Positive | High | Surprise +`

Net it: the **highest-materiality item dominates**; several low items don't outvote one high item. Then combine with Step 2: **company sentiment × macro regime**. Positive company news in a hostile regime = a smaller, later trade; negative news in a supportive regime = often a dip that gets bought, but only if Step 5 says the selling has stopped.

## Step 5 — Is it priced in?

Rerun the script with `--since <date of the main catalyst>` (or put `--since` in the Step 1 call if you already know the date). Judge with numbers:

| Reading | Signal |
|---|---|
| Move since catalyst < 1 ATR, volume ≤ 1.2× avg | **Not priced in** — the market hasn't reacted yet, or doesn't believe it |
| 1–3 ATR in the news direction, volume > 1.5× | **Partly priced in** — reaction under way; enter only on a pullback |
| > 3 ATR, RSI > 70 (or < 30 on bad news), near the period high/low | **Fully / over-priced** — late; chasing is the trap |
| Price moved **against** the news | **Divergence** — either the news was expected (buy the rumor, sell the news), macro overpowered it (check Step 2's corr), or there is information you haven't found. Don't trade it until you can explain it |

Also check whether the move started **before** the news date (leak or anticipation → more of it is priced in), and do the same for the main macro factor: if its proxy moved weeks ago and the stock already followed, the macro story is priced in.

## Step 6 — Chart comparison

From the same script output:

- **Trend**: price vs MA20/50/200 and the order of the MAs. Above all three and stacked = uptrend; below all = downtrend; mixed = range.
- **Relative strength**: 20d RS vs benchmark and peers. Leaders (RS > 0 while the index falls) make better longs; laggards make better shorts or avoids.
- **Levels**: support = recent swing lows / 20d and 60d lows / MA50; resistance = swing highs / 20d and 60d highs / period high. Round numbers matter in IDX.
- **Momentum**: RSI 40–60 neutral, > 70 stretched, < 30 washed out. RSI alone is never the reason.
- **Volume**: a breakout on < 1× average volume is suspect.

## Step 7 — The trade plan

Build it in this order; each number cites the level it came from:

1. **Bias**: long / short-or-avoid / none, from Steps 1–6. Write a one-sentence thesis that names the company catalyst *and* the macro regime ("Q3 beat not priced in, leader in a weak sector, rates now a tailwind").
2. **Entry zone**: at support for a pullback entry, or just above resistance for a breakout — not "current price" by default. Round to the market's tick size.
3. **Stop-loss**: below the structure that invalidates the thesis (swing low, MA50), at least 1 ATR from entry so normal noise doesn't hit it.
4. **Targets**: TP1 at the next resistance, TP2 at the one after. Take part off at TP1 and move the stop to entry.
5. **R:R** = (TP1 − entry) / (entry − stop). **< 2 → no trade**, or a better entry that fixes it.
6. **Size** = (capital × risk%) / (entry − stop), rounded down to the lot size. Halve it in a hostile macro regime or when a binary event falls inside the horizon. Show the arithmetic.
7. **Invalidation**: the price, company event or macro trigger that kills the idea before the stop hits ("close below 4,700", "BI hikes", "IDR above 18,500").
8. **Time stop**: if neither target nor stop is hit within the horizon, exit and reassess.

## Modes

- **A — Analyze (default)**: Steps 0–7 for one symbol.
- **B — Review a position**: the user holds it at a known entry. Same steps, but the output is Hold / Trim / Exit / Add, with the stop moved to the current structure. The entry price is irrelevant to the decision (sunk cost); only what happens next matters — say so if the user anchors on it.
- **C — Scan a watchlist (≤ 8 symbols)**: Step 1 for all (one script call with `--peers` and `--macro`), Step 2 once for the shared market, one news search per symbol, rank by setup quality, full plan only for the top 2.

## Step 8 — Journal

Write the report to `trading-journal/<YYYY-MM-DD>-<symbol>.md` in the working directory (create the folder). If a journal for the same symbol exists, read the latest one first and add a **Review** line: what the last plan said, what price did, and whether the thesis (company and macro) held. That loop is how a trader gets better; skip it only if the user says not to save.

## Traps actually hit

| Excuse | Reality |
|---|---|
| "The news is very positive, so buy" | Positive news after a 4-ATR run is often the top. Step 5 decides, not Step 4 |
| "It already dropped 40%, it's cheap" | A falling price below MA200 with negative RS is a downtrend, not a discount. Wait for structure |
| "There's a war, so everything falls" | Only through a channel. Coal and gold names can rise on the same headline. Check the corr |
| "Rates will be cut, banks will fly" | If the cut is consensus, it's in the price. The surprise is what moves it |
| "Politics is noise" | Not on IDX: elections, cabinet changes and sudden regulation re-price whole sectors. Score it |
| "I'll set the stop later" | No stop → no size → no plan. Write it now |
| "Target +20%" | A target is a level on the chart, not a wish. Name the resistance |
| "Only one article, but it's big" | One source = low confidence. Find a second independent outlet or downgrade |
| "The last price / rate I remember is…" | Run the script, search the date. Memory is stale |
