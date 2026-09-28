import { Monitor, Moon, Sun } from 'lucide-react';

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const META = {
  system: { icon: Monitor, label: 'Tema: ikut sistem' },
  light: { icon: Sun, label: 'Tema: terang' },
  dark: { icon: Moon, label: 'Tema: gelap' },
};

export default function ThemeToggle({ preference, setPreference }) {
  const { icon: Icon, label } = META[preference] ?? META.system;
  return (
    <button type="button" className="icon-btn" title={`${label} (klik untuk ganti)`} aria-label={label} onClick={() => setPreference(NEXT[preference] ?? 'system')}>
      <Icon size={17} />
    </button>
  );
}
