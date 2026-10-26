export const DEFAULT_PROFILE_ID = 'default';

// A login URL comes from a child process's output: only http(s) may become a link.
export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function apiKeyLabel(t, apiKey) {
  const masked = apiKey?.masked ?? '';
  switch (apiKey?.state) {
    case 'saved': return t('profiles.key.saved', { masked });
    case 'environment': return t('profiles.key.environment', { masked });
    case 'unreadable': return t('profiles.key.unreadable');
    default: return t('profiles.key.none');
  }
}

export function configDirLabel(t, profile) {
  return profile.configDir ?? t('profiles.dir-default');
}

export function authLabel(t, auth) {
  if (!auth) return '';
  if (!auth.loggedIn) return t('profiles.auth.logged-out');
  const who = auth.email ?? auth.authMethod ?? auth.apiProvider;
  return who ? t('profiles.auth.logged-in-as', { who }) : t('profiles.auth.logged-in');
}

// Create always sends the folder; an update sends only what changed, and never a folder for the default profile.
export function buildProfileBody(initial, { name, configDir }) {
  const body = { name: name.trim() };
  const dir = configDir.trim();
  if (initial?.isDefault) return body;
  if (!initial || dir !== (initial.configDir ?? '')) body.configDir = dir;
  return body;
}
