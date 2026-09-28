import { useEffect, useState } from 'react';

// Jam yang berdetak tiap detik selama `active`, untuk durasi live node yang sedang jalan.
export function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
