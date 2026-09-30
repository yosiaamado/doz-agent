# agent-usage

Notes on agent usage per workflow, for comparing doz-agent versions against each other. This folder is not installed into a project (the plugin contains only `plugins/`).

- File name: `YYYY-MM-DD.md` (the workflow's date). More than one on the same day → `YYYY-MM-DD-2.md`.
- Contents: a context table (the workflow, its scope, the doz-agent version it ran on), the per-agent token table from the `token-audit` output verbatim, a **Comparison metrics** table with the same rows as the previous file, then short notes.
- Agent changes triggered by an audit are recorded in `CHANGELOG.md` and reference the file here.
- Comparing: compare the Comparison metrics between files, keeping an eye on the version and scope columns (the number of requests/slices, the stack). Workflows with very different scopes can't be compared directly; use $ per slice.
