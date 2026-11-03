# Macro, politics and geopolitics — what moves the whole market

Read at Step 2. Last reviewed 2026-11-03. Factor *channels* below are stable; their current *state* (rates, who governs, which war, which tariff) changes weekly, so every state you write comes from a dated search result, never from memory.

## How to use this file

1. Go down the factor list. For each, ask: **is there a channel from this factor to this asset?** (the sector map below). No channel → skip it.
2. For the factors with a channel, find the **current state and its direction** (one dated source each), and the **next scheduled event** that could change it.
3. Check the numbers: the `--macro` block of the price script gives each proxy's trend and its 60-day correlation (`corr`, and `lag1` for factors that trade after the market closes, e.g. US data for IDX). |corr| ≥ 0.3 = the market is trading this factor now; < 0.15 = it isn't, whatever the story says.
4. Score each factor: **Tailwind / Headwind / Neutral**, materiality High/Med/Low, and whether it's **already in the price** (did the proxy move weeks ago and the stock already follow?).

A strong company in a macro headwind is a smaller position or a later entry, not a reason to ignore the headwind.

## The factors

| # | Factor | What to look at | Proxy (Yahoo) | Typical channel |
|---|---|---|---|---|
| M1 | Monetary policy | Central-bank decisions and the *expected* path (BI Rate, Fed, ECB, PBoC); minutes and guidance | `^TNX` (US10Y), `^IRX` (US 3M) | Lower rates → higher valuations, banks' margins narrow, property and consumer up; a surprise matters more than the decision |
| M2 | Currency | USD strength, the local currency, intervention | `DX-Y.NYB`, `IDR=X` | Strong USD / weak IDR → foreign outflow from IDX, pain for USD-debt and import-heavy firms, gain for exporters |
| M3 | Growth & inflation data | CPI, GDP, PMI, retail sales, jobs (US NFP), trade balance | — (calendar) | Hot inflation → higher-for-longer rates; weak growth → cyclicals down, defensives up |
| M4 | Fiscal policy | Budget/deficit (APBN), subsidies, tax changes, state-spending programmes, debt issuance | — | Spending lifts the sectors it targets; deficit fears lift yields and weaken the currency |
| M5 | Domestic politics | Elections and the run-up, cabinet changes (esp. finance minister), policy U-turns, protests, rule-of-law events, state-owned-enterprise and sovereign-fund decisions | — | Uncertainty → foreign selling and a risk premium; policy favouritism moves specific sectors and SOEs |
| M6 | Regulation & industry policy | Export bans or quotas (minerals), royalties, price caps, licensing, OJK/BEI rules, free-float or listing rules | — | Directly re-prices one sector; often announced with little notice |
| M7 | Geopolitics | Wars and escalation, sanctions, shipping chokepoints (Red Sea, Hormuz, Malacca), US–China relations | `CL=F`, `BZ=F`, `GC=F`, `^VIX` | Oil and gold up, risk assets down; trade-route risk hits shipping, importers, airlines |
| M8 | Trade & geo-economics | Tariffs, trade deals, export controls, China's demand (Indonesia's largest trading partner), commodity cycles, supply-chain relocation | `HG=F` (copper), `000001.SS`, `^HSI` | Tariffs hit exporters in the targeted chain; China slowdown hits coal, nickel, CPO; relocation lifts industrial estates |
| M9 | Commodities | The commodity the company sells or buys | `CL=F`, `BZ=F`, `NG=F`, `GC=F`, `SI=F`, `HG=F`; coal, nickel, CPO via dated news | Producers follow the price with a lag; users' margins move the other way |
| M10 | Global risk appetite | Equity volatility, EM flows, US tech | `^VIX`, `EEM`, `^GSPC`, `^IXIC` | VIX spike → EM and small caps sold first |
| M11 | Flows & positioning | Net foreign buy/sell, index rebalancing (MSCI, FTSE, LQ45, IDX80), ETF flows, lock-up expiries, large holders selling | — | Forced buying/selling moves price regardless of news; rebalancing dates are known in advance |
| M12 | Calendar & seasonality | Earnings season, dividend season and ex-dates, window dressing (year-end), Ramadan/Lebaran consumption, holidays | — | Predictable flow; already-known seasonality is usually priced in |
| M13 | Company fundamentals | Valuation vs its own history and peers (P/E, P/BV, dividend yield), earnings trend, debt, guidance | — (fetched) | Cheap + improving = room to re-rate; expensive + slowing = news must keep beating |

Crypto adds: ETF flows, stablecoin supply, exchange or protocol incidents, token unlocks, regulation (SEC, MiCA, OJK for Indonesian exchanges), and the crypto Fear & Greed index.

## Sector map (IDX) — which factors matter most

| Sector | Highest-sensitivity factors |
|---|---|
| Banks | M1 rates, M2 IDR, M11 foreign flow, M3 credit growth, M5 politics (SOE banks) |
| Coal, oil & gas | M9 coal/oil price, M8 China & India demand, M6 royalties/DMO, M2 (USD revenue) |
| Nickel, metals | M9 nickel/copper, M6 export bans and smelter policy, M8 EV/battery demand, China |
| Plantations (CPO) | M9 CPO price, M6 export levies and biodiesel mandates, weather (El Niño) |
| Consumer staples | M3 inflation and purchasing power, M12 Lebaran, M2 imported inputs |
| Property, construction | M1 rates, M4 infrastructure spending, M5 politics, SOE contractors' debt |
| Telco, tech | M1 rates (growth valuations), M10 risk appetite, M6 regulation |
| Exporters / importers | M2 currency, M8 tariffs |

For US stocks swap in: Fed path and US10Y, earnings season, sector ETFs (`XLF`, `XLE`, `XLK`), tariff and antitrust news.

## Scorecard line (goes into the report)

`M7 | Geopolitics | Red Sea attacks resumed (Reuters 2026-10-30) | Headwind | High | lag1 corr to CL=F 0.31 | partly priced: oil +7% in 20d`

## Background reading (for the method, not current facts)

- John J. Murphy, *Intermarket Analysis* — how bonds, currencies, commodities and stocks lead one another.
- CFA Institute curriculum, Economics and Equity readings — monetary and fiscal policy transmission, sector rotation over the business cycle.
- Bank Indonesia Monetary Policy Reports and OJK/IDX statistics — official transmission for Indonesia.
- IMF World Economic Outlook and Article IV for Indonesia — the official macro baseline and risks.
