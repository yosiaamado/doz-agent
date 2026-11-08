---
name: fitur-kecil
description: A small backend feature. The PO cuts the scope, BE implements, QA tests, and if QA fails BE fixes it (2 rounds max).
defaults:
  inputs: previous
nodes:
  - { id: start, type: start, label: Feature request }
  - id: po
    type: agent
    agent: product-owner
    label: Scope & acceptance criteria
    instructions: Write a user story + brief acceptance criteria. Don't write code.
  - { id: aturan, type: info, label: Project rules, text: Follow the existing code patterns and run the tests for the affected module. }
  - { id: be, type: agent, agent: backend-engineer, label: Implementation }
  - id: qa
    type: agent
    agent: qa-tester
    label: Test the acceptance criteria
    verdict: true
    instructions: Test every acceptance criterion from the PO step. PASS only if there are no blocking bugs.
  - id: lolos
    type: condition
    label: QA passed?
    source: qa
    check: Did QA pass with no blocking bugs?
  - { id: selesai, type: output, label: Final report }
edges:
  - { from: start, to: po }
  - { from: po, to: be }
  - { from: aturan, to: be }
  - { from: be, to: qa }
  - { from: qa, to: lolos }
  - { from: lolos, to: selesai, when: true }
  - { from: lolos, to: be, when: false, loop: 2 }
---

An example workflow. Notes in this section are sent to every agent as workflow context.
