---
name: shortcuts
description: Use when the user asks which skills or shortcuts exist, what a command does, which agents it covers, or which one to use for something ("skill apa aja", "shortcut apa aja", "harus pake apa", "/director itu manggil siapa"), or invokes /shortcuts.
---

# Shortcuts

The commands that run a team. Type them with the plugin prefix, e.g. `/doz-agent:director`.

Answer from this table in the user's language. If they describe a need, recommend one shortcut and give a ready example; don't recite the whole table.

| Shortcut | Use it to | Calls | Example |
|---|---|---|---|
| `ship-feature` | Build a product, a feature, an upgrade or a bugfix end to end | `product-owner`, `system-analyst`, `backend-engineer`, `frontend-engineer`, `devops-engineer`, `code-reviewer`, `qa-tester`, `security-tester`, as needed | `/doz-agent:ship-feature add invoice export to Fiskal` |
| `director` | Get leadership's view on one big decision, and see where they split | `ceo`, `cfo`, plus `cto`, `coo`, `cmo`, `legal-counsel`, `hr-lead` as relevant | `/doz-agent:director which product should I focus on?` |
| `sales-team` | Handle a prospect, find leads, or deal with an existing client | `sales-director`, `cmo`, `customer-success-lead`, by situation | `/doz-agent:sales-team new prospect, a rental business in Bandung` |
| `deal-check` | Get a go or no-go before sending a proposal or signing | `sales-director`, `cfo`, `legal-counsel`, plus `cto` for custom scope | `/doz-agent:deal-check contracts/client-x.pdf` |
| `weekly-review` | Review the week and set one focus for the next | `sales-director`, `coo` | `/doz-agent:weekly-review` |
| `update-company` | Record a new client, hire, product or money change in the profile | none, it asks you questions | `/doz-agent:update-company new client on Fiskal, Rp12,500,000` |
| `archive` | Tidy `company/`: wrong folders, old or closed items, duplicates, names | none, you approve the plan | `/doz-agent:archive sales` |
| `setting` | See or change settings: company record local or repo, repo, branch, auto-push | none | `/doz-agent:setting turn off auto-push` |
| `shortcuts` | See this list | none | `/doz-agent:shortcuts` |

Single agents need no shortcut: ask normally, or say which one, e.g. "pakai agent cfo: …". Other skills and agents are listed in the plugin's `README.md`; `technical-lead` answers how they fit together.
