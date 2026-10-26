// Claude account profiles in config.json: `profiles[]` + `activeProfileId`. The API key of a profile is encrypted by the same
// codec logic as before (see apiKeyStore.js), inside the profile record. Nothing here returns a key except getKey().
import crypto from 'node:crypto';
import { createApiKeyStore } from './apiKeyStore.js';

export const DEFAULT_PROFILE_ID = 'default';
const LEGACY_ENC = 'anthropicApiKeyEnc';
const LEGACY_PLAIN = 'anthropicApiKey';

const defaultRecord = () => ({ id: DEFAULT_PROFILE_ID, name: 'Default', configDir: null });
const isRecord = (p) => p && typeof p === 'object' && typeof p.id === 'string';

// Idempotent and never throws: a failure is logged and the legacy fields stay where they are.
// Ciphertext is copied as-is (never re-encrypted), so an unreadable key survives byte for byte.
export function migrateProfiles(store, logger) {
  try {
    const saved = store.read();
    const profiles = (Array.isArray(saved.profiles) ? saved.profiles : []).filter(isRecord);
    let changed = !Array.isArray(saved.profiles) || profiles.length !== saved.profiles.length;
    if (!profiles.some((p) => p.id === DEFAULT_PROFILE_ID)) {
      profiles.unshift(defaultRecord());
      changed = true;
    }
    const patch = {};
    const hasLegacy = LEGACY_ENC in saved || LEGACY_PLAIN in saved;
    if (hasLegacy) {
      const index = profiles.findIndex((p) => p.id === DEFAULT_PROFILE_ID);
      const target = { ...profiles[index] };
      // A key already on the default profile wins; the legacy copy is dropped either way so no secret lingers at the top level.
      if (!target.apiKeyEnc && !target.apiKey) {
        if (saved[LEGACY_ENC]) target.apiKeyEnc = saved[LEGACY_ENC];
        else if (saved[LEGACY_PLAIN]) target.apiKey = saved[LEGACY_PLAIN];
      }
      profiles[index] = target;
      patch[LEGACY_ENC] = undefined;
      patch[LEGACY_PLAIN] = undefined;
      changed = true;
    }
    if (!profiles.some((p) => p.id === saved.activeProfileId)) {
      patch.activeProfileId = DEFAULT_PROFILE_ID;
      changed = true;
    }
    if (changed) store.merge({ ...patch, profiles });
  } catch (err) {
    logger?.warn('profile migration failed; legacy settings are left untouched', { error: err?.message });
  }
}

export function createProfileStore({ store, codec = null, logger }) {
  const records = () => (Array.isArray(store.read().profiles) ? store.read().profiles : []);
  const write = (next) => store.merge({ profiles: next });

  const keyStores = new Map();
  const keyStoreFor = (id) => {
    if (!keyStores.has(id)) {
      const accessor = {
        file: store.file,
        read: () => records().find((p) => p.id === id) ?? {},
        merge(patch) {
          write(records().map((p) => (p.id === id ? { ...p, ...patch } : p)));
        },
      };
      keyStores.set(id, createApiKeyStore({ store: accessor, codec, logger, fields: { enc: 'apiKeyEnc', plain: 'apiKey' } }));
    }
    return keyStores.get(id);
  };

  const publicRecord = ({ id, name, configDir }) => ({ id, name, configDir: configDir ?? null });

  return {
    list: () => records().map(publicRecord),
    get: (id) => {
      const found = records().find((p) => p.id === id);
      return found ? publicRecord(found) : null;
    },
    activeId: () => {
      const id = store.read().activeProfileId;
      return records().some((p) => p.id === id) ? id : DEFAULT_PROFILE_ID;
    },
    setActive: (id) => { store.merge({ activeProfileId: id }); },
    create({ name, configDir }) {
      const existing = new Set(records().map((p) => p.id));
      let id;
      do { id = `p_${crypto.randomBytes(4).toString('hex')}`; } while (existing.has(id));
      write([...records(), { id, name, configDir }]);
      return { id, name, configDir };
    },
    update(id, patch) {
      write(records().map((p) => (p.id === id ? { ...p, ...patch } : p)));
      return this.get(id);
    },
    remove(id) {
      write(records().filter((p) => p.id !== id));
      keyStores.delete(id);
    },
    // 'none' | 'saved' | 'unreadable' (ciphertext exists but cannot be opened; never deleted automatically)
    keyState: (id) => keyStoreFor(id).state(),
    getKey: (id) => keyStoreFor(id).get(),
    setKey: (id, key) => keyStoreFor(id).set(key),
  };
}
