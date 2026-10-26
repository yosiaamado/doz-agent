# Doz Studio

A visual editor (boxes + edges, n8n style) and local runner for doz-agent workflows. It is not installed as part of the plugin. Run it from a clone of this repo.

## Features

- **Setup (on first open)**: a wizard that checks and tests every prerequisite:
  - Node.js and git (the `user.name`/`user.email` identity can be filled in right there).
  - Claude Code installed and logged in. The **Log in to Claude account** button runs `claude auth login`, and **Test claude -p** makes a real call to haiku.
  - The Anthropic API key: set for this session or remembered in `studio/.local.json`, then tested with a small call.
  - The project folder.
  - GitHub access: `git ls-remote`, read-only.
  - The doz-agent plugin in Claude Code (optional).

  At least one "brain" (Claude Code or an API key) has to pass its test. The wizard can be reopened via the **Setup** button in the top right.
- **Appearance**: a **dark** theme (n8n-style grey) and a **light** one, optionally following the system (the monitor/sun/moon icon in the top right). The logo doubles as the favicon.
- **An expanding left menu**: when narrow it's just a rail of icons. Point the cursor at it and the menu expands over the canvas, then narrows again when the cursor leaves. It holds: the **Editor | Executions** tabs, search, then the **Agent / Skill / Action / Workflow** components. Components can be dragged onto the canvas (on a small screen too) or double-clicked. `+` creates a new file, the pencil icon edits one.
- **The canvas**: nodes snap to a 20px grid. Dragging with the left or middle button pans the view. Scrolling pans too, Ctrl/⌘ + scroll or pinch zooms, and Shift + drag selects multiple nodes. Sticky notes are resizable.
- **Live status**: a running node is **blue** and the edge leading into it is animated blue. Nodes and edges already passed are **green**, and unselected branches dim. Below each node you see the latest activity, live duration, tokens, the execution count, and the number of files changed.
- **Logs**: a node tree with per-node detail:
  - **Info**: status, time, duration, tokens, cost, model, and the history of each execution.
  - **Input**: the complete prompt, including attached documents.
  - **Output**.
  - **Files**: an old-vs-new diff, loaded when you pick a file.
  - **Command**: the exact `claude -p` command.
  - **Activity**.
- **Documents on a request**: when running a workflow, attach a PRD/spec/notes (md, txt, docx, pdf, images, code files). Text is inlined into the prompt. PDFs and images are read by the agent through the Read tool.
- **Claude Code usage**: the 5-hour session and weekly limits (from the `rate_limit_event` that `claude -p` emits) plus the local token total from `~/.claude/projects`. The Refresh button uses one small haiku call.
- **A file-manager-style folder picker**: the project folder and source folders are chosen through a folder browser, with no path to type. The display stays short (`{workdir}/…`, `~/…`, `plugins/…`).
- **Dropdowns, modals, and confirmations** use custom components that are fully keyboard-operable. No built-in browser `alert`/`confirm`.
- **GitHub sync** (the GitHub button in the top right): see the branch, the commits not yet pushed/pulled, and the changed files, then **Pull** (rebase + autostash), **Commit**, **Commit & Push**, or **Push**. The target can be the **doz-agent repo** (the agents/skills/workflows edited in studio) or the **Active project**. Studio uses the git and GitHub credentials already on the machine (an SSH key or a credential helper), never force-pushes, and masks tokens in the remote URL.
- **Office** (the Canvas | Office switch in the topbar): a roster of every agent, `technical-lead` pinned first. Each card shows what the agent is doing right now (Idle, running node X, or chatting), its current activity line, and what comes next in the active run. Pick an agent to see its todo checklist, nested subagent calls, and its chat. A "Reconnecting" pill appears if the live connection drops.
- **Chat with any agent**: start a chat from Office, continue it later (`--resume` keeps the context), and reopen older chats from the per-agent history list. Chats are **read-only by default**: no file edits, no Bash, no web tools, no subagent delegation, and project settings can't widen that. The per-chat **Allow edits** toggle lets the agent edit files in the project (still no commands). Deleting a chat removes only studio's record; the Claude transcript stays in that profile's config folder.
- **Live Claude Code activity**: runs and chats show subagent (Task) calls nested under their parent with their own tool lines, Skill loads, tool calls and errors, blocked tools, the TodoWrite checklist, rate limits, and the session's model, MCP servers with status, and API key source.
- **Profiles (several Claude accounts)**: the profile switcher in the topbar. Each profile is its own `CLAUDE_CONFIG_DIR` (default profile = `~/.claude`) with its own login and optional API key, so switching profile switches account, usage and limits. Studio never reads the credentials file and only shows keys masked (`sk-…abcd`). Switching is blocked while a run or chat turn is active, and a profile's folder can't change while chats use it.
- **A new workflow** can start blank or from an existing workflow/template (`fitur-kecil`, `fitur-lengkap`, `perbaikan-bug`, `audit-keamanan`, `review-pr`, `rilis`).

