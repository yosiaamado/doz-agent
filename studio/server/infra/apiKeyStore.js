// Storage for the Anthropic API key in config.json. With a `codec` (injected by the Electron main process from
// safeStorage: DPAPI on Windows, Keychain on macOS) only base64 ciphertext is stored.
// Without a codec (e.g. `npm start`) the key is stored as plain text; it is then protected only by the file permissions / the user's OS profile.
const ENCRYPTED_FIELD = 'anthropicApiKeyEnc';
const PLAIN_FIELD = 'anthropicApiKey';

export function createApiKeyStore({ store, codec = null, logger }) {
  let warnedPlain = false;
  const warnPlainOnce = () => {
    if (warnedPlain) return;
    warnedPlain = true;
    logger?.warn('API key is stored as plain text in config.json (OS encryption is not available in this mode); only file/user-profile permissions protect it', { file: store.file });
  };

  let warnedUnreadable = false;
  const warnUnreadableOnce = (message, fields) => {
    if (warnedUnreadable) return;
    warnedUnreadable = true;
    logger?.warn(message, fields);
  };

  const decryptSaved = (saved) => {
    if (!saved[ENCRYPTED_FIELD]) return null;
    if (!codec) {
      warnUnreadableOnce('The saved API key is encrypted but OS encryption is not available in this mode; run the desktop app or enter the key again');
      return null;
    }
    try {
      return codec.decrypt(saved[ENCRYPTED_FIELD]);
    } catch (err) {
      warnUnreadableOnce('The saved API key could not be decrypted (created under another account/machine, or the OS key was not persisted); enter it again. The ciphertext is kept.', { error: err?.message });
      return null;
    }
  };

  const api = {
    // 'none' | 'saved' | 'unreadable'. Ciphertext that fails to decrypt is NOT deleted: the cause may be temporary.
    state() {
      const saved = store.read();
      if (saved[ENCRYPTED_FIELD] && !decryptSaved(saved)) return 'unreadable';
      return saved[ENCRYPTED_FIELD] || saved[PLAIN_FIELD] ? 'saved' : 'none';
    },
    get() {
      const saved = store.read();
      const decrypted = decryptSaved(saved);
      if (decrypted) return decrypted;
      const plain = saved[PLAIN_FIELD] ?? null;
      if (plain && codec) api.set(plain); // migrate a legacy plain-text key to the encrypted form on first read
      else if (plain) warnPlainOnce();
      return plain;
    },
    set(key) {
      if (!key) {
        store.merge({ [PLAIN_FIELD]: undefined, [ENCRYPTED_FIELD]: undefined });
        return;
      }
      if (codec) {
        try {
          store.merge({ [ENCRYPTED_FIELD]: codec.encrypt(key), [PLAIN_FIELD]: undefined });
          return;
        } catch (err) {
          logger?.warn('API key encryption failed; storing as plain text', { error: err?.message });
        }
      }
      warnPlainOnce();
      store.merge({ [PLAIN_FIELD]: key, [ENCRYPTED_FIELD]: undefined });
    },
  };
  return api;
}
