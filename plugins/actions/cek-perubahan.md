---
name: cek-perubahan
description: A summary of the files changed in the working tree (git status + diff --stat)
command: git status --short && git diff --stat
timeout_min: 2
---

An action is a shell command run in the project folder. Exit code 0 = PASS, anything else = FAIL, so it can wire straight into a Condition.
