---
name: audit-keamanan
description: A read-only security audit (STRIDE + OWASP), then you decide whether the findings get fixed; if so, an engineer fixes them and security re-checks.
defaults: { inputs: previous }
nodes:
  - { id: start, type: start, label: Audit scope, input: Audit every endpoint and the authentication. }
  - { id: audit, type: agent, agent: security-tester, label: Security audit, permission: read-only, verdict: true, instructions: PASS only if there are no Critical/High findings. }
  - { id: aman, type: condition, label: "Clean?", source: audit }
  - { id: putuskan, type: approval, label: "Fix the findings?", message: There are Critical/High findings. Approve to ask an engineer to fix them. }
  - { id: perbaiki, type: agent, agent: backend-engineer, label: Fix the findings, instructions: Fix the Critical/High findings from the audit. Include a test for each fix. }
  - { id: cek-ulang, type: agent, agent: security-tester, label: Re-check, permission: read-only, inputs: all }
  - { id: laporan, type: output, label: Audit report }
edges:
  - { from: start, to: audit }
  - { from: audit, to: aman }
  - { from: aman, to: laporan, when: true }
  - { from: aman, to: putuskan, when: false }
  - { from: putuskan, to: perbaiki, when: true }
  - { from: putuskan, to: laporan, when: false }
  - { from: perbaiki, to: cek-ulang }
  - { from: cek-ulang, to: laporan }
---

The audit must not modify any file. Fixes happen only after you approve.
