---
name: review-pr
description: Review the current changes. Code review and security review in parallel (read-only), then you decide.
defaults: { permission: read-only }
nodes:
  - { id: start, type: start, label: What to review }
  - { id: review, type: agent, agent: code-reviewer, label: Code review }
  - { id: security, type: agent, agent: security-tester, label: Security review }
  - { id: putuskan, type: approval, label: "Proceed to merge?", message: Read both reports, then approve or reject. }
  - { id: ok, type: output, label: Approved }
  - { id: revisi, type: output, label: Needs revision }
edges:
  - { from: start, to: review }
  - { from: start, to: security }
  - { from: review, to: putuskan }
  - { from: security, to: putuskan }
  - { from: putuskan, to: ok, when: true }
  - { from: putuskan, to: revisi, when: false }
---

Focus on `git diff` against the main branch. Don't modify any file.
