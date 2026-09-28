---
name: fitur-kecil
description: Fitur kecil backend. PO memotong scope, BE mengerjakan, QA menguji, dan kalau QA gagal BE memperbaiki (maks 2x).
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 8
nodes:
  - { id: start, type: start, label: Permintaan fitur }
  - id: po
    type: agent
    agent: product-owner
    label: Scope & acceptance criteria
    instructions: Tulis user story + acceptance criteria singkat. Jangan menulis kode.
  - { id: aturan, type: info, label: Aturan project, text: Ikuti pola kode yang sudah ada dan jalankan test modul yang terdampak. }
  - { id: be, type: agent, agent: backend-engineer, label: Implementasi }
  - id: qa
    type: agent
    agent: qa-tester
    label: Uji acceptance criteria
    verdict: true
    instructions: Uji setiap acceptance criteria dari langkah PO. PASS hanya kalau tidak ada bug blocking.
  - { id: lolos, type: condition, label: QA lolos?, source: qa, check: Apakah QA lolos tanpa bug blocking? }
  - { id: selesai, type: output, label: Laporan akhir }
edges:
  - { from: start, to: po }
  - { from: po, to: be }
  - { from: aturan, to: be }
  - { from: be, to: qa }
  - { from: qa, to: lolos }
  - { from: lolos, to: selesai, when: true }
  - { from: lolos, to: be, when: false, loop: 2 }
layout:
  start: [ 0, 120 ]
  po: [ 260, 120 ]
  aturan: [ 260, 320 ]
  be: [ 540, 120 ]
  qa: [ 820, 120 ]
  lolos: [ 1100, 120 ]
  selesai: [ 1380, 60 ]
---

Workflow contoh. Catatan di bagian ini ikut dikirim ke semua agent sebagai konteks workflow.
