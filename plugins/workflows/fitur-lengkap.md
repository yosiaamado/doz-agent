---
name: fitur-lengkap
description: Fitur besar end-to-end. PO → kontrak (SA) → BE ∥ FE → review ∥ QA ∥ security → kamu yang memutuskan merge.
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 25
parallel: 3
nodes:
  - { id: start, type: start, label: Permintaan fitur }
  - { id: po, type: agent, agent: product-owner, label: Scope & AC, instructions: Tulis user story + acceptance criteria dan rencana agent. Jangan menulis kode. }
  - { id: sa, type: agent, agent: system-analyst, label: Kontrak API, instructions: Tulis kontrak API dan peta file ke docs/specs/<slug>.md. }
  - { id: be, type: agent, agent: backend-engineer, label: Backend }
  - { id: fe, type: agent, agent: frontend-engineer, label: Frontend }
  - { id: review, type: agent, agent: code-reviewer, label: Code review, permission: read-only, inputs: all }
  - { id: qa, type: agent, agent: qa-tester, label: QA, verdict: true, inputs: all }
  - { id: security, type: agent, agent: security-tester, label: Security, permission: read-only, inputs: all }
  - { id: catatan, type: info, label: Kontrak jadi acuan, text: BE dan FE mengikuti docs/specs/<slug>.md. Jangan saling membaca kode lawan. }
  - { id: putuskan, type: approval, label: Siap merge?, message: Baca laporan review, QA, dan security. Setujui kalau siap merge. }
  - { id: selesai, type: output, label: Laporan akhir }
  - { id: revisi, type: output, label: Perlu revisi }
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
layout:
  start: [ 0, 240 ]
  po: [ 180, 240 ]
  sa: [ 480, 240 ]
  catatan: [ 480, 420, 260, 120 ]
  be: [ 800, 140 ]
  fe: [ 800, 340 ]
  review: [ 1120, 40 ]
  qa: [ 1120, 240 ]
  security: [ 1120, 440 ]
  putuskan: [ 1440, 240 ]
  selesai: [ 1640, 140 ]
  revisi: [ 1640, 340 ]
---

Workflow besar. Kalau pekerjaannya ternyata kecil, lebih hemat pakai `fitur-kecil` atau `/doz-agent:ship-feature`.
