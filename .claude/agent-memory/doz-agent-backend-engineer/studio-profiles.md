## Studio profiles (S1)  (commit: uncommitted on 22ef406)
Flow:  /api/profiles/* → routes/profileRoutes.js → services/profileService.js (spawnContext, validation) → infra/profileStore.js (config.json profiles[]/activeProfileId, per-record key via apiKeyStore fields option)
Env:   lib/spawnEnv.js buildSpawnEnv; process.env is never written. runService passes `spawn` to WorkflowRun; executors give runners opts.env/profileId; usageService is keyed by profileId.
Files: server/infra/{profileStore,config}.js · server/services/{profileService,setupService,usageService,runService}.js · server/runners/{claude-cli,api,shell}.js · test/profiles.test.js
Traps: createProfileService takes injectable {env, homedir, spawn} (tests use a temp homedir; never the real home); config.profiles replaces savedApiKey/saveApiKey;
       migrateProfiles writes config.json at every createConfig (fresh installs too); any new server code needs en+id keys `error.<kebab>` (test/i18n-codes) or the suite fails;
       api runner getClient passes apiKey/authToken explicitly (null) so the SDK never reads process.env; fake claude bin on Windows needs a .cmd shim.
## Stream (S2)
Flow:  claude-cli runClaude → runners/stream.js reduceStreamEvent (state.tools maps toolUseId→{name,parentId}; blocked ids dedupe permission_denials) → onActivity → engine.recordActivity
Traps: reducer merges emptyStreamState() so old callers passing a partial state work; activity objects are compacted (no undefined keys); claude CLI was logged out here so D5 denial text is unverified (isPermissionDenial regex is the spec guess).
