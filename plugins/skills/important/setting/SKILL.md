---
name: setting
description: Use when the user invokes /setting or wants to see or change this plugin's settings — where the company record lives (local or repo), the company repo, its branch, or auto-push ("ganti repo company", "matiin auto push", "pindah ke local", "setting apa aja").
argument-hint: "[setting and new value]"
---

# Settings

Shows and changes `company-repo.json` in the project root, the only settings file of this plugin. Talk to the user in their language.

**Request:** $ARGUMENTS

## 1. Show

Read `company-repo.json`. If it's missing, say the company record isn't initialized yet, and offer `/doz-agent:update-company` (it asks Local or Repo). Stop.

Show the current values as a short table:

| Setting | Key | Values |
|---|---|---|
| Storage | `enable-company` | `true` = Repo, `false` = Local |
| Repo | `repo` | clone URL |
| Branch | `branch` | default `main` |
| Auto-push | `auto-push` | `false` = commit in `company/` but never push |

If the request already names the change, go to step 3. Otherwise ask with `AskUserQuestion`: "Which setting?" — options Storage, Repo, Branch, Auto-push. Then ask for the new value (a choice for Storage and Auto-push, in chat for Repo and Branch).

## 2. Rules

The sync script is `../../../hooks/company-sync.sh` from this skill's base directory (`Glob` for `**/hooks/company-sync.sh` under `~/.claude/plugins` if you can't resolve it). Run git and the script from the project root. `owner/repo` becomes `https://github.com/owner/repo.git`.

| Change | Also do |
|---|---|
| Local → Repo | Needs a repo; ask if `repo` is still a placeholder. If `company/` has files but no `.git`: ask before pushing them, then `git -C company init -b <branch>`, add, commit, `remote add origin <repo>`, `push -u origin <branch>`. If the push is rejected (the repo already has content), tell the user and stop; don't force. Otherwise run `bash <script> pull` |
| Repo → Local | Nothing else. `company/` stays as it is; the hook stops syncing it |
| Repo URL | If `company/.git` exists, `git -C company remote set-url origin <repo>`, then `bash <script> pull` |
| Branch | If `company/.git` exists, `git -C company fetch origin` and `git -C company checkout <branch>`. A branch missing on the remote is created by the next push |
| Auto-push | Nothing else |

## 3. Apply

Write the new value into `company-repo.json`, keeping the other keys. Make sure `company/` and `company-repo.json` are in `.gitignore`. Show the change as `key: before → after`, and the one line from the script or git if one ran. If a step failed, show the error line and what's left as it was; a private repo needs git credentials on this machine (`gh auth login` or an SSH key).