## Editing an agent / skill: the idea

| What you want to change | Where | Applies to |
|---|---|---|
| An agent's/skill's general behavior (prompt, tools, default model) | The component editor (the pencil icon) → writes its `.md` file | Every workflow + use through Claude Code |
| Behavior in a single step only | The node's right-hand panel: *Instructions for this step*, model, permission, etc. | That node alone (stored in the workflow file) |

The editor has two modes. **Form** changes frontmatter keys one at a time (other keys and comments are preserved), while **Raw** edits the whole file. The editor shows which workflows use that component and asks for confirmation if you close it with unsaved changes.

## Running it

Requires Node 20+. The `claude-cli` runner needs `claude` on the PATH (including `claude.cmd` on Windows). The `api` runner needs `ANTHROPIC_API_KEY`. Per-node diffs and GitHub sync need the folder to be a git repo with an `origin` remote. If push/pull asks for a password, store the credentials first (e.g. `gh auth login` or an SSH key), because studio cannot display a password prompt.

```bash
cd studio
npm install
npm run build
npm start -- --workdir /path/to/your-project     # open http://localhost:4317
```

On first open, the **Setup** wizard appears. Follow its steps until the **Done** button activates.

- `--workdir` can be changed from the UI (the folder button in the top right). The choice is stored in `studio/.local.json`.
- `--port` or `DOZ_STUDIO_PORT`: a different port (4317 by default). `DOZ_LOG_LEVEL=debug` for more detailed logs.
- `npm run dev`: server + Vite hot reload at http://localhost:5317.
- `npm test`: 280 tests (unit, API and office integration with a fake `claude`, workflow templates, web reducers, design tokens). Two tests fail on Windows only (`api tools: paths are confined…`, `claude-cli runner: prompt over stdin…`); they predate 2.1.0.

## Architecture

It follows the patterns from [everything-claude-code](https://github.com/worldflowai/everything-claude-code) (coding-style, backend/frontend patterns): separate layers, one responsibility per file, state never mutated, input validated, errors handled centrally.

```
server/
├─ index.js            entry: listen + banner
├─ app.js              composition root: assembles config → repository → service → route (dependency injection)
├─ http/               router, middleware (localhost only), respond ({ success, data | error }), schemas (zod), static, socket
├─ routes/             systemRoutes, libraryRoutes, runRoutes, gitRoutes, setupRoutes, profileRoutes, chatRoutes: thin, just validation + calling a service
├─ services/           workflowService, runService, usageService, folderService, attachmentService, gitService, setupService, profileService, chatService
├─ repositories/       componentRepository (agents/skills/actions/workflows across several folders), runLogRepository (JSONL), chatRepository (JSONL per chat)
├─ domain/             engine (orchestration), executors (per node type), graph (pure functions), prompt, workflow, timeout
├─ runners/            claude-cli (prompt via stdin, agent via a file), api (Claude API + local tools), shell, tools, activity, stream (normalized activity events: subagents, skills, todos, init)
├─ infra/              config (workdir, source folders), profileStore, gitdiff (a snapshot per node)
└─ lib/                errors (ApiError), logger (structured JSON), paths, frontmatter, spawnEnv (per-profile child env)

web/src/
├─ App.jsx             assembles the layout; dialogs are lazy-loaded
├─ components/ui/      Select, Combobox, Modal, Dialogs (confirm/prompt), Toast, Segmented, Field, Logo, ErrorBoundary
├─ features/           topbar, sidebar, canvas, settings, logs, dialogs, office, chat, profiles (per feature)
├─ hooks/              useWorkflowEditor, useRuns, useChats, useProfiles, useLibrary, useTheme, useNow, useDebounce, useClickOutside
├─ lib/                api (client + WebSocket), model (pure functions: conversion, the run reducer, edge colours), storage
├─ state/              studioContext
└─ styles/             tokens (dark/light themes), base, ui, layout, canvas, logs, dialogs
```

- **API**: every response is `{ success, data }` or `{ success: false, error, details }`. Input is validated with zod and unexpected errors are hidden (500 + a log entry).
- **Per-node file changes**: the working tree is snapshotted through a temporary git index before and after a node (your index, branch, and stash are untouched). The diff is loaded on selection.
- **The claude-cli runner**: the prompt goes via stdin and agent definitions via a temporary file, so the CLI arguments stay short and safe on Windows. `--plugin-dir plugins` makes the `doz-agent:*` skills available even when the plugin isn't installed. `-p` mode cannot ask for permission, so an agent's tools are allowed up front. Use `permission: read-only` for agents that must not change anything.
- **Security**: the server listens only on `127.0.0.1` and rejects any Host other than localhost and any Origin other than its own port (`npm run dev` also allows Vite's 5317). Component files can only be written into a registered source folder, and API tool paths are confined to the workdir.
