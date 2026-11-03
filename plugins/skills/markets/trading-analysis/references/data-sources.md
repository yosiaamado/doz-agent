# Data and news sources

Read at Step 1 when the price script fails, and at Steps 2–3 to pick sources. Tested from a Windows machine on **2026-11-03**: "works" means it returned data that day, not that it always will. If a source errors, move to the next one in its row group; never fill in a number you didn't fetch. Never try to get past a captcha or browser check.

## Prices

| Source | Endpoint | Status 2026-11-03 | Notes |
|---|---|---|---|
| Yahoo Finance chart | `query1.finance.yahoo.com/v8/finance/chart/<SYM>?range=1y&interval=1d` | works | Used by `price_check.py`. Stocks (`.JK`, US), indexes, crypto (`BTC-USD`), FX (`IDR=X`), futures (`CL=F`, `GC=F`, `HG=F`, `BZ=F`, `NG=F`), yields (`^TNX`, `^IRX`), `DX-Y.NYB`, `^VIX`, `EEM`, `000001.SS`, `^HSI`. Unofficial, needs a User-Agent |
| Binance public data | `data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=200` | works | Crypto OHLCV; `api.binance.com` returned nothing from this machine (region) |
| CoinGecko | `api.coingecko.com/api/v3/coins/<id>/market_chart?vs_currency=usd&days=90&interval=daily` | works | Close + volume only; free tier is rate-limited |
| Frankfurter (ECB rates) | `api.frankfurter.dev/v1/latest?from=USD&to=IDR` | works | Daily reference FX; the old `.app` domain redirects |
| Stooq CSV | `stooq.com/q/d/l/` | blocked (browser check) | Don't use |

## Macro data

| Source | Endpoint | Status 2026-11-03 | Notes |
|---|---|---|---|
| World Bank | `api.worldbank.org/v2/country/IDN/indicator/<ID>?format=json&mrv=4` | works | Annual: inflation `FP.CPI.TOTL.ZG`, GDP growth `NY.GDP.MKTP.KD.ZG`. Slow-moving context only |
| FRED | `fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10` | timed out here | US series (DGS10, FEDFUNDS, CPIAUCSL). Try via WebFetch; Yahoo `^TNX` covers the 10Y |
| Bank Indonesia | bi.go.id (BI Rate, JISDOR, monetary policy statements) | timed out here | Tier 1 for BI Rate decisions; find the latest via search |
| BPS | bps.go.id | not tested | Indonesian CPI, GDP, trade balance releases |
| Economic calendar | search "economic calendar this week" + the country | — | Pick a dated page; note the next CPI, central-bank and jobs dates |
| Crypto Fear & Greed | `api.alternative.me/fng/?limit=7` | works | Crypto sentiment gauge only |

## News

Use at least **two independent outlets** for any High-materiality item. Wire stories republished by many sites count as one source.

| Source | How | Status 2026-11-03 | Tier |
|---|---|---|---|
| WebSearch | the agent's search tool, query patterns in SKILL.md Step 3 | — | depends on result |
| Google News RSS | `news.google.com/rss/search?q=<query>+when:7d&hl=id&gl=ID&ceid=ID:id` (English: `hl=en-US&gl=US&ceid=US:en`) | works | Aggregator: one fetch returns dated headlines from many outlets. Open the original article for facts |
| GDELT DOC API | `api.gdeltproject.org/api/v2/doc/doc?query=<q>&mode=artlist&format=json&timespan=7d` | rate-limited (1 request / 5 s) | Global news incl. geopolitics, with tone scores; one request per run |
| IDX disclosures | idx.co.id → Keterbukaan Informasi | API returned HTML here; open via WebFetch or search `site:idx.co.id <ticker>` | 1 |
| SEC EDGAR | `data.sec.gov/submissions/CIK<10-digit>.json` | works | 1. SEC asks for a User-Agent naming the requester |
| Company IR pages | the company's investor-relations site | — | 1 |
| Indonesian outlets | Kontan, Bisnis Indonesia, CNBC Indonesia, Katadata, IDX Channel, Investor Daily | — | 2 |
| Global outlets | Reuters, Bloomberg, Financial Times, WSJ, Nikkei Asia, CNBC | — | 2 |
| Official policy | central banks, ministries (Kemenkeu, ESDM, Kemendag), OJK, USTR, the White House, MOFCOM | — | 1 for what was decided |
| Forums, social media, stock-tip channels | — | — | 3: sentiment only |

## Fundamentals

No free API was tested. Fetch a dated page: the company's latest financial report (IDX or EDGAR), or a quote page showing P/E, P/BV and dividend yield. Write the page's date next to every ratio.
