# Studio Office — profiles, stream visibility, agent chat, Office view (studio 2.1.0)

## Repo context
- Project: `studio/` (paths below are relative to `studio/`). Node 20 ESM server, React 19 + Vite UI, Electron shell runs the same server in-process.
- Commands (run from `studio/`): `npm test` (node --test over `test/` and `tests/`), `npm run i18n:check`, `npm run ui:smoke`, `npm run build`.
- Server layering: `server/app.js` (composition root, DI) → `routes/*Routes.js` (zod parse + one service call, `router.get(...).post(...)` chain, see `server/routes/runRoutes.js:4`) → `services/*` → `repositories/*`, `domain/*`, `runners/*`, `infra/*`.
- Response envelope: handlers return data; `sendSuccess` wraps `{ success: true, data }`. Errors: throw `badRequest|notFound|conflict(message, { code, params })` from `server/lib/errors.js` → `{ success: false, error, code, params, details }`. Codes are SCREAMING_SNAKE_CASE and the UI translates them (`web/src/lib/errorMessage.js`, keys `errors.<code>` style already used). HTTP status is always one of 200/400/403/404/409/500.
- Validation: every body/query through a zod schema in `server/http/schemas.js` (add one block per slice, with a `// --- <Slice> ---` header like the update block at line 73).
- Socket: `server/http/socket.js` `hub.broadcast(message)`; every message is `{ type, ... }`. Today only `{ type: 'event', event }` (run events). FE: `connectEvents` in `web/src/lib/api.js:72`, reconnect every 1500 ms.
- Config storage: **`config.json` in the OS app-data folder** via `createConfigStore` (`server/infra/configStore.js:19`, `read()`/`merge(patch)`); `studio/.local.json` is only the legacy source migrated once by `migrateLegacyFiles`. The brief's "`.local.json`" means this store. API key ciphertext: `server/infra/apiKeyStore.js` (fields `anthropicApiKeyEnc` / `anthropicApiKey`, codec = Electron safeStorage or none).
- Runs: `RunRegistry` (`server/repositories/runLogRepository.js`) = in-memory map + `<workdir>/.doz-studio/runs/<id>.jsonl`, broadcasts `{type:'event', event}` on every `record`.
- FE: `web/src/lib/api.js` (`api.*` methods returning `data`, throwing `ApiRequestError{code,params}`), hooks in `web/src/hooks/` (pattern `useRuns.js`), pure reducers in `web/src/lib/model.js` (`reduceRun`), features in `web/src/features/<feature>/`, UI kit `web/src/components/ui/` (Modal, Dialogs, Select, Segmented, Toast, Field), styles in `web/src/styles/*.css` with tokens in `tokens.css` (`:root[data-theme='dark'|'light']`). i18n: `web/src/i18n/locales/en.json` + `id.json`, `t(key, params)` from `useI18n()`; `npm run i18n:check` fails on a key missing in either locale.
- Claude CLI verified with `claude --help` (2.1.278, 2026-10-26): `-p`, `--output-format stream-json --verbose`, `--agents <json|file>`, `--agent <name>`, `--session-id <uuid>`, `-r/--resume <session-id>`, `--allowedTools`, `--disallowedTools` (comma or space separated), `--tools`, `--permission-mode` (choices `acceptEdits, auto, bypassPermissions, manual, dontAsk, plan`), `--plugin-dir`, `--model`, `--max-turns`. `claude auth login [--console]`, `claude auth status` (JSON on stdout, parsed today in `setupService.js:52`).

## Requirement
Scope decided by the main thread (not to be reopened):
- **S1 Profiles.** Multiple Claude accounts. Profile = `{id, name, configDir|null, optional API key}`. Default profile = `configDir null` (uses `~/.claude`). Non-default `configDir` must be inside the user's home; duplicate name → 400. Stored as `profiles[]` + `activeProfileId` in the config store, migrating the existing single API key into the default profile. Every spawn (claude-cli, shell where relevant, `claude auth login`, usage refresh) gets an env built per spawn: `CLAUDE_CONFIG_DIR` for non-default profiles, `ANTHROPIC_API_KEY` from that profile only. Never write keys into `process.env` (today `setupService.js:149` and `app.js:369` do). Usage reads `<configDir>/projects`. Studio never reads `.credentials.json` and never returns a token; keys only appear masked `sk-…abcd`. Switching while a run or chat is active → 409. Topbar profile switcher + profile management; login button per profile.
- **S2 Stream visibility.** Stop dropping `parent_tool_use_id` events (`claude-cli.js:112`); reduce them. Surface subagent Task calls nested under the parent with their own tool lines, Skill loads, tool calls + errors, TodoWrite checklist, rate limits, session_id, init metadata (model, mcp_servers with status, apiKeySource). One normalized activity event type shared by runs and chats.
- **S3 Chat.** Chat with any agent listed by the component repository. List/create chat, send message, delete chat, list messages. First message spawns `claude -p` with that agent; follow-ups `--resume <session_id>`. Per-workdir JSONL like `runLogRepository`. Read-only by default (writes blocked and shown as blocked); per-chat "Allow edits" toggle with a warning. Task tool disallowed in chats. Delete removes only studio's record; UI states the Claude transcript stays in the profile's config dir. Empty message → 400, unknown agent → 404, CLI failure → inline error + retry, second send while running → 409. Streams via S2 activity events.
- **S4 Office view + restyle.** Agent roster (technical-lead pinned first, default chat target), per-agent live status (Idle / Running node X / Chatting) with current activity line, what's next, todo checklist, nested subagents; chat panel; "Reconnecting" banner. Restyle the app per `plugins/skills/design/fe-base`, `fe-dashboard`, `fe-native-feel`: tokens in `tokens.css`, CSS-only motion, no new dependency, `prefers-reduced-motion`, contrast ≥ 4.5:1 in both themes, all strings in en + id.
- **S5 Desktop + release** (main thread): version 2.0.0 → 2.1.0, README/CHANGELOG, `npm run dist:win`.

## Slices
Build order S1 → S2 → S3 → S4 → S5. Within a slice BE and FE run in parallel off this contract.
- S1 Profiles — BE + FE
- S2 Stream visibility (normalized activity) — BE + FE
- S3 Chat — BE + FE
- S4 Office view + restyle — FE only (no BE change; uses S1–S3 contracts)
- S5 Desktop + release — main thread

---

## API contract

### Shared types

```jsonc
// ProfileView — the only shape a profile ever leaves the server in. Never contains a raw key, ciphertext, or token.
{
  "id": "default",                 // "default" | "p_" + 8 lowercase hex
  "name": "Default",
  "configDir": null,               // absolute path or null (default profile only)
  "isDefault": true,
  "active": true,
  "apiKey": { "state": "saved", "masked": "sk-…abcd" },
  // state: "none" | "saved" | "unreadable" (ciphertext exists, cannot decrypt) | "environment" (default profile only: no saved key, shell env has ANTHROPIC_API_KEY)
  // masked: "sk-…" + last 4 chars when state is "saved" or "environment", else null
  "projectsDir": "C:\\Users\\me\\.claude\\projects"
}
```

