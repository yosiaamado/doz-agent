---
name: perbaikan-bug
description: Reproduce the bug with a test, fix it, run the test suite; if it still fails the fix is retried (2 rounds max), then a code review.
defaults: { inputs: previous }
nodes:
  - { id: start, type: start, label: Bug report }
  - id: reproduksi
    type: agent
    agent: qa-tester
    label: Reproduce the bug
    instructions: Write a test that fails because of this bug (don't fix production code). Report the reproduction steps and the test file.
  - { id: perbaiki, type: agent, agent: backend-engineer, label: Fix, instructions: Fix the root cause until the reproduction test passes. Don't change the test unless it's wrong. }
  - { id: tes, type: action, action: jalankan-test, label: Test suite }
  - { id: lolos, type: condition, label: "Tests passed?", source: tes }
  - { id: review, type: agent, agent: code-reviewer, label: Code review, permission: read-only }
  - { id: laporan, type: output, label: Report }
edges:
  - { from: start, to: reproduksi }
  - { from: reproduksi, to: perbaiki }
  - { from: perbaiki, to: tes }
  - { from: tes, to: lolos }
  - { from: lolos, to: review, when: true }
  - { from: lolos, to: perbaiki, when: false, loop: 2 }
  - { from: review, to: laporan }
---

Stay focused on the reported bug. Make the smallest possible change; note any out-of-scope refactor rather than doing it.
