import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { subscribe } from '../lib/events.js';
import { createLatest } from '../lib/latest.js';

export function useProfiles() {
  const [state, setState] = useState({ profiles: [], activeProfileId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const latest = useRef(createLatest());

  const refresh = useCallback(async () => {
    const isCurrent = latest.current.next();
    try {
      const data = await api.profiles();
      if (!isCurrent()) return;
      setState({ profiles: data.profiles, activeProfileId: data.activeProfileId });
      setError(null);
    } catch (err) {
      if (isCurrent()) setError(err);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const guard = latest.current;
    refresh();
    const stop = subscribe((msg) => { if (msg.type === 'profiles') refresh(); });
    return () => { stop(); guard.cancel(); };
  }, [refresh]);

  const mutate = useCallback(async (call) => {
    const result = await call();
    await refresh();
    return result;
  }, [refresh]);

  const active = state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
  return {
    ...state,
    active,
    loading,
    error,
    refresh,
    switchTo: (id) => mutate(() => api.switchProfile(id)),
    create: (body) => mutate(() => api.createProfile(body)),
    update: (id, body) => mutate(() => api.updateProfile(id, body)),
    remove: (id) => mutate(() => api.deleteProfile(id)),
    setKey: (id, key, remember) => mutate(() => api.setProfileKey(id, key, remember)),
    clearKey: (id) => mutate(() => api.clearProfileKey(id)),
    auth: (id) => api.profileAuth(id),
    login: (id, useConsole) => api.profileLogin(id, useConsole),
  };
}
