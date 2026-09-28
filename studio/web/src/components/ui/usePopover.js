import { useCallback, useLayoutEffect, useState } from 'react';

// Posisi popover (fixed) di bawah anchor; pindah ke atas kalau ruang di bawah tidak cukup.
export function usePopover(anchorRef, open, { minWidth = 200, maxHeight = 320 } = {}) {
  const [style, setStyle] = useState(null);
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, minWidth);
    const left = Math.min(r.left, window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - 8;
    const up = below < Math.min(maxHeight, 220) && r.top > below;
    setStyle(up
      ? { left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(maxHeight, r.top - 8) }
      : { left, width, top: r.bottom + 4, maxHeight: Math.min(maxHeight, below) });
  }, [anchorRef, minWidth, maxHeight]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  return style;
}
