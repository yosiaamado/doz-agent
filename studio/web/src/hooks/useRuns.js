import { useCallback, useEffect, useRef, useState } from 'react';
import { api, connectEvents } from '../lib/api.js';
import { emptyRun, reduceRun } from '../lib/model.js';

// State run yang sedang ditampilkan + daftar run. Event WebSocket direduksi ke run yang sama.
// `onRunStarted(ev)` dipanggil saat run baru muncul (mis. dari Claude Code) supaya UI bisa mengikutinya.
export function useRuns({ onRunStarted } = {}) {
  const [run, setRun] = useState(emptyRun());
  const [runs, setRuns] = useState([]);
  // Id disimpan di ref supaya event beruntun sebelum render berikutnya tetap masuk ke run yang benar.
  const runIdRef = useRef(null);
  const startedRef = useRef(onRunStarted);
  startedRef.current = onRunStarted;

  const show = useCallback((state) => {
    runIdRef.current = state.id;
    setRun(state);
  }, []);

  const refresh = useCallback(() => api.runs().then(setRuns).catch(() => {}), []);

  const select = useCallback(async (id) => {
    if (!id) {
      show(emptyRun());
      return null;
    }
    runIdRef.current = id;
    const { events } = await api.run(id);
    if (runIdRef.current !== id) return null;
    const state = events.reduce(reduceRun, emptyRun(id));
    show(state);
    return state;
  }, [show]);

  useEffect(() => connectEvents((msg) => {
    if (msg.type !== 'event') return;
    const ev = msg.event;
    if (ev.type === 'run_start' || ev.type === 'run_end') refresh();
    if (ev.run === runIdRef.current) {
      setRun((r) => (r.id === ev.run ? reduceRun(r, ev) : r));
    } else if (ev.type === 'run_start') {
      show(reduceRun(emptyRun(ev.run), ev));
      startedRef.current?.(ev);
    }
  }), [refresh, show]);

  return { run, runs, runId: () => runIdRef.current, show, select, refresh };
}
