---
name: update-company
description: Use when the user invokes /update-company or says the company changed and the profile should reflect it — a new client or prospect, revenue, a hire, a new product or project, money, goals, a legal entity ("update profil perusahaan", "ada klien baru", "nambah karyawan").
---

# Update company profile

Keeps `company/profile.md` in the working directory current for the role agents. Talk to the user in their language; the file stays in English.

## Step 1 — Load

Read `company/profile.md`. If only an older `company-profile.md` exists, move it there. Add a `## History` section if an older file lacks one. If the profile exists, go to Step 2.

**No profile: initialize.** The sync script is `../../../hooks/company-sync.sh` from this skill's base directory (`Glob` for `**/hooks/company-sync.sh` under `~/.claude/plugins` if you can't resolve it); run it from the project root.

1. If `company-repo.json` already has `enable-company: true` and a real `repo`, run `bash <script> pull` and read the profile again; if it now exists, go to Step 2.
2. Otherwise ask with `AskUserQuestion`: "Where should the company record live?" — options "Local" (`company/` in this project only) and "Repo" (a private git repo, synced across projects). For "Repo", ask for the repo (`owner/repo` or a clone URL) in chat unless the user already gave it, and wait.
3. Write `company-repo.json` in the project root, and add it and `company/` to `.gitignore`:
   - **Repo**: `{ "enable-company": true, "repo": "<url>", "branch": "main", "auto-push": true }`, where `owner/repo` becomes `https://github.com/owner/repo.git`. Run `bash <script> pull` and show its one line. If the clone brought `company/profile.md`, go to Step 2. If it failed, tell the user the error (a private repo needs git credentials on this machine: `gh auth login` or an SSH key) and ask whether to continue with Local.
   - **Local**: copy [the example](../../business/company-roles/references/company-repo.example.json) (`enable-company: false`).
4. Create `company/profile.md` from [the template](../../business/company-roles/references/company-profile-template.md). In Repo mode the `Stop` hook commits and pushes it after this turn ([setup](../../business/company-roles/references/company-repo.md)).

## Step 2 — Find out what changed

If the user's message already says what changed, skip to Step 3 and ask only for what's missing. Otherwise ask with `AskUserQuestion`, `multiSelect: true`:

"What changed?"

| Option | Description |
|---|---|
| Client or prospect | New prospect, a deal won or lost, income from a client |
| Team | New employee or contractor, someone left, your own time changed |
| Product or project | New product or project, status or price changed |
| Money, goals or legal | Cash, costs, targets, a PT, other things |

"Other" is added automatically for anything else.

## Step 3 — Ask the follow-ups

Ask only for the categories chosen, at most 4 questions per `AskUserQuestion` call. Offer options built from this profile: real product names, real open prospects. Skip what the user already told you. Free-text answers such as amounts come through "Other", or ask for them in chat when no option fits.

| Category | Ask |
|---|---|
| Client or prospect | New or existing (list the open prospects)? Which product? Stage: prospect, negotiating, paying, lost? How much, one-off or monthly? When is the money expected? |
| Team | Who and what role? Employee, contractor or partner? Monthly cost? Start or end date? |
| Product or project | Which, or new? Who is it for? Status: idea, building, live, paying? Price? |
| Money | Which figure: cash, monthly costs, or other income? New amount? As of which date? |
| Goals | What's the new target, and by when? |
| Legal | Which entity (PT, CV), and what's its status: planned, in process, or done? Date? |

Then pick up to 2 `TODO`s in the profile that would most improve the role agents' advice and offer them as a final optional question, with "Skip" as an option. Priority: cash and monthly costs, then current biggest problem, then product build status.

## Step 4 — Write

1. Change the sections the answer affects: a won prospect moves from Open prospects to Paying customers, a hire updates People and Monthly costs, and so on.
2. Write only what the user stated. Replace `TODO` when answered, keep it otherwise. Resolve relative dates to absolute ones. Write amounts in full with the currency, and whether they're one-off or monthly.
3. If an answer contradicts the file, ask which is right instead of overwriting it.
4. Set `Last updated`, and append one line per change to `## History`: `- <YYYY-MM-DD>: <what changed>`. Keep old History lines.

## Step 5 — Confirm

Show the changes as short before → after lines, and how many `TODO`s remain. Don't paste the whole file. Don't commit it to the project, since it's private. If `company-repo.json` has `enable-company: true`, say that the plugin hook commits and pushes `company/` to the company repo after this turn. If the change raises a real decision (first paying client, a first hire, money running short), name the one role agent worth asking, and leave the call to the user.
