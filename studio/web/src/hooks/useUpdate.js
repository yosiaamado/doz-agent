import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { createLatest } from '../lib/latest.js';

// State fitur update: status lokal (tanpa jaringan), hasil cek terakhir, dan proses cek/apply.
// Semua kegagalan ditangkap: offline atau endpoint error tidak boleh mengganggu studio (AC-10).
export function useUpdate() {
  const [status, setStatus] = useState(null);
  const [checked, setChecked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState(null);
  const busy = useRef(false); // cegah cek/apply ganda
  const latest = useRef(createLatest());

  // Hanya refresh terbaru yang boleh menimpa status (refresh dari mount bisa mendarat belakangan); unmount membatalkan semuanya.
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

  // Hasil cek yang ditampilkan: cek sesi ini, atau hasil terakhir yang masih diingat server.
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
      // Cache manifest di server sudah habis: hasil lama tidak boleh dipakai lagi.
      // UPDATE_REQUIRES_NEW_APP: tombol Update tidak bisa menolong; hasil cek dibuang dan pesan mengarahkan ke installer baru.
      if (err.code === 'UPDATE_STALE_MANIFEST' || err.code === 'UPDATE_REQUIRES_NEW_APP') setChecked(null);
    } finally {
      busy.current = false;
      setApplying(false);
      refreshStatus();
    }
  }, [result, refreshStatus]);

  // Setelah apply sukses server membuang cache hasil cek, jadi status.available ikut kosong (dicek di updateService).
  const available = Boolean(result?.updateAvailable) && !applied;
  return { status, result, checking, applying, error, applied, available, check, apply };
}
