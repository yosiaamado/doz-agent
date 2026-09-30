// Menjaga API key yang disuntikkan studio (wizard/config) ke process.env tidak ikut bocor ke child process yang tidak membutuhkannya.
// Key yang sudah ada di environment sebelum studio start tidak disentuh: itu milik user.
let injected = null;

export const setInjectedApiKey = (key) => { injected = key || null; };

export function childEnv(extra = {}) {
  const env = { ...process.env };
  if (injected && env.ANTHROPIC_API_KEY === injected) delete env.ANTHROPIC_API_KEY;
  return { ...env, ...extra };
}
