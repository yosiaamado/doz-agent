# Financial System Design Rules for Engineers

Rules that belong in the spec whenever a feature **writes to a ledger, a balance, or a financial document**. Distilled from double-entry ledger practice in fintech and ERP systems, adjusted for Indonesian audit and tax needs.

## 1. Invariants that must never break

1. **Every journal balances:** total debit = total credit, per currency. Enforced in the domain **and** the database (a constraint or validation inside the same transaction), not only in the UI.
2. **Posted journals can't be updated or deleted.** A correction = a reversing journal + a new correct journal. The original mistake and its correction both stay visible.
3. **Balances derive from journals.** If a balance is stored for performance (snapshot or running balance), it must be recomputable from journals and checked regularly.
4. **One journal = one database transaction.** All its lines commit together or not at all.
5. **Idempotent:** every event that produces a journal carries a unique key (source document ID + event type, or an idempotency key). Retries, double clicks and duplicate webhooks never create a duplicate journal.

## 2. Minimum data model

```
account          id, code, name, type (asset/liability/equity/revenue/expense),
                 normal balance (debit/credit), currency, active, parent account,
                 PSAK 118 category (operating/investing/financing/income tax/discontinued)

journal_entry    id, number, transaction date, posting date, period,
                 source (module + document id), idempotency_key (unique),
                 status (draft/posted/reversed), reversed_by / reverses (journal id),
                 created_by, approved_by, created_at, description

journal_line     id, journal_entry_id, account_id, debit, credit,
                 currency, foreign_amount, fx_rate, fx_rate_source,
                 dimensions (cost center, project, branch, product), party (customer/supplier)

period           id, year, month, status (open/closing/closed), closed_by, closed_at

tax_rate         type, code, nominal rate, tax-base factor, effective_from, effective_to, legal basis
```

A journal line holds a debit **or** a credit, never both, and never a negative amount.

## 3. Money and numbers

- **Never use float/double for money.** Use `decimal`/`numeric` (e.g. `numeric(19,4)` or `decimal(18,2)`) or integers in the smallest unit.
- Every money value **carries a currency code** (ISO 4217: `IDR`, `USD`).
- Storage precision may exceed display precision. Round only at the point the spec defines, with the method written explicitly.
- Rounding remainders (a 1-rupiah leftover from allocation, installment splitting or FX conversion) are **placed deliberately**: on the last line, or in a rounding-difference account. They never just disappear.

## 4. Dates and periods

- Distinguish **transaction date** (when the event happened), **posting date** (when it was recorded) and **effective date** (its accounting period).
- Store timestamps in UTC, but **assign periods in the entity's time zone** (e.g. Asia/Jakarta). A transaction at 23:30 WIB on the 31st belongs to that month, even though it's already the 1st in UTC.
- **Closed periods are locked:** postings with an effective date in a `closed` period are rejected. Corrections for a closed period go into the next open period, referencing the original period.
- Reopening a closed period is a privileged action: a special role, a reason, and an audit trail entry.

## 5. Source documents and numbering

- Every journal points to its **source document** (invoice, payment, return note). Reports must be traceable: report → account → journal → source document → attachment.
- Financial document numbers (invoices, receipts) are **sequential and never reused**. A cancelled document stays with status `void`; its number is not reissued.
- Tax invoice serial numbers (NSFP) **come from DJP**; the system doesn't generate them.

## 6. Subledgers and the general ledger

- Receivables, payables, inventory and fixed assets have a **subledger** (detail per customer/supplier/item/asset) and a **control account** in the general ledger.
- Invariant: **subledger total = control account balance**, at all times. Provide a report that proves it.
- Control accounts accept no manual postings — only postings from their subledger module.

## 7. Multi-currency

- Store the original (foreign) amount and the functional (rupiah) amount, the rate, rate source and rate date on every line.
- Rates come from a defined, consistent source (e.g. Bank Indonesia's middle rate, or the Finance Minister's tax rate for tax purposes). **Accounting and tax rates can differ.**
- Period-end revaluation of monetary items produces an unrealized FX journal, usually reversed at the start of the next period.

## 8. Controls and audit trail

- **Append-only audit trail:** who (user or API key), when, from where (IP/device where relevant), what action, before and after values. This also covers financial master data: accounts, tax rates, bank accounts, supplier data.
- **Segregation of duties:** creators can't approve their own transactions. Changing a supplier's bank account needs a second person's approval (the most common fraud pattern).
- **Approval matrix** by amount and transaction type, stored as data.
- **Exception reports:** manual journals to sensitive accounts, after-hours postings, new suppliers with large payments, unusually round amounts.

## 9. Reconciliation

- **Bank reconciliation:** match bank lines to system transactions by reference, amount and date. Per-line status: `matched`, `unmatched`, `difference`. Bank and payment-gateway fees are booked as a separate expense, never silently netted against revenue.
- **Subledger vs control account** (see §6).
- **Trial balance:** total debit = total credit for every period. The cheapest test there is, and the one most often forgotten.

## 10. Retention

- Transactions, journals, source documents and attachments are **kept for at least 10 years** (Indonesian tax law, UU KUP art. 28(11)).
- No hard deletes. Soft delete doesn't apply to posted journals either (invariant 2).
- Consider storing data in Indonesia when choosing infrastructure.

## 11. Tests that must exist

- An unbalanced journal is rejected.
- Update or delete on a posted journal is rejected.
- Posting into a closed period is rejected.
- The same request sent twice produces one journal.
- The spec's golden test cases (exact numbers, including rounding).
- Subledger total = control account after a mixed sequence (create, partial payment, return, void).
- A transaction at 23:30 WIB at month end lands in the right period.

Practice sources: [Finlego — real-time double-entry ledger](https://finlego.com/blog/designing-a-real-time-ledger-system-with-double-entry-logic), [Matthew Wong — ERP general ledger in PostgreSQL](https://www.matthewswong.com/en/blog/erp-general-ledger-double-entry-design/), [Trio — payment ledger architecture](https://trio.dev/payment-ledger-architecture-fintech/). Practitioner writing, not a formal standard.
