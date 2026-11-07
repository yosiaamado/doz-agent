---
name: deal-check
description: Use when the user invokes /deal-check or is about to send a proposal, quote a price, or sign with a client and wants it checked ("mau tanda tangan", "deal ini aman ga", "mau kirim proposal") — is the deal real, does it make money, is the paper safe. Don't use for an early prospect not yet near a proposal (sales-team).
argument-hint: "<deal facts, or a path to the contract or proposal>"
effort: high
---

# Deal check — a go or no-go before committing

You (the main thread) run a gate before the user sends or signs. Three views, one verdict.

**Request:** $ARGUMENTS

## 1. Collect

Read `company-profile.md` and `sales-notes/<prospect>.md` if present. You need: client, product, scope, price, payment terms, delivery date, and the contract or proposal file. Ask for what's missing with one `AskUserQuestion`. A missing document doesn't stop the check; `legal-counsel` will say what it can't judge.

## 2. Run in parallel

One message, same brief, one `Agent` call each. Your brief contains: (1) the deal facts above; (2) the user's words verbatim; (3) the document path; (4) the role's question.

| Agent | Its question |
|---|---|
| `doz-agent:sales-director` | Is this a real deal: signer, date, fit, and is the discount earned? |
| `doz-agent:cfo` | Does it make money after delivery hours, and what do the payment terms do to cash? |
| `doz-agent:legal-counsel` | What in this paper can hurt, and what wording fixes it? |
| `doz-agent:cto`, only for custom scope or unclear feasibility | Can it be delivered in this time, and what does it cost in hours? |

## 3. Verdict

Apply this table; the worst row that matches wins.

| Finding | Verdict |
|---|---|
| Legal `DON'T SIGN` or `GET A LAWYER`, or CFO `DON'T` | **NO-GO** until fixed |
| Sales `WALK AWAY` | **NO-GO** |
| Sales `QUALIFY FIRST` or `NURTURE` | **HOLD**: don't send yet |
| Legal `NEED DOCUMENT` | **HOLD**: paper unchecked |
| CFO or CTO `NEED DATA` | **HOLD**: name the missing number |
| Legal `SIGN WITH CHANGES`, or CFO or CTO with conditions | **GO WITH CHANGES** |
| None of the above | **GO** |

```
Verdict: <GO | GO WITH CHANGES | HOLD | NO-GO> — <one sentence>

| Check | Verdict | Main point |
|---|---|---|
| Sales | | |
| Money | | |
| Legal | | |

Must fix before sending or signing:
1. <item — proposed wording or number — owner>

Next step: <action — date>
```

The user decides, and you don't send or sign anything. A GO isn't legal advice: if `legal-counsel` named an advocate step, keep it in the list.

## 4. After

Apply `Profile:` lines to `company-profile.md`. On a signed deal, suggest `/doz-agent:update-company`.
