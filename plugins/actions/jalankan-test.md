---
name: jalankan-test
description: Jalankan test suite project. Ubah command sesuai stack (npm test, dotnet test, pytest, dll.)
command: npm test --silent
timeout_min: 15
---

Hasil PASS/FAIL dari exit code. Sambungkan ke Condition untuk loop perbaikan ke engineer kalau test gagal.
