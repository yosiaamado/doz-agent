# Trusted Financial Formulas

Standard formulas from finance textbooks and professional curricula (CFA, ACCA). Every formula has a **worked example recomputed with decimal precision** (Python `Decimal`), so it can be used directly as a golden test case.

**Rules of use:**
- The math is stable. What changes often is **tax rates and rules**, which are not in this file (see `indonesia-regulations.md`).
- For a formula not listed here: research it per `SKILL.md` §4, test it against the source's example, then **add it to this file** with its source and example.
- Compute with a decimal type. Round **only where the spec says**, not at every step.

## 1. Time value of money

### Compound interest and effective annual rate

```
FV  = PV × (1 + r)^n
PV  = FV / (1 + r)^n
EAR = (1 + i_nominal / m)^m − 1        m = compounding periods per year
```

Example: 12% nominal per year compounded monthly → EAR = (1 + 0.12/12)^12 − 1 = **12.6825%**.

### Annuity installment (PMT)

```
PMT = P × r / (1 − (1 + r)^−n)
r = interest per period, n = number of periods
Each period: interest = outstanding principal × r ; principal = PMT − interest ; new outstanding = outstanding − principal
```

Example: loan Rp 100,000,000, 12% per year (1% per month), 12 months.

| Month | Installment | Interest | Principal | Outstanding |
|---|---:|---:|---:|---:|
| 1 | 8,884,878.87 | 1,000,000.00 | 7,884,878.87 | 92,115,121.13 |
| 2 | 8,884,878.87 | 921,151.21 | 7,963,727.66 | 84,151,393.47 |

⚠ **Rounding trap:** if the installment is rounded every month, the outstanding principal isn't exactly zero at the end. Common practice: **the final installment absorbs the difference** so the balance ends at exactly zero. Put this rule in the spec.

⚠ **Flat interest is not an annuity.** Flat interest = original principal × rate × tenor, split evenly. Its effective rate is much higher than the stated rate. Don't mix them.

### NPV and IRR

```
NPV = Σ (CF_t / (1 + r)^t), t = 0..n        CF_0 is usually negative (initial investment)
IRR = the r that makes NPV = 0              (no closed form; found numerically)
```

Example: investment Rp 100,000,000, inflows of Rp 40,000,000 per year for 3 years, discount rate 10%.
- NPV = **−Rp 525,920.36** → at a 10% discount rate the project is **not viable**.
- IRR = **9.7010%** (below 10%, consistent with the negative NPV).

IRR implementation: bisection or Newton-Raphson with an iteration cap and tolerance. Handle **no solution** and **multiple solutions** (cash flows that change sign more than once).

## 2. Depreciation of fixed assets (accounting)

Notation: `C` = cost, `S` = residual value, `n` = useful life (years).

| Method | Annual charge |
|---|---|
| Straight line | (C − S) / n |
| Double declining balance | Opening book value × (2 / n), never taking book value below S |
| Sum of the years' digits | (C − S) × (remaining life at start of year / (n(n+1)/2)) |
| Units of production | (C − S) × (units this year / total estimated units) |

Example: C = Rp 120,000,000, S = Rp 20,000,000, n = 5 years.

| Year | Straight line | Double declining (40%) | Sum of years' digits |
|---|---:|---:|---:|
| 1 | 20,000,000 | 48,000,000 | 33,333,333.33 |
| 2 | 20,000,000 | 28,800,000 | 26,666,666.67 |
| 3 | 20,000,000 | 17,280,000 | 20,000,000.00 |
| 4 | 20,000,000 | 5,920,000 (capped at residual) | 13,333,333.33 |
| 5 | 20,000,000 | 0 | 6,666,666.67 |
| **Total** | **100,000,000** | **100,000,000** | **100,000,000** |

⚠ **Fiscal (tax) depreciation differs from accounting depreciation.** Indonesian asset groups and rates are set by Income Tax Law art. 11; not yet verified in this skill, so research before use. The system needs **two books** (commercial and fiscal), or at least two depreciation schedules.

## 3. Effective interest method (PSAK 109 / IFRS 9)

For loans or financial instruments at amortized cost, especially with transaction costs or a discount/premium.

```
EIR = the rate that discounts all contractual cash flows to the initial carrying amount
Interest expense/income for the period = opening carrying amount × EIR
Closing carrying amount = opening + effective interest − cash paid
```

Example: principal Rp 100,000,000, 10% coupon paid annually, 3-year maturity, transaction cost Rp 2,000,000 (net cash received Rp 98,000,000).
- EIR = **10.8158%**