```jsonc
// ActivityEvent (S2) — one type for runs and chats. Scope: run+node for runs, chat+turn for chats.
{
  "type": "activity",
  "ts": 1761470000000,
  "run": "20261026-101500-ab12", "node": "build",      // runs
  "chat": "c_9f3a1b2c", "turn": 3,                      // chats (instead of run/node)
  "kind": "tool",
  // kind ∈ init | text | tool | tool_error | blocked | skill | todo | subagent_start | subagent_end | rate_limit
  "text": "Read: server/app.js",   // one line, ≤ 400 chars, workdir prefix stripped (existing behavior)
  "toolUseId": "toolu_01",         // tool, skill, todo, subagent_start, subagent_end, tool_error, blocked
  "parentId": null,                // parent_tool_use_id: the Task/Agent call this line is nested under; null = top level
  "tool": "Read",                  // tool, tool_error, blocked, skill ("Skill"), todo ("TodoWrite")
  "file": "server/app.js",         // tool: only for write tools (existing touchedFile)
  "agent": "backend-engineer",     // subagent_start: input.subagent_type ?? "general-purpose"
  "skill": "doz-agent:fe-base",    // skill: input.skill ?? input.command
  "todos": [{ "content": "Write tests", "status": "in_progress", "activeForm": "Writing tests" }], // todo: full list, ≤ 50 items, content ≤ 200 chars
  "isError": false,                // subagent_end
  "init": {                        // init only
    "model": "claude-opus-5-5", "sessionId": "0b6c…uuid", "apiKeySource": "none",
    "permissionMode": "default", "cwd": "E:/proj",
    "mcpServers": [{ "name": "github", "status": "connected" }],
    "tools": 23                    // count only
  },
  "model": "claude-opus-5-5",      // init (kept: existing reduceRun reads ev.model)
  "session": "0b6c…uuid",          // init (kept for old logs/readers; same as init.sessionId)
  "rateLimit": { "status": "allowed_warning", "rateLimitType": "five_hour", "resetsAt": 1761480000, "utilization": 0.83 } // rate_limit only; only these 4 keys are copied
}
```
Fields absent when not applicable (never `undefined` in JSON). Old run logs (kinds `init|text|tool|tool_error`, no `toolUseId/parentId`) must still render — the FE treats missing `parentId` as top level.

Text per kind (English, raw; FE may build its own label from fields):
| kind | text |
|---|---|
| init | `model <model>` (unchanged) |
| tool | `describeTool(name, input)` (unchanged) |
| skill | `Skill: <skill>` |
| todo | `Todo <completed>/<total>` |
| subagent_start | `<agent>: <input.description ?? first 120 chars of input.prompt>` |
| subagent_end | first 200 chars of the tool_result text |
| tool_error / blocked | first 300 chars of the tool_result text (unchanged rule) |
| rate_limit | `rate limit <status> (<rateLimitType>)` |

### S1 — Profiles

