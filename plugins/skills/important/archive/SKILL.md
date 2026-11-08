---
name: archive
description: Use when the user invokes /archive or wants the company archive in company/ tidied — files in the wrong folder, old or closed items, duplicates, messy names, or "rapikan arsip", "beresin folder company", "hapus file lama".
argument-hint: "[folder or what to tidy]"
---

# Archive — tidy company/

You (the main thread) propose a cleanup of `company/`, the user approves it, then you move files. Talk to the user in their language; file names stay in English.

**Request:** $ARGUMENTS

Every command that moves or deletes a file in `company/` triggers a permission prompt from the plugin's guard hook. That prompt is the user's approval; don't look for a way around it.

## 1. Survey

List `company/` with `Glob`, `path` set to `company` (a search from the project root skips it, since it's gitignored). If `$ARGUMENTS` names a folder, survey only that one. Read a file only when its name doesn't tell you what it is. Never touch `company/.git`, `company/profile.md` or `company-repo.json`.

Look for:

| Finding | Proposed action |
|---|---|
| A file outside the division folders, or in the wrong one | Move to `company/<division>/` (`leadership`, `finance`, `sales`, `marketing`, `customers`, `people`, `legal`, `tech`) |
| A closed or lost deal, a former client, a superseded plan or contract, a weekly review older than 12 weeks | Move to `company/_archive/<division>/`, same file name |
| Two files about the same thing | Merge into the newer one, then archive the older |
| A name that isn't `kebab-case.md` or a dated `YYYY-MM-DD.md` | Rename |
| An empty file, a temp file, an exact duplicate | Delete, only these |

## 2. Propose

Show one table, at most 30 rows: `file | action | to | reason`. Then ask with `AskUserQuestion`: "Apply this cleanup?" — options "Apply all", "Moves only (no deletes)", "Cancel". "Other" lets the user drop rows. Do nothing until they answer.

## 3. Apply

Do merges first with `Edit`. Then run all moves and renames in **one** Bash command (`mkdir -p` the targets, then `mv`), so the user sees one prompt, and deletes in a second command, so they can refuse them separately. If the user refuses a prompt, stop and report what was done.

Fix links in `company/profile.md` that point to a moved file.

## 4. Report

Counts of moved, archived, merged, renamed and deleted files, then one line per file that changed. If `company-repo.json` has `enable-company: true`, say that the plugin commits and pushes the change after this turn, and that anything can be restored from the repo's history.
