## Studio chat (S3)  (commit: uncommitted on 84a6042)
Flow:  /api/chats/* → routes/chatRoutes.js → services/chatService.js (startTurn, one AbortController per active chat) → repositories/chatRepository.js (ChatRegistry, JSONL fold) ; runner.chat in runners/claude-cli.js (buildChatArgs, chatAgentDefinition)
Files: server/{repositories/chatRepository,services/chatService,routes/chatRoutes}.js · test/chat.test.js
Traps: chat_turn_start carries an extra `title` (set on the first message); chat_updated is stored as {patch} but broadcast as {chat};
       a turn still running when ChatRegistry.watch() reads the file is turned into failed/CHAT_INTERRUPTED (appended to the file), so re-watching mid-turn double-reports;
       profiles.setActive(sameId) does not throw 409 (test the busy guard with a second profile); isBusy in app.js reads `chats` lazily (const defined later);
       D5 denial text unverified: claude CLI is logged out on this machine, isPermissionDenial regex is still the spec guess.
