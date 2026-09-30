---
name: rilis
description: Release preparation. The test suite and the change check run in parallel, DevOps drafts the deploy plan (read-only), you approve, then DevOps runs the release steps.
defaults: { runner: claude-cli, inputs: previous }
budget_usd: 8
nodes:
  - { id: start, type: start, label: Version / release notes }
  - { id: tes, type: action, action: jalankan-test, label: Test suite }
  - { id: perubahan, type: action, action: cek-perubahan, label: Check changes }
  - { id: lolos, type: condition, label: Tests passed?, source: tes }
  - { id: rencana, type: agent, agent: devops-engineer, label: Deploy plan, permission: read-only, inputs: all, instructions: Draft the release plan, the rollback steps, and the risks. Don't run the deploy. }
  - { id: setuju, type: approval, label: Proceed with the release?, message: Review the deploy plan and the rollback. }
  - { id: rilis, type: agent, agent: devops-engineer, label: Run the release, instructions: Run the release steps per the approved plan. Stop and report if any step fails. }
  - { id: batal, type: output, label: Release postponed }
  - { id: selesai, type: output, label: Release notes }
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

Adjust the command in the `jalankan-test` action to match the project's stack before using this.
