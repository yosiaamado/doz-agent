## Activity S2 FE  (commit: uncommitted)
Flow:  socket activity event → reduceRun(case activity) → nodes[id].stream = reduceActivity → NodeDetail (activity tab) → ActivityTree
Files: lib/activity.js · lib/model.js · features/logs/ActivityTree.jsx · NodeDetail.jsx · test/web-activity.test.js · scripts/ui-smoke.js (renders ActivityTree via ssrLoadModule)
Reuses: KIND_CLASS in logs/shared.jsx; chats (S3) reuse reduceActivity/ActivityTree
Traps: group parentId only set if parent group already exists (no cycles); a fresh node run resets stream (patch never carries stream); state has extra seq field; dynamic t(`..${x}`) keys fail i18n:check, use a static map. Bash heredocs with several scripts can fail whole: use Write/Edit.
