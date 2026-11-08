# Company repo

Keeps `company/` (the profile and the division folders) in its own private git repo, so every project and every machine reads the same, current company record.

## Setup

1. Create a private repo for the company, e.g. `<owner>/<company>-data`. To start from an existing `company/` folder, push its contents to that repo, then delete the local folder.
2. Run `/doz-agent:update-company` and pick **Repo**: it writes `company-repo.json` (gitignored) and clones the repo at once. The file looks like:

```json
{
  "enable-company": true,
  "repo": "https://github.com/<owner>/<company-repo>.git",
  "branch": "main",
  "auto-push": true
}
```

| Key | Meaning |
|---|---|
| `enable-company` | `true` = `company/` is a clone of `repo`. `false` = `company/` is a plain local folder |
| `repo` | Clone URL. HTTPS or SSH, using the git credentials already on the machine |
| `branch` | Branch to read and write. Default `main` |
| `auto-push` | `false` = changes are committed in `company/` but never pushed |

3. Both `company/` and `company-repo.json` stay in `.gitignore`.

## What happens when enabled

- **Session start**: the plugin hook clones `repo` into `company/`, or pulls it (rebase, local edits kept). A failure is reported in one line and the session goes on with the local copy.
- **After each turn**: if anything in `company/` changed, the hook commits it, pulls, and pushes. A failed push is retried after the next turn.
- Agents and skills read and write `company/` exactly as without a repo.

The hook script is `hooks/company-sync.sh` in the plugin. A second hook, `hooks/company-guard.sh`, turns any shell command that deletes or moves a file in `company/` into a permission prompt, in both modes.
