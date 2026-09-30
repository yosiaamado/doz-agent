---
name: jalankan-test
description: Run the project's test suite. Change the command to match the stack (npm test, dotnet test, pytest, etc.)
command: npm test --silent
timeout_min: 15
---

PASS/FAIL comes from the exit code. Wire it into a Condition to loop a fix back to the engineer when tests fail.
