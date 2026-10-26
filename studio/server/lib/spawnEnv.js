// Builds the environment of one child process. Credentials are never written to process.env: each spawn gets its own copy.
import { DEFAULT_PROFILE_ID } from '../infra/profileStore.js';
// Shell-level credentials and routing that would let a non-default profile silently use another account.
const INHERITED_ACCOUNT_VARS = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CONFIG_DIR',
];

export function buildSpawnEnv(profile, { apiKey, base = process.env, includeApiKey = true } = {}) {
  const env = { ...base };
  if (profile && profile.id !== DEFAULT_PROFILE_ID) {
    for (const name of INHERITED_ACCOUNT_VARS) delete env[name];
    if (profile.configDir) env.CLAUDE_CONFIG_DIR = profile.configDir;
  }
  if (includeApiKey && apiKey) env.ANTHROPIC_API_KEY = apiKey;
  return env;
}

export const gitEnv = (extra = {}) => ({ ...process.env, ...extra });
