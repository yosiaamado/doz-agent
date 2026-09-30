// Keeps the API key that the studio injects into process.env (from the wizard/config) from leaking into child processes that do not need it.
// A key that was already in the environment before the studio started is left alone: that one belongs to the user.
let injected = null;

export const setInjectedApiKey = (key) => { injected = key || null; };

export function childEnv(extra = {}) {
  const env = { ...process.env };
  if (injected && env.ANTHROPIC_API_KEY === injected) delete env.ANTHROPIC_API_KEY;
  return { ...env, ...extra };
}
