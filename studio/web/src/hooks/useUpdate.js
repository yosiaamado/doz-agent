import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { createLatest } from '../lib/latest.js';

// The state of the update feature: local status (no network), the last check result, and the check/apply progress.
// Every failure is caught: being offline or an endpoint error must never disturb the studio (AC-10).
export function useUpdate() {
  const [status, setStatus] = useState(null);
  const [checked, setChecked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(null);
  const busy = useRef(false); // prevents a double check/apply
  const latest = useRef(createLatest());

  // Only the latest refresh may overwrite the status (the refresh from mount can land later); unmounting cancels everything.
  const refreshStatus = useCallback(() => {
    const isCurrent = latest.current.next();
    return api.updateStatus().then((s) => { if (isCurrent()) setStatus(s); return s; }).catch(() => null);
  }, []);
  useEffect(() => {
    const guard = latest.current;
    refreshStatus();
    return () => guard.cancel();
  }, [refreshStatus]);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setError(null);
    setApplied(null);
    try {
      setChecked(await api.updateCheck());
    } catch (err) {
      setChecked(null);
      setError(err);
    } finally {
      busy.current = false;
      setChecking(false);
      refreshStatus();
    }
  }, [refreshStatus]);

  // The check result on display: this session's check, or the last result the server still remembers.
  const result = checked ?? status?.available ?? null;

  const apply = useCallback(async (overwriteLocalEdits) => {
    if (busy.current || !result?.updateAvailable) return;
    busy.current = true;
    setApplying(true);
    setError(null);
    try {
      setApplied(await api.updateApply({ contentVersion: result.contentVersion, overwriteLocalEdits: Boolean(overwriteLocalEdits) }));
      setChecked(null);
    } catch (err) {
      setError(err);
      // The server's manifest cache has expired: the old result must not be reused.
      // UPDATE_REQUIRES_NEW_APP: the Update button cannot help; the check result is discarded and the message points to the new installer.
      if (err.code === 'UPDATE_STALE_MANIFEST' || err.code === 'UPDATE_REQUIRES_NEW_APP') setChecked(null);
    } finally {
      busy.current = false;
      setApplying(false);
      refreshStatus();
    }
  }, [result, refreshStatus]);

  // After a successful apply the server drops the cached check result, so status.available goes empty too (checked in updateService).
  const available = Boolean(result?.updateAvailable) && !applied;
  return { status, result, checking, applying, error, applied, available, check, apply };
}
