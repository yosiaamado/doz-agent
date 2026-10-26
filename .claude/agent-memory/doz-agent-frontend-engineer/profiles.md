## Profiles S1 FE  (commit: uncommitted)
Flow:  TopBar → ProfileSwitcher (menu) / ProfilesDialog (lazy, modal.kind 'profiles') → useProfiles → api.profiles* → /api/profiles ; refetch on socket {type:'profiles'}
Files: hooks/useProfiles.js · lib/profiles.js (pure: safeHttpUrl, buildProfileBody, apiKeyLabel) · features/topbar/ProfileSwitcher.jsx · features/profiles/ProfilesDialog.jsx · test/web-profiles.test.js
Reuses: usePopover/useClickOutside, Modal, Field, useDialog().confirm, errorMessage (error.profile-*)
Traps: App owns one useProfiles (switcher + UsageWidget profileKey + SetupWizard profileId); dialog has its own. Bash heredocs eat backslashes (Windows paths in tests): build with String.fromCharCode(92). i18n check flags id==en values and dynamic t(`...${x}`) keys as unused: use static keys.
