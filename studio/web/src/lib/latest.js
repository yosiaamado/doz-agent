// An ordering guard for async requests: only the most recent call may write state.
// `next()` returns an `isCurrent()` function; `cancel()` cancels everything still in flight (e.g. on unmount).
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
