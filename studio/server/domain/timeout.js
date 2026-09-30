// Runs fn with its own signal, which is aborted when the node is stopped or the time runs out.
export function withTimeout(minutes, signal, fn) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  let timer;
  const timeout = new Promise((_, reject) => {
    if (!minutes) return;
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`timed out after ${minutes} minutes`));
    }, minutes * 60_000);
  });
  return Promise.race([fn(ctrl.signal), timeout]).finally(() => {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  });
}
