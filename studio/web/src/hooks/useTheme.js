import { useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage.js';

const KEY = 'doz-studio:theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

// Preferensi: 'system' | 'light' | 'dark'. Tema aktif ditulis ke <html data-theme>.
export function useTheme() {
  const [preference, setPreference] = useState(() => readStorage(KEY, 'system'));
  const [systemDark, setSystemDark] = useState(() => media()?.matches ?? true);

  useEffect(() => {
    const mq = media();
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStorage(KEY, preference);
  }, [theme, preference]);

  return { theme, preference, setPreference };
}
