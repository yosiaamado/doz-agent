#!/usr/bin/env bash
# PreToolUse guard: a shell command that deletes or moves anything and mentions company/
# is turned into a permission prompt, so only the user can approve it.
# Matching is on the raw tool input; a false positive only costs one extra prompt.
input="$(cat)"
printf '%s' "$input" | grep -Eq 'company' || exit 0
verbs='(^|[^A-Za-z0-9_-])(rm|rmdir|mv|unlink|shred|trash|del|erase|rd|ren|move)([^A-Za-z0-9_]|$)|git[^"]*[[:space:]](rm|mv|clean)([^A-Za-z0-9_]|$)|-delete|Remove-Item|Move-Item|Rename-Item|rmtree|os\.(remove|unlink|rename|replace)|shutil\.move|\.unlink\(|\.rename\('
printf '%s' "$input" | grep -Eq "$verbs" || exit 0
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"This command deletes or moves files in company/. Only you can approve that."}}'
exit 0
