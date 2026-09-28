// localStorage bisa melempar (mode privat / diblokir); semua akses dibungkus.
export function readStorage(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch { /* abaikan */ }
}
