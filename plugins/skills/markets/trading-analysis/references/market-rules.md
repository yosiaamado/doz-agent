# Market rules and data sources

Last reviewed: 2026-11-03. Exchange rules change: **verify on the exchange's own site before using a rule in a plan**, and mark anything you couldn't verify `⚠ NEEDS VERIFICATION`.

Data and news sources: [data-sources.md](data-sources.md).

## IDX (Bursa Efek Indonesia)

- **Lot**: 1 lot = 100 shares. Sizes round down to whole lots.
- **Tick size (fraksi harga)**, regular market — verify, last widely published schedule:

| Price (Rp) | Tick (Rp) |
|---|---|
| < 200 | 1 |
| 200 – < 500 | 2 |
| 500 – < 2,000 | 5 |
| 2,000 – < 5,000 | 10 |
| ≥ 5,000 | 25 |

- **Auto-rejection (ARA/ARB)**: daily price limits that differ by price band and have been changed several times since 2020. ⚠ NEEDS VERIFICATION on idx.co.id before quoting a limit. In a plan, a stop or target beyond today's limit can't fill today — note it.
- **Settlement**: T+2.
- **Session**: Mon–Fri, roughly 09:00–16:00 WIB with a midday break (shorter on Friday). Verify current hours.
- **Board**: stocks on the special-monitoring board (papan pemantauan khusus) trade in a call auction — thinner liquidity and gaps. Flag it.
- **Flows worth checking**: net foreign buy/sell and broker summary are widely used locally. Use them only if you find a dated source; never estimate them.

## US equities

- Regular session 09:30–16:00 ET; pre/post-market moves on earnings are common, so the daily gap matters.
- Pattern-day-trader rules apply to small margin accounts; irrelevant for swing plans.

## Crypto

- 24/7, no limit-up/down; the daily candle closes at 00:00 UTC on Yahoo.
- Benchmark: `BTC-USD` for alts; for BTC itself use `^IXIC` as a risk-appetite gauge.