| Year | Effective interest | Cash coupon | Closing carrying amount |
|---|---:|---:|---:|
| 1 | 10,599,489 | 10,000,000 | 98,599,489 |
| 2 | 10,664,329 | 10,000,000 | 99,263,818 |
| 3 | 10,736,182 | 10,000,000 | 0 (after repaying 100,000,000) |

The gap between effective interest and the cash coupon is the amortization of the transaction cost.

## 4. Leases (PSAK 116 / IFRS 16) — lessee

```
Initial lease liability = PV of lease payments, discounted at the rate implicit in the lease
                          (or the lessee's incremental borrowing rate)
Interest for the period = opening liability × rate
New liability           = opening + interest − payment
Right-of-use asset      = initial liability + prepaid payments + initial direct costs − incentives
```

Example: Rp 10,000,000 per year paid in arrears, 3 years, 8% rate.
- Initial liability = **Rp 25,770,970**

| Year | Interest | Payment | Liability |
|---|---:|---:|---:|
| 1 | 2,061,678 | 10,000,000 | 17,832,647 |
| 2 | 1,426,612 | 10,000,000 | 9,259,259 |
| 3 | 740,741 | 10,000,000 | 0 |

The right-of-use asset is depreciated separately (usually straight line over the lease term).

## 5. Foreign exchange differences

```
At transaction:   rupiah amount = foreign amount × rate on transaction date
Period end (monetary items: cash, receivables, payables in foreign currency):
   FX difference = foreign amount × (closing rate − carrying rate)
At settlement:    realized FX difference = foreign amount × (settlement rate − carrying rate)
```

Example: a USD 10,000 receivable carried at Rp 16,200, closing rate Rp 16,500 → **unrealized FX gain Rp 3,000,000**.

Non-monetary items (inventory, fixed assets, non-refundable advances) are **not** revalued. Always store: foreign amount, currency code, rate, rate source and rate date.

## 6. Cost and profitability analysis

```
Contribution margin per unit = selling price − variable cost per unit
Break-even (units)           = fixed costs / contribution margin per unit
Break-even (revenue)         = fixed costs / contribution margin ratio
Margin of safety             = (actual sales − break-even sales) / actual sales
```

Example: fixed costs Rp 50,000,000, price Rp 100,000, variable cost Rp 60,000 → break-even **1,250 units** (Rp 125,000,000).

### Variance analysis (FP&A)

```
Price variance  = (actual price − budget price) × actual quantity
Volume variance = (actual quantity − budget quantity) × budget price
Total variance  = price variance + volume variance
```

## 7. Financial ratios

| Group | Ratio | Formula |
|---|---|---|
| Liquidity | Current ratio | Current assets / current liabilities |
| | Quick ratio | (Cash + short-term investments + receivables) / current liabilities |
| Solvency | Debt to equity | Interest-bearing liabilities / equity |
| | Interest coverage | EBIT / interest expense |
| Profitability | Gross margin | Gross profit / revenue |
| | Operating margin | Operating profit / revenue |
| | Net margin | Net profit / revenue |
| | ROA | Net profit / average total assets |
| | ROE | Net profit / average equity |
| Efficiency | DSO (days sales outstanding) | Receivables / revenue × 365 |
| | DIO (days inventory outstanding) | Inventory / COGS × 365 |
| | DPO (days payables outstanding) | Payables / COGS × 365 |
| | Cash conversion cycle | DIO + DSO − DPO |
| Other | EBITDA | Operating profit + depreciation + amortization |

CCC example: inventory 150, COGS 1,200, receivables 200, revenue 1,800, payables 100 → DIO 45.6 days, DSO 40.6 days, DPO 30.4 days, **CCC 55.8 days**.

⚠ Ratio definitions vary between companies (whether "debt" includes lease liabilities, period-end vs average balances). **Write the definition in the spec**, not just the name.

## 8. Cost of capital

```
WACC = (E/V) × Re + (D/V) × Rd × (1 − T)
Re (CAPM) = Rf + β × (Rm − Rf)
E = market value of equity, D = market value of debt, V = E + D, T = corporate tax rate
```

## 9. Rounding

| Method | 2.5 → | 3.5 → | Used for |
|---|---:|---:|---|
| Half-up | 3 | 4 | Common on business documents |
| Half-even (banker's rounding) | 2 | 4 | Default in many languages; reduces cumulative bias |
| Down (truncate) | 2 | 3 | Some tax rules. **Check the official rule** |

⚠ Many languages default to half-even (Python's `Decimal`, .NET's `Math.Round`). If the spec says half-up, engineers must state it explicitly in code.

**Rounding per line vs on the total gives different numbers.** Example: 3 lines each with VAT Rp 33.33 → rounded per line = Rp 99; computed on the total = Rp 100. The spec must choose one, and it must match the tax documents.
