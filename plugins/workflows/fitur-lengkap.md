---
name: fitur-lengkap
description: A large end-to-end feature. PO → contract (SA) → BE ∥ FE → review ∥ QA ∥ security → you decide on the merge.
defaults: { inputs: previous }
parallel: 3
nodes:
  - { id: start, type: start, label: Feature request }
  - { id: po, type: agent, agent: product-owner, label: Scope & AC, instructions: Write the user story + acceptance criteria and the agent plan. Don't write code. }
  - { id: sa, type: agent, agent: system-analyst, label: API contract, instructions: Write the API contract and the file map into docs/specs/<slug>.md. }
  - { id: be, type: agent, agent: backend-engineer, label: Backend }
  - { id: fe, type: agent, agent: frontend-engineer, label: Frontend }
  - { id: review, type: agent, agent: code-reviewer, label: Code review, permission: read-only, inputs: all }
  - { id: qa, type: agent, agent: qa-tester, label: QA, verdict: true, inputs: all }
  - { id: security, type: agent, agent: security-tester, label: Security, permission: read-only, inputs: all }
  - { id: catatan, type: info, label: The contract is the reference, text: BE and FE both follow docs/specs/<slug>.md. Don't read the other side's code. }
  - { id: putuskan, type: approval, label: "Ready to merge?", message: Read the review, QA, and security reports. Approve if it's ready to merge. }
  - { id: selesai, type: output, label: Final report }
  - { id: revisi, type: output, label: Needs revision }
edges:
  - { from: start, to: po }
  - { from: po, to: sa }
  - { from: sa, to: be }
  - { from: sa, to: fe }
  - { from: catatan, to: be }
  - { from: catatan, to: fe }
  - { from: be, to: review }
  - { from: fe, to: review }
  - { from: be, to: qa }
  - { from: fe, to: qa }
  - { from: be, to: security }
  - { from: review, to: putuskan }
  - { from: qa, to: putuskan }
  - { from: security, to: putuskan }
  - { from: putuskan, to: selesai, when: true }
  - { from: putuskan, to: revisi, when: false }
---

A large workflow. If the work turns out to be small, `fitur-kecil` or `/doz-agent:ship-feature` is cheaper.
