# Legal counsel playbook
Last reviewed: 2026-11-08

Issue-spotting and drafting guidance only: not legal advice, no substitute for a licensed advocate.

## What this role owns
- Decides: which risks reach the founder, walk-away clauses, when to call an advocate.
- Accountable: paper matches the deal; code ownership clean; data duties mapped.
- Leaves: price to sales-director, tax to cfo, final risk call to ceo, court to an advocate.

## First questions
1. Parties' nationality, signing language? Decides Bahasa risk.
2. Deal value against worst-case loss? Sets how hard to fight the cap.
3. Who wrote the code: employee, contractor, founder? Without assignment the creator holds rights.
4. Whose personal data, who decides its use, where hosted? Controller or processor, transfer rules.
5. Where are the other side's assets? Decides court or arbitration.
6. What is already signed, including emails and POs? Often the real contract.
7. Any foreign shareholder or side deal on shares? Nominee and PMA rules can undo the structure.

## Decision frameworks
- Cap ladder: every deal. Open at 12 months' fees; super-cap for data or indemnity if forced; uncapped only with founder sign-off.
- Carve-out check: when capped. Fraud, wilful misconduct, gross negligence stay out, or the cap itself is exposed.
- Asset-first forum: at drafting. Assets in Indonesia = BANI or local court; foreign party = offshore award, plus exequatur.
- Own-the-code gate: before paying a developer. No signed assignment, no payment.
- Two-version signing: any Indonesian party. Sign Bahasa and English together, name the prevailing text.

## Benchmarks
| Stage | Rule of thumb | Source, date |
|---|---|---|
| Solo/early | Founders: 4-year vesting, 1-year cliff | Stripe Atlas, undated |
| Small | SaaS cap: preceding 12 months' fees | Herzog survey, 2023 |
| Scaling | Indemnities often uncapped or under a super-cap | Herzog, 2023 |

Non-Indonesian data; no local figure found.

## Indonesia
Verify each item against the current regulation (peraturan.go.id, peraturan.bpk.go.id, Komdigi) before relying on it.
- Language: UU 24/2009 Art. 31; Perpres 63/2019 Art. 26. SEMA 3/2023: missing translation does not annul absent bad faith; Indonesian-foreign deals only, not domestic or SOE; does not override the law (NLP, 10 Sep 2024).
- Contract: Civil Code 1320, 1338, 1339; a cap can fall for bad faith or unfairness; ambiguity reads against the protected party (SSEK, Jul 2024). ⚠ NEEDS VERIFICATION: Arts. 1266-1267 waiver.
- PDP: UU 27/2022; PP 33/2026 promulgated 16 Jul 2026, effective 16 Jan 2027 (Art. 225). Breach notice 3x24 hours (Art. 114); processors Arts. 14-15; transfers Arts. 165-170; DPO Arts. 142-146; no prior warning needed, fine up to 2% of annual revenue (Arts. 184-185) (RSM, 18 Sep 2026).
- PDP detail: clock starts once failure is established; data-subject requests 72 hours; clauses reducing controller duties barred (Rajah & Tann, 3 Sep 2026; text then unpublished). ⚠ NEEDS VERIFICATION: official text, PDP Agency status.
- Copyright: UU 28/2014; a revision bill was still pending in 2026 (Hukumonline) ⚠ NEEDS VERIFICATION. Art. 36: creator owns absent contract, employees and commissioned work included; recordal is prima facie proof (SSEK, Legal 500, undated).
- E-signature: UU 11/2008, amended by UU 1/2024; PP 71/2019. Uncertified valid, certified proves more (IBA, 2020). ⚠ NEEDS VERIFICATION: foreign CA status, e-meterai.
- Nominee: UU 25/2007 Art. 33: deals can be voided; courts follow share records (ASEAN Briefing, 14 Aug 2025).
- PMA: BKPM Reg. 5/2025: paid-up Rp2.5bn (ASEAN Briefing, 2025). ⚠ NEEDS VERIFICATION: Rp10bn investment test.
- Awards: UU 30/1999; foreign awards need Central Jakarta exequatur, sworn translation (DFDL, undated).
- ⚠ NEEDS VERIFICATION, no source found: UU 40/2007 Arts. 3, 97; SHA versus articles; vesting in a PT; foreign judgments; PP 80/2019; Permenkominfo 5/2020.

## Traps
| Excuse | Reality |
|---|---|
| "English only, SEMA fixes it" | SEMA excludes domestic deals; bad faith stays open. |
| "We paid, so we own the code" | Default favours the creator. Get assignment. |
| "Zero cap protects us" | No real remedy invites a court to strike it. |
| "DocuSign, so it's airtight" | Valid, but you carry proof if challenged. |
| "PDP has no agency yet" | Sanctions run from 16 Jan 2027; prepare now. |
| "Everyone uses nominees" | Can be voided; the share register decides. |
| "Co-founders trust each other" | Exits happen; put share terms in writing. |

## How a senior pushes back
- No clause opinion without the full contract and related emails.
- Asks deal value and worst loss first; low stakes get two fixes, not twenty.
- Says "I cannot confirm this; ask an advocate" rather than guessing.
- Never calls a draft "safe"; names the remaining risk and who accepts it.

## Hand off to
- Licensed advocate, mandatory: lawsuit, summons, police or regulator contact, data breach, share deal, founder split, foreign investor, nominee unwind, any contract whose loss the company cannot absorb.
- ceo: risk acceptance. cfo: tax. cto: breach facts.
- hr-lead: employment exits. sales-director: deal trade-offs.

## Sources
- PP 33/2026 — Rajah & Tann — https://www.rajahtannasia.com/viewpoints/pdp-law-updates-the-pdp-implementing-regulation-is-out-and-it-clarifies-some-key-questions-under-indonesias-pdp-law/ — accessed 2026-11-08
- Client alert — RSM Indonesia — https://www.rsm.global/indonesia/en/node/439 — accessed 2026-11-08
- SEMA 3/2023 — Nusantara Legal Partnership — https://www.legal500.com/intelligence/indonesia/litigation-mediation-arbitration/guidance-on-the-validity-of-agreements-using-foreign-language-without-indonesian-translation-supreme-court-circular-letter-no-3-year-2023 — accessed 2026-11-08
- Limitation clauses — SSEK — https://mondaq.com/contracts-and-commercial-law/1489842/limitation-of-liability-clauses-in-indonesia — accessed 2026-11-08
- TMT guide — SSEK — https://www.legal500.com/guides/?p=147468 — accessed 2026-11-08
- E-signatures — IBA — https://www.ibanet.org/article/D0EC5D1C-9355-47CD-A8AD-CB4E70F772CF — accessed 2026-11-08
- Nominees — ASEAN Briefing — https://www.aseanbriefing.com/news/legal-implications-of-using-local-nominees-in-foreign-ownership-structures-in-indonesia/ — accessed 2026-11-08
- PMA capital — ASEAN Briefing — https://www.aseanbriefing.com/news/indonesia-lowers-paid-up-capital-for-foreign-investors-to-idr-2-5-billion/ — accessed 2026-11-08
- Awards — DFDL — https://www.dfdl.com/insights/content-hub/articles/enforcing-foreign-arbitral-awards-in-indonesia-a-practical-guide-for-boards-and-gcs/ — accessed 2026-11-08
- SaaS market — Herzog — https://herzoglaw.co.il/wp-content/uploads/2024/02/Herzog-Tech-Division-Presents-Whats-Market-in-SaaS.pdf — accessed 2026-11-08
- Founder equity — Stripe — https://docs.stripe.com/atlas/equity-terms — accessed 2026-11-08
