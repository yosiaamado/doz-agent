// One shared socket for every hook. It opens with the first subscriber and closes with the last.
import { connectEvents } from './api.js';

const listeners = new Set();
const statusListeners = new Set();
let stop = null;
let status = 'reconnecting';

function emit(set, value) {
  for (const fn of [...set]) {
    try { fn(value); } catch { /* one broken subscriber must not starve the others */ }
  }
}

function ensure() {
  if (stop) return;
  stop = connectEvents(
    (msg) => emit(listeners, msg),
    (next) => { status = next; emit(statusListeners, next); },
  );
}

function release() {
  if (listeners.size || statusListeners.size || !stop) return;
  stop();
  stop = null;
  status = 'reconnecting';
}

export function subscribe(fn) {
  listeners.add(fn);
  ensure();
  return () => { listeners.delete(fn); release(); };
}

export function subscribeStatus(fn) {
  statusListeners.add(fn);
  ensure();
  return () => { statusListeners.delete(fn); release(); };
}

export const getStatus = () => status;
