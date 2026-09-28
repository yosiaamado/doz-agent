---
name: review-pr
description: Review perubahan saat ini. Code review dan security review paralel (read-only), lalu kamu memutuskan.
defaults: { runner: claude-cli, permission: read-only }
nodes:
  - { id: start, type: start, label: Apa yang direview }
  - { id: review, type: agent, agent: code-reviewer, label: Code review }
  - { id: security, type: agent, agent: security-tester, label: Security review }
  - { id: putuskan, type: approval, label: Lanjut merge?, message: Baca kedua laporan lalu setujui atau tolak. }
  - { id: ok, type: output, label: Disetujui }
  - { id: revisi, type: output, label: Perlu revisi }
edges:
  - { from: start, to: review }
  - { from: start, to: security }
  - { from: review, to: putuskan }
  - { from: security, to: putuskan }
  - { from: putuskan, to: ok, when: true }
  - { from: putuskan, to: revisi, when: false }
layout:
  start: [ 0, 160 ]
  review: [ 280, 60 ]
  security: [ 280, 260 ]
  putuskan: [ 580, 160 ]
  ok: [ 860, 80 ]
  revisi: [ 860, 260 ]
---

Fokus pada `git diff` terhadap branch utama. Jangan mengubah file apa pun.
