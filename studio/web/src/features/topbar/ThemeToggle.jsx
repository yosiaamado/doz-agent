import { flushSync } from 'react-dom';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const META = {
  system: { icon: Monitor, label: 'topbar.theme.system' },
  light: { icon: Sun, label: 'topbar.theme.light' },
  dark: { icon: Moon, label: 'topbar.theme.dark' },
};

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ThemeToggle({ preference, setPreference }) {
  const { t } = useI18n();
  const change = (event) => {
    const next = NEXT[preference] ?? 'system';
    if (!document.startViewTransition || prefersReducedMotion()) {
      setPreference(next);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const resolved = next === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
    const transition = document.startViewTransition(() => {
      document.documentElement.dataset.theme = resolved;
      flushSync(() => setPreference(next));
    });
    transition.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 480, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
    )).catch(() => {});
  };
  const { icon: Icon, label } = META[preference] ?? META.system;
  return (
    <button type="button" className="icon-btn" title={t('topbar.theme.title', { label: t(label) })} aria-label={t(label)} onClick={change}>
      <Icon size={17} />
    </button>
  );
}
