---
name: audit-keamanan
description: Audit keamanan read-only (STRIDE + OWASP), lalu kamu memilih apakah temuan diperbaiki; kalau ya, engineer memperbaiki dan security mengecek ulang.
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 10
nodes:
  - { id: start, type: start, label: Lingkup audit, input: Audit seluruh endpoint dan autentikasi. }
  - { id: audit, type: agent, agent: security-tester, label: Audit keamanan, permission: read-only, verdict: true, instructions: PASS hanya kalau tidak ada temuan Critical/High. }
  - { id: aman, type: condition, label: Aman?, source: audit }
  - { id: putuskan, type: approval, label: Perbaiki temuan?, message: Ada temuan Critical/High. Setujui untuk meminta engineer memperbaiki. }
  - { id: perbaiki, type: agent, agent: backend-engineer, label: Perbaiki temuan, instructions: Perbaiki temuan Critical/High dari audit. Sertakan test untuk tiap perbaikan. }
  - { id: cek-ulang, type: agent, agent: security-tester, label: Cek ulang, permission: read-only, inputs: all }
  - { id: laporan, type: output, label: Laporan audit }
edges:
  - { from: start, to: audit }
  - { from: audit, to: aman }
  - { from: aman, to: laporan, when: true }
  - { from: aman, to: putuskan, when: false }
  - { from: putuskan, to: perbaiki, when: true }
  - { from: putuskan, to: laporan, when: false }
  - { from: perbaiki, to: cek-ulang }
  - { from: cek-ulang, to: laporan }
layout:
  start: [ 0, 160 ]
  audit: [ 200, 160 ]
  aman: [ 520, 160 ]
  putuskan: [ 700, 300 ]
  perbaiki: [ 880, 300 ]
  cek-ulang: [ 1200, 300 ]
  laporan: [ 1520, 160 ]
---

Audit tidak boleh mengubah file. Perbaikan hanya setelah kamu menyetujui.
