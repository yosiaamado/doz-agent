---
name: rilis
description: Persiapan rilis. Test suite dan cek perubahan paralel, DevOps menyusun rencana deploy (read-only), kamu menyetujui, lalu DevOps menjalankan langkah rilis.
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 8
nodes:
  - { id: start, type: start, label: Versi / catatan rilis }
  - { id: tes, type: action, action: jalankan-test, label: Test suite }
  - { id: perubahan, type: action, action: cek-perubahan, label: Cek perubahan }
  - { id: lolos, type: condition, label: Test lolos?, source: tes }
  - { id: rencana, type: agent, agent: devops-engineer, label: Rencana deploy, permission: read-only, inputs: all, instructions: Susun rencana rilis, langkah rollback, dan risiko. Jangan menjalankan deploy. }
  - { id: setuju, type: approval, label: Lanjut rilis?, message: Periksa rencana deploy dan rollback. }
  - { id: rilis, type: agent, agent: devops-engineer, label: Jalankan rilis, instructions: Jalankan langkah rilis sesuai rencana yang disetujui. Berhenti dan laporkan kalau ada langkah yang gagal. }
  - { id: batal, type: output, label: Rilis ditunda }
  - { id: selesai, type: output, label: Catatan rilis }
edges:
  - { from: start, to: tes }
  - { from: start, to: perubahan }
  - { from: tes, to: lolos }
  - { from: perubahan, to: rencana }
  - { from: lolos, to: rencana, when: true }
  - { from: lolos, to: batal, when: false }
  - { from: rencana, to: setuju }
  - { from: setuju, to: rilis, when: true }
  - { from: setuju, to: batal, when: false }
  - { from: rilis, to: selesai }
layout:
  start: [ 0, 200 ]
  tes: [ 200, 100 ]
  perubahan: [ 200, 300 ]
  lolos: [ 400, 100 ]
  rencana: [ 580, 200 ]
  setuju: [ 900, 200 ]
  rilis: [ 1080, 100 ]
  batal: [ 1100, 320 ]
  selesai: [ 1400, 100 ]
---

Sesuaikan perintah di action `jalankan-test` dengan stack project sebelum dipakai.
