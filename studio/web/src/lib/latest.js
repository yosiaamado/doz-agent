// Penjaga urutan untuk request async: hanya panggilan terakhir yang boleh menulis state.
// `next()` mengembalikan fungsi `isCurrent()`; `cancel()` membatalkan semua yang masih berjalan (mis. saat unmount).
export function createLatest() {
  let seq = 0;
  return {
    next() {
      const mine = ++seq;
      return () => mine === seq;
    },
    cancel() {
      seq++;
    },
  };
}
