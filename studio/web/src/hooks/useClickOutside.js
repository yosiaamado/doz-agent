import { useEffect } from 'react';

export function useClickOutside(refs, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (refs.every((r) => !r.current || !r.current.contains(e.target))) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [refs, onOutside, active]);
}