| Method + path | Body | 200 data | Errors |
|---|---|---|---|
| `GET /api/profiles` | – | `{ activeProfileId, profiles: ProfileView[] }` (default first, then by name) | – |
| `POST /api/profiles` | `{ name, configDir }` | `ProfileView` | 400 `PROFILE_NAME_TAKEN`, `PROFILE_DIR_OUTSIDE_HOME`, `PROFILE_DIR_IS_DEFAULT`, `PROFILE_DIR_TAKEN`, zod `VALIDATION` |
| `PUT /api/profiles/:id` | `{ name?, configDir? }` | `ProfileView` | 404 `PROFILE_NOT_FOUND`; 400 same as POST; 400 `PROFILE_DEFAULT_LOCKED` when configDir is sent for default; 409 `PROFILE_BUSY` when configDir changes for the active profile while busy |
| `DELETE /api/profiles/:id` | – | `{ deleted: true }` | 404; 400 `PROFILE_DEFAULT_LOCKED`; 400 `PROFILE_ACTIVE` (switch first) |
| `POST /api/profiles/active` | `{ id }` | `{ activeProfileId }` | 404; 409 `PROFILE_SWITCH_BUSY` when a studio run (`runLog.runs` entry with `run`) is running or any chat turn is running |
| `PUT /api/profiles/:id/api-key` | `{ key, remember }` (same zod as `apiKeyBody`) | `ProfileView` | 404; 400 zod |
| `DELETE /api/profiles/:id/api-key` | – | `ProfileView` | 404 |
| `GET /api/profiles/:id/auth` | – | `{ loggedIn: bool, authMethod: string\|null, apiProvider: string\|null, email: string\|null }` — runs `claude auth status` with that profile's env; copies only these 4 fields | 404 |
| `POST /api/profiles/:id/login` | `{ console?: bool=false }` | `{ started, url, output }` (same as today's `startClaudeLogin`) | 404 |

Validation (zod `profileBody` in schemas.js): `name` trimmed 1–40 chars; `configDir` string 1–4096. Server rules (profileService):
- Name unique case-insensitive across all profiles (including "Default") → `PROFILE_NAME_TAKEN` `{ name }`.
- `configDir`: `path.resolve` it; must be absolute, strictly inside `os.homedir()` (not equal to it), on the same drive on Windows; then `fs.realpathSync` of the nearest existing ancestor must also be inside `realpath(homedir)` (symlink escape). Comparison case-insensitive on win32. Fail → `PROFILE_DIR_OUTSIDE_HOME` `{ dir }`.
- Equal to `<home>/.claude` → `PROFILE_DIR_IS_DEFAULT`. Equal to another profile's dir → `PROFILE_DIR_TAKEN`.
- Created dir: `fs.mkdirSync(dir, { recursive: true })` on create/update.
- `remember: false` on api-key = key held in memory for this process only (per profile), like today.

Compatibility (kept, now target the **active** profile): `PUT/DELETE /api/setup/api-key`, `POST /api/setup/claude-login`, `GET /api/setup` (`claudeAuth` check and `apiKey` check use the active profile's env/key). `GET /api/usage` and `POST /api/usage/refresh` use the active profile and add `profileId` to the response.

Socket: `{ "type": "profiles", "activeProfileId": "p_1a2b3c4d" }` after any profile create/update/delete/switch/key change. FE refetches `GET /api/profiles` and `GET /api/usage`.

Example `POST /api/profiles` → 400:
```json
{ "success": false, "error": "configDir must be inside your home folder", "code": "PROFILE_DIR_OUTSIDE_HOME", "params": { "dir": "D:\\claude-work" } }
```

### S2 — Stream visibility
No new HTTP endpoint. Run events gain the new `activity` kinds/fields above (persisted in run JSONL as today). Node `running` event gains:
```json
{ "type": "node", "node": "build", "status": "running", "agent": "backend-engineer", "label": "Build", "next": [{ "id": "review", "label": "Review" }] }
```
`agent` = node's agent name or null; `next` = direct successors via `outgoing(wf, id)` from `server/domain/graph.js` (all outgoing targets, regardless of edge condition).

### S3 — Chat

```jsonc
// Chat
{
  "id": "c_9f3a1b2c",              // "c_" + 8 lowercase hex
  "agent": "technical-lead",
  "title": "Plan the profiles feature",   // first user message, whitespace collapsed, ≤ 60 chars; "" before the first message
  "profileId": "default",          // the active profile at creation; every turn uses THIS profile's env (the transcript lives there)
  "configDir": null,               // that profile's configDir at creation, for the delete notice
  "workdir": "E:/proj",            // config.getWorkdir() at creation; the cwd of every turn
  "allowEdits": false,
  "sessionId": null,               // set once a turn's init event reported session_id
  "status": "idle",                // idle | running | failed (last turn failed)
  "turns": 0, "cost": 0,
  "createdAt": 1761470000000, "updatedAt": 1761470000000
}
// Message
{ "id": "c_9f3a1b2c:3:user", "turn": 3, "role": "user", "text": "…", "ts": 1761470000000 }
{ "id": "c_9f3a1b2c:3:assistant", "turn": 3, "role": "assistant", "text": "…", "ts": …, "cost": 0.0123 }
{ "id": "c_9f3a1b2c:3:error", "turn": 3, "role": "error", "text": "claude exited with code 1", "ts": …, "errorCode": "CHAT_TURN_FAILED" }
```

| Method + path | Body | 200 data | Errors |
|---|---|---|---|
| `GET /api/chats` | – | `Chat[]` for the current workdir, `updatedAt` desc, max 100 | – |
| `POST /api/chats` | `{ agent, allowEdits?: false }` | `Chat` | 404 `CHAT_AGENT_NOT_FOUND` `{ agent }` (not in `components.list('agents')` non-shadowed) |
| `GET /api/chats/:id` | – | `{ chat, messages: Message[], activity: ActivityEvent[] }` — `activity` = events of the last turn only, ≤ 500 | 404 `CHAT_NOT_FOUND` |
| `POST /api/chats/:id/messages` | `{ text }` | `{ chat, turn }` returned **immediately** (turn runs in background, streams over socket) | 400 `CHAT_MESSAGE_EMPTY` (text.trim() empty); 400 zod (> 100 000 chars); 404; 409 `CHAT_TURN_ACTIVE`; 409 `CHAT_PROFILE_GONE` (chat's profile deleted) |
| `POST /api/chats/:id/retry` | – | `{ chat, turn }` — re-sends the last turn's user text as a new turn; its user message carries `retryOf` (see below) so the UI does not show a duplicate bubble | 400 `CHAT_NOTHING_TO_RETRY` (last turn not failed); 404; 409 `CHAT_TURN_ACTIVE`; 409 `CHAT_PROFILE_GONE` |
| `PUT /api/chats/:id` | `{ allowEdits: boolean }` | `Chat` | 404; 409 `CHAT_TURN_ACTIVE` |
| `DELETE /api/chats/:id` | – | `{ deleted: true, transcriptKept: true, configDir: "<profile configDir or ~/.claude resolved>" }` | 404; 409 `CHAT_TURN_ACTIVE` |

Retry numbering: retry creates turn n+1 that reuses turn n's text; turn n keeps its `error` message. `chat_turn_start.message` for a retry is `{ ..., role: "user", retryOf: n }` with the same text, and the FE renders it as a "Retried" marker, not a duplicate bubble.

Socket message: `{ "type": "chat", "event": ChatEvent }`, ChatEvent:
| `event.type` | Fields |
|---|---|
| `chat_created` | `chat: Chat` |
| `chat_updated` | `chat: Chat` (allowEdits changed, status/title/sessionId changed) |
| `chat_deleted` | `chat: "<id>"` |
| `chat_turn_start` | `chat, turn, ts, message: Message` (role user, optional `retryOf`) |
| `activity` | ActivityEvent with `chat` + `turn` |
| `chat_turn_end` | `chat, turn, ts, status: "done"\|"failed", message: Message` (assistant or error), `cost`, `usage` (`{input,output,cacheRead,cacheWrite}` or null), `sessionId` |

Chat CLI invocation (decided; `buildChatArgs` pure, in claude-cli.js):
```
claude -p --output-format stream-json --verbose
  --agents <tmpfile> --agent <name>
  --session-id <new uuid>        when chat.sessionId is null (each attempt gets a fresh uuid)
  --resume <chat.sessionId>      otherwise
  --disallowedTools Task,Agent,Bash,WebFetch,WebSearch  (+ Edit,Write,NotebookEdit,MultiEdit when read-only)
  --allowedTools <agent tools without Task/Agent/Bash/web tools; also without write tools when read-only>
  --permission-mode dontAsk (read-only) | acceptEdits (allowEdits)
  --setting-sources user --strict-mcp-config   (a cloned repo's settings or MCP config can't widen a chat)
  --plugin-dir <pluginDir>
```
Agent definition file for chats: `tools` = the same filtered list as `--allowedTools` (changed in the security fix round: SEC-1/SEC-2/SEC-6; chats never get Bash or web tools, and allowEdits adds file edit tools only). `--model`/`--effort` not passed (agent frontmatter decides). Prompt = message text over stdin. cwd = `chat.workdir`. env = `profiles.spawnContext(chat.profileId).cliEnv`.
`chat.sessionId` is persisted from the first `init` event of a turn (`session_id`); a turn that dies before init leaves it null.

---

## Data

### config.json (app-data config store)
Before: `{ ..., "anthropicApiKeyEnc": "<b64>" }` or `{ "anthropicApiKey": "sk-ant-…" }`.
After:
```jsonc
{
  "profiles": [
    { "id": "default", "name": "Default", "configDir": null, "apiKeyEnc": "<b64>" },          // or "apiKey": "<plain>" when no codec
    { "id": "p_1a2b3c4d", "name": "Work", "configDir": "C:\\Users\\me\\.claude-work" }
  ],
  "activeProfileId": "default"
}
```
Migration (`migrateProfiles(store)`, run once in `createConfig`, idempotent, never throws): if `profiles` is not an array → create `[default]`, move legacy `anthropicApiKeyEnc` → `profiles[0].apiKeyEnc` and `anthropicApiKey` → `profiles[0].apiKey` **as-is** (ciphertext copied, not re-encrypted; an unreadable ciphertext is kept), set `activeProfileId: "default"`, then remove both legacy top-level fields in the same `merge`. If `activeProfileId` points to a missing profile → reset to `"default"`. Rollback: 2.0.0 reads only the legacy fields → after a downgrade the saved key is gone and must be re-entered (accepted; note in CHANGELOG).

### usage.json
Before `{ updatedAt, info }`. After `{ "byProfile": { "<profileId>": { "updatedAt": n, "info": {…} } } }`. Reading the legacy shape = `byProfile.default`. Written in the new shape on the next rate-limit event.

### Chats — `<workdir>/.doz-studio/chats/<chatId>.jsonl`
One file per chat (mirrors runs; delete = remove file). Line types: `chat_created {chat}`, `chat_updated {patch}`, `chat_turn_start`, `activity`, `chat_turn_end` (same payloads as the socket events, plus `ts`). Summary (`Chat`) is rebuilt by folding the file; in-memory map holds open chats. A file whose last turn has `chat_turn_start` but no `chat_turn_end` and no in-memory process (studio restarted) → that turn is reported as `failed` with message `{ role: "error", errorCode: "CHAT_INTERRUPTED" }` and the chat is sendable. Activity lines per turn capped at 500 in the file (further activity is broadcast but not persisted). Id regex `^c_[0-9a-f]{8}$` checked before any path join. `RunRegistry.watch` ignores the `chats/` folder already (it lists `runs/` only) — no change there. Switching workdir (`POST /api/workdir`) re-points the chat repository (call `chatRepo.watch(config.chatsDir())` next to `runLog.watch`).

---

## File map
Owner per line = the slice's BE or FE engineer. No file has two owners within a slice.

### Backend
- [S1] `server/infra/profileStore.js` — create — `createProfileStore({ store, codec, logger })`: list/get/create/update/remove/setActive/getKey/setKey/keyState over `config.json`; per-profile key encryption reusing the codec logic of `apiKeyStore.js:1` (follow it; may refactor apiKeyStore into a per-record helper); `migrateProfiles(store)`.
- [S1] `server/infra/apiKeyStore.js` — change — keep only what profileStore reuses (or delete if fully absorbed; update `tests/secretStorage.test.js` accordingly).
- [S1] `server/infra/config.js` — change — build profileStore, run `migrateProfiles`, expose `profiles`; remove `savedApiKey/saveApiKey/apiKeyState`; add `chatsDir: () => path.join(workdir, '.doz-studio', 'chats')` (used in S3).
- [S1] `server/lib/spawnEnv.js` — create — `buildSpawnEnv` (see Interfaces). Replaces `server/lib/secretEnv.js`.
- [S1] `server/lib/secretEnv.js` — delete — move callers (`gitService.js`, `shell.js`, `setupService.js`) to `spawnEnv.js` (`gitEnv(extra)` = `{ ...process.env, ...extra }`).
- [S1] `server/services/profileService.js` — create — validation rules above, `spawnContext`, busy guard, socket broadcast `profiles`. Follow `server/services/runService.js:13` (factory + `badRequest/notFound/conflict`).
- [S1] `server/routes/profileRoutes.js` — create — the 9 routes. Follow `server/routes/setupRoutes.js:4`.
- [S1] `server/http/schemas.js` — change — `// --- Profiles (S1) ---` block: `profileCreateBody`, `profileUpdateBody`, `profileActiveBody`, `profileLoginBody` (= claudeLoginBody).
- [S1] `server/services/setupService.js` — change — no `process.env` writes; `setApiKey/clearApiKey/startClaudeLogin/checkClaudeAuth/apiKey check/test('claude-cli'|'api')` use the active profile via `profiles`; `run('claude', …)` gets `env` from `spawnContext().cliEnv` (+ `GIT_TERMINAL_PROMPT=0`).
- [S1] `server/services/usageService.js` — change — `createUsageService({ usageFile, profiles, probe })`; `projectsDir` per call = `profiles.spawnContext().projectsDir`; cache keyed by profileId; `recordRateLimit(info, profileId)`; new usage.json shape.
- [S1] `server/runners/claude-cli.js` — change — `spawnClaude(bin, args, workdir, env)`; `run(opts)` and `judge(opts)` use `opts.env ?? process.env`; `onRateLimit(info, opts.profileId)`.
- [S1] `server/runners/api.js` — change — client per key: `getClient(apiKey)` cached by key (`new Anthropic({ apiKey })`); `apiAvailable(env)`, `testApiConnection(env)`; `run(opts)` reads `opts.env.ANTHROPIC_API_KEY`; `resetClient()` kept (clears cache).
- [S1] `server/runners/shell.js` — change — `runCommand({ command, workdir, signal, onLine, env })`, default `process.env`.
- [S1] `server/domain/engine.js` — change — `WorkflowRun` accepts `spawn` (`SpawnContext`) and keeps it out of every emitted event.
- [S1] `server/domain/executors.js` — change — pass `env: ctx.spawn.cliEnv, profileId: ctx.spawn.profileId` into `runner.run(...)` and `env: ctx.spawn.shellEnv` into `runCommand`.
- [S1] `server/services/runService.js` — change — `start` snapshots `profiles.spawnContext()` and passes it as `spawn`; add `hasStudioActive()` (running entries with `r.run`).
- [S1] `server/app.js` — change — remove lines 365–372 (env injection); wire profileStore/profileService/profileRoutes; runner status `api.available` = active profile key present; usage probe uses active spawn context.
- [S2] `server/runners/stream.js` — create — `reduceStreamEvent`, `toRunResult`, `toUsage`, `sumUsage` moved out of claude-cli.js and extended (algorithm below). Re-export from claude-cli.js so `test/runners.test.js` imports keep working.
- [S2] `server/runners/claude-cli.js` — change — import from `stream.js`; pass `onRateLimit` both to usage and to `onActivity` (rate_limit kind).
- [S2] `server/runners/activity.js` — change — add `describeSkill(input)`, `todoSummary(todos)`, `isPermissionDenial(text)`; `SUBAGENT_TOOLS = new Set(['Task','Agent'])`.
- [S2] `server/domain/engine.js` — change — node `running` patch adds `agent`, `label`, `next` (via `outgoing`).
- [S3] `server/repositories/chatRepository.js` — create — `ChatRegistry` class: `watch(dir)`, `create(chat)`, `append(id, ev, persist=true)` (append JSONL + broadcast `{type:'chat', event}`), `list()`, `get(id)`, `messages(id)`, `lastTurnActivity(id)`, `remove(id)`. Follow `server/repositories/runLogRepository.js:9`.
- [S3] `server/services/chatService.js` — create — `createChatService({ config, components, profiles, chatRepo, runner })`: list/create/get/send/retry/update/remove/hasActive; one `AbortController` per active turn kept in memory.
- [S3] `server/routes/chatRoutes.js` — create — the 7 routes.
- [S3] `server/http/schemas.js` — change — `// --- Chat (S3) ---` block: `chatCreateBody { agent: string 1–64, allowEdits: boolean default false }`, `chatMessageBody { text: string max 100_000 }` (empty check in service so the code is `CHAT_MESSAGE_EMPTY`), `chatUpdateBody { allowEdits: boolean }`.
- [S3] `server/runners/claude-cli.js` — change — `buildChatArgs`, `chat(opts)` method.
- [S3] `server/services/profileService.js` — change — busy guard also checks `chats.hasActive()` (inject a `isBusy` getter in app.js to avoid a cycle).
- [S3] `server/app.js` — change — wire chat repo/service/routes; `chatRepo.watch(config.chatsDir())` at start and in the workdir route; update guard `isRunActive: () => runs.hasActive() || chats.hasActive()`.
- [S3] `server/routes/systemRoutes.js` — change — after `runLog.watch(...)` in `POST /api/workdir`, call `chatRepo.watch(config.chatsDir())` (pass `chatRepo` in deps).

### Frontend
- [S1] `web/src/lib/api.js` — change — `profiles()`, `createProfile(body)`, `updateProfile(id, body)`, `deleteProfile(id)`, `switchProfile(id)`, `setProfileKey(id, key, remember)`, `clearProfileKey(id)`, `profileAuth(id)`, `profileLogin(id, useConsole)`.
- [S1] `web/src/hooks/useProfiles.js` — create — `{ profiles, activeProfileId, active, refresh, switchTo(id), create, update, remove, setKey, clearKey, auth(id), login(id, console) }`; refetch on socket `{type:'profiles'}` (use `connectEvents` in S1; S3 moves it to `subscribe`).
- [S1] `web/src/features/topbar/ProfileSwitcher.jsx` — create — button showing active profile name; menu lists profiles (check on active), "Manage profiles…". 409 `PROFILE_SWITCH_BUSY` → toast with translated error. Follow `web/src/features/topbar/UsageWidget.jsx` + `components/ui/usePopover.js`.
- [S1] `web/src/features/topbar/TopBar.jsx` — change — mount ProfileSwitcher before UsageWidget.
- [S1] `web/src/features/profiles/ProfilesDialog.jsx` — create — list + add/rename/delete, configDir field (hint: "inside your home folder, e.g. ~/.claude-work"), API key set/clear (masked display), "Log in" (calls login, shows returned `url` as a link + `output`), auth status line. Follow `web/src/features/update/UpdateSettings.jsx` + `components/ui/Modal.jsx`.
- [S1] `web/src/features/setup/SetupWizard.jsx` — change — show "Profile: <name>" above the API key + login rows; link "Manage profiles".
- [S1] `web/src/App.jsx` — change — `modal.kind === 'profiles'` → lazy `ProfilesDialog`; pass `onManageProfiles` to TopBar and SetupWizard.
- [S1] `web/src/i18n/locales/en.json`, `id.json` — change — `profiles.*` keys + `errors` for every S1 code.
- [S2] `web/src/lib/activity.js` — create — `emptyActivity()`, `reduceActivity(state, ev)` (shared by runs and chats).
- [S2] `web/src/lib/model.js` — change — `reduceRun` `activity` case also stores `nodes[node].stream = reduceActivity(prev.stream ?? emptyActivity(), ev)`; `node` case keeps `agent`, `label`, `next`.
- [S2] `web/src/features/logs/ActivityTree.jsx` — create — renders an `ActivityState`: init chips (model, apiKeySource, MCP servers with status dot), todo checklist, top-level lines, subagent groups (collapsible, own lines, running/done/failed), blocked lines styled as blocked, rate-limit warning row.
- [S2] `web/src/features/logs/NodeDetail.jsx` — change — mount `ActivityTree` for the selected node's `stream`.
- [S2] `web/src/i18n/locales/en.json`, `id.json` — change — `activity.*` keys.
- [S3] `web/src/lib/events.js` — create — one shared socket: `subscribe(fn) → unsubscribe`, `subscribeStatus(fn) → unsubscribe` (`'open' | 'reconnecting'`), `getStatus()`. Built on `connectEvents` semantics (1500 ms reconnect).
- [S3] `web/src/lib/api.js` — change — `chats()`, `chat(id)`, `createChat(agent, allowEdits)`, `sendChat(id, text)`, `retryChat(id)`, `updateChat(id, body)`, `deleteChat(id)`; `connectEvents` kept but only used by `events.js`.
- [S3] `web/src/hooks/useRuns.js`, `web/src/hooks/useProfiles.js` — change — switch to `subscribe` from `events.js`.
- [S3] `web/src/hooks/useChats.js` — create — `{ chats, selected, select(id), create(agent), send(text), retry(), setAllowEdits(bool), remove(id) }`; reduces `{type:'chat'}` events; per chat `stream = reduceActivity(...)` for the active turn; refetches list + selected chat on status `'open'` after `'reconnecting'`.
- [S3] `web/src/features/chat/ChatPanel.jsx` — create — header (agent, profile badge, Allow-edits toggle with confirm warning), message list (user/assistant/error bubbles; error bubble has Retry), live `ActivityTree` of the running turn, composer (Enter sends, Shift+Enter newline, disabled while running), delete with confirm text stating the transcript stays in `<configDir>`.
- [S3] `web/src/features/chat/ChatList.jsx` — create — chats list + "New chat" (agent picker; default technical-lead).
- [S3] `web/src/App.jsx` — change — `view` state `'canvas' | 'chat'` (persist via `storage.js`), a topbar Segmented to switch; `'chat'` renders ChatList + ChatPanel.
- [S3] `web/src/features/topbar/TopBar.jsx` — change — view Segmented.
- [S3] `web/src/i18n/locales/en.json`, `id.json` — change — `chat.*` + S3 error codes.
- [S4] `web/src/lib/office.js` — create — `deriveOffice({ agents, run, chats })` (Interfaces).
- [S4] `web/src/features/office/OfficeView.jsx` — create — roster column + agent detail (activity line, Running node X, What's next, todos, nested subagents) + embedded ChatPanel for the selected agent's latest chat (or New chat with that agent).
- [S4] `web/src/features/office/AgentCard.jsx` — create — avatar initial, name, status pill, one-line activity (ellipsis), pinned marker.
- [S4] `web/src/components/ui/ReconnectBanner.jsx` — create — `role="status"` `aria-live="polite"` banner shown while `getStatus() === 'reconnecting'` for > 1000 ms.
- [S4] `web/src/App.jsx` — change — view `'chat'` → `'office'` (migrate stored value `'chat'` → `'office'`), mount ReconnectBanner.
- [S4] `web/src/features/topbar/TopBar.jsx` — change — Segmented label Office.
- [S4] `web/src/styles/tokens.css` — change — restyle tokens (spacing, radius, elevation, motion durations/easings, both themes).
- [S4] `web/src/styles/base.css`, `ui.css`, `layout.css`, `canvas.css`, `logs.css`, `dialogs.css` — change — consume tokens; `@media (prefers-reduced-motion: reduce)` in `base.css`.
- [S4] `web/src/styles/office.css` — create — Office + chat styles (also covers ChatPanel/ChatList classes from S3; S3 may ship minimal inline-free class names, S4 styles them).
- [S4] `web/src/i18n/locales/en.json`, `id.json` — change — `office.*`, `reconnecting`.
- [S4] `test/design-tokens.test.js` — create — contrast + reduced-motion + no-new-dependency tests.

### S5 (main thread)
- `studio/package.json`, `studio/package-lock.json` — version 2.1.0
- `studio/README.md` — architecture tree + Profiles/Chat/Office sections
- `CHANGELOG.md` (repo root) — 2.1.0 entry (note: downgrade to 2.0.0 drops the saved key)
- `npm run dist:win`

---

## Interfaces

### S1
- `server/lib/spawnEnv.js` · `buildSpawnEnv(profile, { apiKey, base = process.env, includeApiKey = true }) → env` — pure. Algorithm (load-bearing):
  1. `env = { ...base }`.
  2. Non-default profile: `env.CLAUDE_CONFIG_DIR = profile.configDir`; `delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN` (never inherit shell credentials).
  3. Default profile: inherited `CLAUDE_CONFIG_DIR` / `ANTHROPIC_*` left as-is (they are the user's own).
  4. `includeApiKey && apiKey` → `env.ANTHROPIC_API_KEY = apiKey`.
  5. `includeApiKey === false` (shell): for non-default, step 2 already stripped; for default, a **saved** profile key is never added.
- `server/services/profileService.js` · `spawnContext(profileId = activeProfileId) → SpawnContext` where `SpawnContext = { profileId, configDir, cliEnv, shellEnv, projectsDir }` — `projectsDir = path.join(configDir ?? base.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'projects')`. Throws `notFound PROFILE_NOT_FOUND`. SpawnContext is never serialized or emitted.
- `profileService` · `list() → { activeProfileId, profiles: ProfileView[] }`, `create(body)`, `update(id, body)`, `remove(id)`, `setActive(id)`, `setKey(id, {key, remember})`, `clearKey(id)`, `auth(id)`, `login(id, {console})`, `active() → ProfileView`, `maskKey(key) → "sk-…" + key.slice(-4)`.
- `createProfileService({ store: profileStore, broadcast, isBusy: () => boolean, spawn = child_process.spawn })`.
- claude-cli runner · `run(opts)` / `judge(opts)` accept `opts.env`, `opts.profileId`; `onRateLimit(info, profileId)`.
- api runner · `run(opts)` uses `opts.env.ANTHROPIC_API_KEY`; `apiAvailable(env = process.env) → boolean`; `testApiConnection(env)`.
- `runCommand({ command, workdir, signal, onLine, env })`.
- `WorkflowRun` constructor option `spawn: SpawnContext`.
- `usageService.summary() → { limits, limitsUpdatedAt, local, projectsDir, profileId }`.
- FE `useProfiles()` return shape (File map). `ProfileSwitcher` props `{ profiles, activeProfileId, onSwitch(id), onManage() }`. `ProfilesDialog` props `{ onClose }` (uses `useProfiles` itself).

### S2
- `server/runners/stream.js` · `reduceStreamEvent(state, ev, { workdir, onActivity, onUsage, onRateLimit }) → state`; `state = { result, lastText, usageById, sessionId, tools: { [toolUseId]: { name, parentId } } }`; `toRunResult(state) → { output, cost, usage, turns, warning?, warningCode?, sessionId }`.
- Reducer rules (algorithm not otherwise determined):
  - `system/init` → activity `init` with `init` object (`mcp_servers` → `mcpServers [{name,status}]`, `tools.length` → `tools`, `apiKeySource`, `permissionMode`, `cwd`, `model`, `session_id` → `sessionId`); `state.sessionId = ev.session_id`.
  - `rate_limit_event` → `onRateLimit(info)` always; activity `rate_limit` only when `info.status !== 'allowed'`.
  - `assistant`: usage counted for all messages incl. nested (unchanged). `parentId = ev.parent_tool_use_id ?? null` on every activity from that message. For each `tool_use` block: remember `tools[block.id] = { name, parentId }`; name in `SUBAGENT_TOOLS` → `subagent_start` (`agent`, `toolUseId`); `Skill` → `skill`; `TodoWrite` → `todo` (`todos`); else `tool`. `text` blocks → `text` with `parentId`; `lastText` updated only when `parentId === null`.
  - `user` with `tool_result` blocks: look up `tools[b.tool_use_id]`; if that tool is a subagent tool → `subagent_end` (`isError: !!b.is_error`, `parentId` = the subagent call's own parentId); else if `b.is_error` → `blocked` when `isPermissionDenial(text)` else `tool_error`; `tool` = remembered name; `parentId` = `ev.parent_tool_use_id ?? remembered parentId ?? null`.
  - `result` → as today; additionally each `ev.permission_denials[]` entry whose `tool_use_id` was not already reported as `blocked` → one `blocked` activity.
- `activity.js` · `isPermissionDenial(text) → boolean` — `/permission|haven't granted|not allowed|denied/i`; `todoSummary(todos) → "Todo <done>/<total>"`.
- FE `web/src/lib/activity.js` · `emptyActivity() → ActivityState`; `ActivityState = { lines: Line[] (top level, ≤ 300), subagents: { [toolUseId]: { agent, text, status: 'running'|'done'|'failed', lines: Line[] (≤ 200), parentId } }, order: string[] (top-level line ids and subagent ids in arrival order), todos: Todo[], init: Init|null, rateLimit: RateLimit|null, sessionId: string|null, current: string (text of the latest line anywhere) }`; `Line = { id, kind, text, tool?, ts }`. `reduceActivity(state, ev)`: line with `parentId` in `subagents` → that group's lines; unknown `parentId` → top level; `subagent_start` creates a group (nested subagents: a group whose `parentId` is another group is rendered inside it); `subagent_end` sets status; `todo` replaces `todos`; `init` sets `init` + `sessionId`; `rate_limit` sets `rateLimit`. Pure, returns new objects.
- `ActivityTree` props `{ stream: ActivityState, compact?: boolean }`.
- Node state in `reduceRun`: `nodes[id].stream`, `nodes[id].agent`, `nodes[id].label`, `nodes[id].next`.

### S3
- claude-cli · `buildChatArgs({ agent, sessionId, resume, allowEdits }, { pluginDir, agentsFile }) → string[]` (pure); `chatAgentDefinition(agent) → { [name]: { description, prompt, tools } }`; `chat({ agent, text, sessionId, resume, allowEdits, workdir, env, profileId, signal, onActivity, onUsage }) → Promise<{ output, cost, usage, turns, sessionId }>`; rejects on non-zero exit without a result (message = stderr tail or `claude exited with code N`).
- `chatService` · `list()`, `create({agent, allowEdits})`, `get(id)`, `send(id, {text})`, `retry(id)`, `update(id, {allowEdits})`, `remove(id)`, `hasActive() → boolean`.
- Turn lifecycle in `send`: validate → `append chat_turn_start` (status running, broadcast) → `runner.chat(...)` in background with `onActivity: (a) => append({type:'activity', chat, turn, ...a})` → on first activity with `init.sessionId` and `chat.sessionId === null` → `append chat_updated {sessionId}` → resolve: `chat_turn_end {status:'done', message assistant(output)}`; reject: `chat_turn_end {status:'failed', message error(err.message ≤ 500, errorCode 'CHAT_TURN_FAILED')}`. Title set from the first message.
- FE `useChats()` shape (File map). `ChatPanel` props `{ chat, messages, stream, running, onSend(text), onRetry(), onToggleEdits(bool), onDelete() }`. `ChatList` props `{ chats, agents, selectedId, onSelect(id), onCreate(agent) }`.
- `events.js` · `subscribe(fn: (msg) => void) → () => void`, `subscribeStatus(fn: (status) => void) → () => void`, `getStatus() → 'open'|'reconnecting'`.

### S4
- `web/src/lib/office.js` · `PINNED_AGENT = 'technical-lead'`; `deriveOffice({ agents, run, chats }) → OfficeAgent[]`; `OfficeAgent = { name, description, pinned, status: 'idle'|'running'|'chatting', node: { id, label }|null, activity: string, next: [{id,label}], todos: Todo[], subagents: ActivityState['subagents'], chatId: string|null }`. Rules: order = pinned first, then by name (locale compare). `running` when `run.status === 'running'` and a node with `status === 'running'` has `agent === name` (first such node by `run.order`); `chatting` when a chat with that agent has `status === 'running'`; both → `running` with `chatId` set. `activity` = `node.stream.current` or chat stream `current`, else `''`. `todos`/`subagents` from the same stream. `defaultChatAgent(agents) → 'technical-lead'` if present else first by name.
- `OfficeView` props `{ agents, run, chats (useChats return), onOpenRun(id) }`. `AgentCard` props `{ agent: OfficeAgent, selected, onSelect() }`. `ReconnectBanner` no props.

---

## Tests
BE tests in `test/` (node --test, follow `test/runners.test.js` / `test/setup.test.js` style with temp dirs and fake `spawn`). FE pure tests in `test/web-model.test.js` style.

### S1
- `profiles: migrateProfiles moves an encrypted legacy key into the default profile` — store with `anthropicApiKeyEnc:"X"` → `profiles[0]` = `{id:'default',name:'Default',configDir:null,apiKeyEnc:'X'}`, `activeProfileId:'default'`, no top-level `anthropicApiKey*` left; second run returns identical JSON.
- `profiles: migrateProfiles keeps a plain legacy key and an unreadable ciphertext as-is` — plain → `apiKey`; ciphertext that the codec cannot decrypt is still present byte-for-byte and `keyState('default') === 'unreadable'`.
- `profiles: duplicate name rejected case-insensitively` — create "Work" then "work" → 400 `PROFILE_NAME_TAKEN`; create "default" → 400 `PROFILE_NAME_TAKEN`.
- `profiles: configDir outside home rejected` — `path.join(home,'..','x')`, `home` itself, another drive root (win32 only) and a symlink inside home pointing outside (skip on win32 if symlink creation fails) → each 400 `PROFILE_DIR_OUTSIDE_HOME`; `<home>/.claude` → `PROFILE_DIR_IS_DEFAULT`; a second profile with the same dir → `PROFILE_DIR_TAKEN`.
- `profiles: default cannot be deleted or re-pointed; active cannot be deleted` — 400 `PROFILE_DEFAULT_LOCKED` ×2, 400 `PROFILE_ACTIVE`.
- `profiles: switching while busy is 409` — `isBusy → true` → `setActive` throws 409 `PROFILE_SWITCH_BUSY`, `activeProfileId` unchanged.
- `profiles: no response contains a raw key` — set key `sk-ant-api03-…WXYZ` (len ≥ 20) on a profile; `JSON.stringify(list())` does not contain the key nor its ciphertext; `apiKey.masked === 'sk-…WXYZ'`.
- `spawnEnv: non-default profile gets CLAUDE_CONFIG_DIR and only its own key` — base `{ANTHROPIC_API_KEY:'shell', ANTHROPIC_AUTH_TOKEN:'t', PATH:'p'}`, profile `{configDir:'/h/.cw'}`, apiKey `'k2'` → `{CLAUDE_CONFIG_DIR:'/h/.cw', ANTHROPIC_API_KEY:'k2', PATH:'p'}` and no `ANTHROPIC_AUTH_TOKEN`; without apiKey → no `ANTHROPIC_API_KEY`.
- `spawnEnv: default profile inherits the shell env; shell env never gets a saved key` — default + apiKey `'k'` + `includeApiKey:false` → `ANTHROPIC_API_KEY === base.ANTHROPIC_API_KEY` (or absent if base had none).
- `profiles: process.env is never written` — snapshot `process.env.ANTHROPIC_API_KEY` and `CLAUDE_CONFIG_DIR`; call `setKey`, `setActive`, `setupService.setApiKey`, `clearApiKey`, `login` (fake spawn) → both unchanged; fake spawn received `env.CLAUDE_CONFIG_DIR === profile.configDir` for login on a non-default profile.
- `claude-cli runner: spawn uses opts.env` — fake bin script prints `process.env.CLAUDE_CONFIG_DIR` inside a result event; run with `env:{...,CLAUDE_CONFIG_DIR:'X'}` → output `'X'`; `onRateLimit` called with `(info, 'p_1')`.
- `usage: projects dir follows the active profile and limits are per profile` — two profiles with temp configDirs each holding one transcript; summary for each counts only its own message; `recordRateLimit(info,'p_1')` then summary for default → `limits === null`; legacy `{updatedAt,info}` file → read as default.
- `runService: run snapshots the spawn context` — fake runner captures `opts.env`; start run, switch is 409 while running; captured env has the profile active at start.

### S2
- `stream: subagent events are nested under their Task call` — fixture: assistant `tool_use{id:'t1',name:'Task',input:{subagent_type:'qa-tester',description:'Run QA'}}`, assistant `parent_tool_use_id:'t1'` with `tool_use Read`, user `tool_result{tool_use_id:'t1'}` → activities in order `subagent_start{toolUseId:'t1',agent:'qa-tester',parentId:null}`, `tool{tool:'Read',parentId:'t1'}`, `subagent_end{toolUseId:'t1',isError:false}`.
- `stream: two parallel Task calls keep their own children` — interleaved children of `t1` and `t2` → each child's `parentId` matches its own parent; a tool_result error inside `t2` → `tool_error{parentId:'t2'}`.
- `stream: Agent tool name is treated like Task` — `name:'Agent'` → `subagent_start`.
- `stream: Skill, TodoWrite, init and rate limit` — `Skill{skill:'doz-agent:fe-base'}` → `skill{skill:'doz-agent:fe-base',text:'Skill: doz-agent:fe-base'}`; `TodoWrite` 3 todos (1 completed) → `todo{text:'Todo 1/3', todos.length:3}`; init with `mcp_servers:[{name:'gh',status:'failed'}]`, `apiKeySource:'none'` → `init.mcpServers[0].status==='failed'`, `init.apiKeySource==='none'`, `state.sessionId===session_id`; rate limit `status:'allowed'` → no activity, `onRateLimit` called; `status:'allowed_warning'` → one `rate_limit` activity with exactly the 4 copied keys.
- `stream: permission denial becomes blocked` — tool_result `is_error:true`, content `"Claude requested permissions to use Write, but you haven't granted it yet."` for `tool_use Write` → `blocked{tool:'Write'}`; a result with `permission_denials:[{tool_name:'Edit',tool_use_id:'x'}]` not seen before → one more `blocked{tool:'Edit'}`; same id seen → no duplicate.
- `stream: lastText ignores subagent text` — top-level text "A", nested text "B" → `toRunResult(state).output` falls back to "A" when `result.result` is absent; `sessionId` present on the result.
- `engine: running node event carries agent, label and next` — 2-node workflow a→b with agent `x` on a → first `node` running event for a has `agent:'x'`, `next:[{id:'b',label:<b label>}]`.
- `web activity: reduceActivity nests, ends and replaces todos` — same fixture as the first stream test through `reduceActivity` → `subagents.t1.lines.length === 1`, `status === 'done'`, top-level `lines.length === 0`, `order` = `['t1']`; event with unknown parentId lands in top-level `lines`; two `todo` events → `todos` equals the second list.
- `web activity: old run logs without parentId render top level` — `{kind:'tool',text:'Read: a'}` → `lines.length === 1`.

### S3
- `chat args: first turn uses --session-id, follow-up uses --resume` — `buildChatArgs({sessionId:null,…})` contains `--session-id` followed by a UUID v4 and no `--resume`; with `sessionId:'s1', resume:true` → `--resume s1` and no `--session-id`; both contain `--disallowedTools` `Task,Agent`.
- `chat args: read-only has no write, Bash, web or subagent tool and an explicit mode` and `chat args: allow-edits gets the edit tools only, never Bash or web tools` — read-only: `--disallowedTools` has Task, Agent, Bash, Edit, Write, NotebookEdit, MultiEdit, WebFetch, WebSearch; `--permission-mode dontAsk`; `--setting-sources user`; `--strict-mcp-config`. allowEdits (agent tools `Read,Edit,Write,Bash,Task`): `--allowedTools Read,Edit,Write`, `--permission-mode acceptEdits`, Bash/WebFetch/WebSearch still disallowed.
- `chat: create with unknown agent is 404` — `CHAT_AGENT_NOT_FOUND`.
- `chat: empty message is 400` — `"   \n"` → 400 `CHAT_MESSAGE_EMPTY`; nothing appended to the file.
- `chat: second send while running is 409` — fake runner that never resolves; second `send` → 409 `CHAT_TURN_ACTIVE`; `update` and `remove` → 409 too; `profiles.setActive` → 409 `PROFILE_SWITCH_BUSY`.
- `chat: turn flow persists session and messages` — fake runner emits init `sessionId:'s1'` then resolves `output:'hi'` → `get(id).chat.sessionId === 's1'`, messages `[user, assistant 'hi']`, `status:'idle'`, `turns:1`; second send → runner received `resume:true, sessionId:'s1'`; socket received `chat_turn_start`, `activity`, `chat_updated`, `chat_turn_end` in that order.
- `chat: CLI failure becomes an error message and retry re-sends` — fake runner rejects `"claude exited with code 1"` → `status:'failed'`, last message `role:'error'`, `errorCode:'CHAT_TURN_FAILED'`; `retry` → runner called with the same text, `chat_turn_start.message.retryOf === 1`, only one `role:'user'` message without `retryOf`; `retry` on an idle chat → 400 `CHAT_NOTHING_TO_RETRY`.
- `chat: interrupted turn after restart is failed, not stuck` — file with `chat_created` + `chat_turn_start` only, new ChatRegistry → `get(id).chat.status === 'failed'`, last message `errorCode:'CHAT_INTERRUPTED'`, `send` succeeds (no 409).
- `chat: a chat uses its own profile env` — chat created under profile p_1, then active switched to default → the next turn's runner `env.CLAUDE_CONFIG_DIR === p_1.configDir`; p_1 deleted → `send` 409 `CHAT_PROFILE_GONE`.
- `chat: delete removes only the studio record` — file gone, `list()` excludes it, response `{deleted:true, transcriptKept:true, configDir}`; no file under the fake config dir touched.
- `chat: id is validated before touching disk` — `get('../x')` → 404 `CHAT_NOT_FOUND`.
- `update guard counts chats` — chat turn running → update apply refused with the same code the run guard uses today.
- `web chats: reducing chat events` — pure reducer in `useChats` extracted as `reduceChat(state, msg)` (export it from `web/src/hooks/useChats.js` or `web/src/lib/activity.js`): `chat_turn_start` → status running + user message; `activity` → `stream.current` updated; `chat_turn_end failed` → error message, status failed.

### S4
- `office: technical-lead pinned first, default chat target` — agents `[qa-tester, backend-engineer, technical-lead]` → names order `technical-lead, backend-engineer, qa-tester`, `pinned` only on technical-lead; `defaultChatAgent` → `'technical-lead'`; without it → `'backend-engineer'`.
- `office: status from run and chats` — run running with node `build{agent:'backend-engineer',status:'running',stream.current:'Edit: a.js',next:[{id:'review',label:'Review'}]}` → backend-engineer `status:'running'`, `node.label` set, `activity:'Edit: a.js'`, `next[0].label:'Review'`; a running chat for qa-tester → `'chatting'`; finished run → all `'idle'`.
- `design tokens: text contrast ≥ 4.5 in both themes` — parse `tokens.css`, for each theme compute WCAG contrast of `--text`, `--text-2`, `--muted` against `--bg`, `--panel`, `--panel-2` → every ratio ≥ 4.5.
- `design tokens: reduced motion is honored` — `base.css` contains `@media (prefers-reduced-motion: reduce)` setting `animation-duration` and `transition-duration` to ≤ `0.01ms` for `*`; no `.css` file under `web/src/styles` uses `@keyframes` outside tokens/base without being covered by that rule (i.e. the rule targets `*, *::before, *::after`).
- `design tokens: no new dependency` — `package.json` `dependencies` + `devDependencies` key sets equal the 2.0.0 sets (hard-code the list in the test).
- `npm run i18n:check` and `npm run ui:smoke` pass (existing).

---

## Review focus
- RF-1 [S1] `configDir` path escape (`..`, home itself, other drive, symlink to outside) — the only path the user types that a child process will write into → test: `profiles: configDir outside home rejected`.
- RF-2 [S1] Records that predate the change: legacy encrypted / plain / undecryptable key and legacy usage.json shape → tests: `profiles: migrateProfiles moves an encrypted legacy key into the default profile`, `profiles: migrateProfiles keeps a plain legacy key and an unreadable ciphertext as-is`.
- RF-3 [S1] Key leakage across profiles: shell `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` inherited by a non-default profile, or a key written to `process.env` → test: `spawnEnv: non-default profile gets CLAUDE_CONFIG_DIR and only its own key`.
- RF-4 [S3] A turn interrupted by a studio restart must not leave the chat stuck at 409 forever → test: `chat: interrupted turn after restart is failed, not stuck`.
- RF-5 [S2] Parallel subagents: children must nest under the right parent, including errors → test: `stream: two parallel Task calls keep their own children`.

---

## Decisions & assumptions
- D1 Config lives in app-data `config.json` (the current store), not `studio/.local.json`; the brief's wording referred to the legacy file.
- D2 A shell-provided `ANTHROPIC_API_KEY` counts as the default profile's key (state `environment`) and is never passed to non-default profiles. A saved default-profile key overrides it for claude-cli/api spawns (same precedence as 2.0.0, where the saved key was only injected when the env had none — **changed**: now the saved key wins because the user chose it in studio). If the main thread prefers 2.0.0 precedence, flip step 4 of `buildSpawnEnv` to `includeApiKey && apiKey && !base.ANTHROPIC_API_KEY` for the default profile.
- D3 A saved key makes claude-cli bill against the API key instead of the subscription login (unchanged from 2.0.0). The init chip `apiKeySource` makes this visible.
- D4 Chats keep the profile they were created under (their Claude transcript lives in that config dir); the active profile only applies to new chats and runs.
- D5 Read-only chat enforcement = `-p` default permission mode + `--allowedTools` whitelist (same mechanism as today's read-only agents), with write tools still defined so attempts surface as `blocked`. `dontAsk` is not used. ⚠ ASSUMPTION: the denial text matches `isPermissionDenial` and/or `result.permission_denials` is present; BE engineer verifies with one live `claude -p` run (agent asked to write a file, read-only args) and adjusts the regex/fixture to the real text.
- D6 `--session-id <uuid>` on the first turn so the session id is known up front; persisted only after `init` confirms it. A first turn that died before init retries with a fresh uuid (avoids "session id already in use").
- D7 Subagent tool names `Task` and `Agent` both treated as subagent calls; both disallowed in chats.
- D8 Rate-limit activity emitted only for non-`allowed` statuses to avoid one line per turn.
- D9 `next` = all direct successors, not only the edge that will be taken (verdict unknown while running).
- D10 No "stop chat turn" endpoint in this version (not in scope). Recommendation for a follow-up: `POST /api/chats/:id/stop` mirroring run stop.
- D11 Profile auth status is fetched per profile on demand (`GET /api/profiles/:id/auth`, ~1–5 s) and not included in `GET /api/profiles`, so the list stays instant.
- D12 Downgrade to 2.0.0 loses the saved key (migration removes legacy fields). Accepted; CHANGELOG note in S5.
- D13 S3 ships the chat UI behind a temporary `'chat'` view; S4 replaces it with `'office'` and migrates the stored view value.
- D14 `technical-lead.md` is being written by the main thread; S4 must not depend on its content, only its name.
