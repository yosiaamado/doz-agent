import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const META = {
  system: { icon: Monitor, label: 'topbar.theme.system' },
  light: { icon: Sun, label: 'topbar.theme.light' },
  dark: { icon: Moon, label: 'topbar.theme.dark' },
};

export default function ThemeToggle({ preference, setPreference }) {
  const { t } = useI18n();
  const { icon: Icon, label } = META[preference] ?? META.system;
  return (
    <button type="button" className="icon-btn" title={t('topbar.theme.title', { label: t(label) })} aria-label={t(label)} onClick={() => setPreference(NEXT[preference] ?? 'system')}>
      <Icon size={17} />
    </button>
  );
}
