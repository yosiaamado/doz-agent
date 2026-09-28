---
name: perbaikan-bug
description: Reproduksi bug dengan test, perbaiki, jalankan test suite; kalau masih gagal perbaikan diulang (maks 2x), lalu code review.
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 6
nodes:
  - { id: start, type: start, label: Laporan bug }
  - id: reproduksi
    type: agent
    agent: qa-tester
    label: Reproduksi bug
    instructions: Tulis test yang gagal karena bug ini (jangan perbaiki kode produksi). Laporkan langkah reproduksi dan file test.
  - { id: perbaiki, type: agent, agent: backend-engineer, label: Perbaiki, instructions: Perbaiki akar masalah sampai test reproduksi lolos. Jangan mengubah test kecuali salah. }
  - { id: tes, type: action, action: jalankan-test, label: Test suite }
  - { id: lolos, type: condition, label: Test lolos?, source: tes }
  - { id: review, type: agent, agent: code-reviewer, label: Code review, permission: read-only }
  - { id: laporan, type: output, label: Laporan }
edges:
  - { from: start, to: reproduksi }
  - { from: reproduksi, to: perbaiki }
  - { from: perbaiki, to: tes }
  - { from: tes, to: lolos }
  - { from: lolos, to: review, when: true }
  - { from: lolos, to: perbaiki, when: false, loop: 2 }
  - { from: review, to: laporan }
layout:
  start: [ 0, 160 ]
  reproduksi: [ 200, 160 ]
  perbaiki: [ 500, 160 ]
  tes: [ 820, 160 ]
  lolos: [ 980, 160 ]
  review: [ 1160, 60 ]
  laporan: [ 1480, 60 ]
---

Fokus pada bug yang dilaporkan. Perubahan sekecil mungkin; refactor di luar lingkup dicatat saja.
