// Menjalankan fn dengan signal sendiri yang ikut batal saat node dihentikan atau waktu habis.
export function withTimeout(minutes, signal, fn) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  let timer;
  const timeout = new Promise((_, reject) => {
    if (!minutes) return;
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`timeout ${minutes} menit`));
    }, minutes * 60_000);
  });
  return Promise.race([fn(ctrl.signal), timeout]).finally(() => {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  });
}
