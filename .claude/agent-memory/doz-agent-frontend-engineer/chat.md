## Chat S3 FE  (commit: uncommitted)
Flow:  TopBar view Segmented → App view=chat → ChatView → ChatList + ChatPanel ← useChats (reduceChat on socket {type:chat}) ← lib/events.js shared socket
Files: lib/events.js · hooks/useChats.js · features/chat/{ChatView,ChatList,ChatPanel}.jsx · styles/chat.css · test/web-chat.test.js
Reuses: reduceActivity/ActivityTree (S2), useDialog().confirm, Select
Traps: details exist only for chats opened (no partial history); cost added only when turn > chat.turns (dup events); canvas workspace stays mounted with hidden (needs .workspace[hidden]{display:none}); connectEvents(onMsg,onStatus) no longer reopens after close; ChatPanel keyed by chat.id so the draft resets.
- Traps (review fix): POST responses of send/retry go through applyResponse (only if updatedAt newer); cost dedupe uses chat.endedTurn; useChats.streams holds streams for every chat (Office reads it). deriveOffice prefers chats.selectedId. OfficeView agent pick lives in App (officeAgent).
