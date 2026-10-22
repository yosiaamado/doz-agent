# What Senior Finance & Accounting People Do

What each senior role does, and **what it means for the system engineers build**. Use the "System implication" columns as the list of hidden requirements that specs most often miss.

Compiled from controller and senior-accountant role descriptions (job postings and practitioner guides), then mapped to system requirements. This is common industry practice, not an official standard.

## 1. Financial Controller

Owns the close and internal controls. Signs off the financial statements before they reach the CFO or board.

| Work | System implication |
|---|---|
| Builds and runs the **month-end close calendar** | Period status `open` → `closing` → `closed`. Postings to a closed period are rejected. A "what's still outstanding" view per period |
| Reviews reconciliations and adjusting journals | Review queue, `draft` / `submitted` / `approved` status, reviewer notes |
| Designs **internal controls & segregation of duties** | Separate roles for creator, approver and poster. Approval limits by amount (approval matrix) |
| Sets accounting policies (asset capitalization, revenue recognition, bad-debt allowance) | Policies stored as date-effective configuration, not logic hidden in code |
| Works with external auditors | Full GL and journal export with audit trail, traceable from report → journal → source document |

## 2. Senior Accountant (General Ledger)

Day-to-day execution: journals, reconciliations, account analysis.

| Work | System implication |
|---|---|
| Monthly reconciliations: cash/bank, receivables, prepaids, revenue, deferred revenue | Bank statement matching against system transactions, with `matched` / `unmatched` / `difference` status |
| Separates **timing differences** from **errors** when balances don't match | A difference report that shows in-transit items separately |
| Month-end accruals and adjustments | Recurring journals, and auto-reversing journals at the start of the next period |
| Intercompany reconciliation and elimination entries | Entity and counterparty codes on every intercompany journal |
| Account fluctuation (flux) analysis | Period-over-period balance comparison per account, with a variance threshold that must be explained |

## 3. Revenue Accountant

Revenue recognition specialist (PSAK 115 / IFRS 15).

| Work | System implication |
|---|---|
| Reviews contracts for non-standard terms | Contract data separate from invoices: performance obligations, transaction price, recognition schedule |
| Applies the 5 steps: identify the contract → performance obligations → transaction price → allocate the price → recognize as obligations are satisfied | Revenue is not automatically = invoice. There's a **deferred revenue** account and a recognition schedule (point in time or over time) |
| Handles discounts, bundles, returns, loyalty points | Price allocation per component, estimated returns as a liability |

## 4. Tax

| Work | System implication |
|---|---|
| Calculates, collects, pays and files PPN (VAT) and PPh (income tax art. 21/23/4(2)/final) | A tax-rate master with effective dates, tax object codes, and the customer/supplier PKP (VAT-registered) status |
| Issues tax invoices (faktur pajak) and withholding slips (bukti potong) | The data Coretax needs (counterparty NPWP/NIK, transaction code, tax base, serial number) plus upload/approval status |
| Reconciles output vs input VAT, and the book-to-tax (fiscal) reconciliation | Separate output and input VAT accounts, and a flag for non-deductible expenses |
| Keeps deadlines | A tax obligation calendar with reminders |

## 5. FP&A (Financial Planning & Analysis)

| Work | System implication |
|---|---|
| Builds budgets and forecasts | Budget table per account × cost center × period, separate from actuals |
| **Variance analysis** actual vs budget (price, volume, mix) | The same dimensions on budget and actuals. Different dimensions make variances impossible to compute |
| Management reports and KPIs (margin, burn rate, runway, unit economics) | Analytical dimensions (cost center, project, product, branch) on every journal, not only on invoices |
| Scenario models | Clean exports to spreadsheets, with consistent metric definitions |

## 6. Treasury

| Work | System implication |
|---|---|
| Cash management and cash-flow forecasting | Due dates on receivables and payables, and a payment plan |
| Banks, virtual accounts, payment gateways | Automatic reconciliation by reference number, and gateway fees recorded as a separate expense |
| FX risk | Original amount + currency + rate used + rate source on every foreign-currency transaction. Period-end revaluation |
| Loans and interest | Amortization schedules using the effective interest method (PSAK 109 / IFRS 9) |

## 7. Cost / Management Accountant

| Work | System implication |
|---|---|
| Computes cost of goods sold | Inventory valuation method chosen explicitly (FIFO or weighted average), consistent, and never switched mid-year |
| Allocates overhead | Allocation bases (labor hours, floor area, usage) as data, not fixed numbers in code |
| Margin analysis per product/customer | Costs and revenue traceable to the same products and customers |

## 8. Internal Audit

| Work | System implication |
|---|---|
| Tests design and operating effectiveness of controls (COSO framework) | Immutable log: who, when, from where, before and after values |
| Detects fraud | Exception reports: after-hours postings, suspiciously round amounts, new suppliers with large payments, one person creating and approving |
| Assesses compliance | Source documents attached and kept for the retention period |

## The requirements most often missing from specs

1. Period status and period locking.
2. Separating revenue from invoicing (deferred revenue).
3. Bank and subledger-to-GL reconciliation.
4. Analytical dimensions (cost center, project) on every journal.
5. Tax rates with effective dates.
6. FX rate and rate source on every foreign-currency transaction.
7. Audit trail and segregation of duties.

Sources: [Ramp — what is a financial controller](https://ramp.com/blog/what-is-a-financial-controller), [US Fractional CFO — controller responsibilities](https://usfractionalcfo.com/controller-responsibilities-roles-duties-functions/), [VelvetJobs — senior revenue accountant](https://www.velvetjobs.com/job-descriptions/senior-accountant-revenue). Practitioner material, not a formal standard.
