import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { subscribe } from '../lib/events.js';
import { emptyRun, reduceRun } from '../lib/model.js';

// The state of the run being displayed plus the run list. WebSocket events are reduced into the same run.
// `onRunStarted(ev)` is called when a new run appears (e.g. from Claude Code) so the UI can follow it.
export function useRuns({ onRunStarted } = {}) {
  const [run, setRun] = useState(emptyRun());
  const [runs, setRuns] = useState([]);
  // The id is kept in a ref so events arriving back to back before the next render still land on the right run.
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

  useEffect(() => subscribe((msg) => {
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
