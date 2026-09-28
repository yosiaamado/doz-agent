---
name: cek-perubahan
description: Ringkasan file yang berubah di working tree (git status + diff --stat)
command: git status --short && git diff --stat
timeout_min: 2
---

Action berupa perintah shell yang dijalankan di folder project. Exit code 0 = PASS, lainnya = FAIL, jadi bisa langsung disambung ke Condition.
