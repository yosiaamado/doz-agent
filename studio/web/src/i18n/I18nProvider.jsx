// Bahasa UI: disimpan di localStorage (`doz-studio:locale`), <html lang> ikut berubah.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage.js';
import { DEFAULT_LOCALE, detectLocale, intlLocale, normalizeLocale, plural, translate } from './index.js';

const KEY = 'doz-studio:locale';

const fallbackT = (key, vars) => translate(DEFAULT_LOCALE, key, vars);
const fallback = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: fallbackT,
  tp: (base, count, vars) => plural(fallbackT, intlLocale(DEFAULT_LOCALE), base, count, vars),
  intl: intlLocale(DEFAULT_LOCALE),
};
const I18nContext = createContext(fallback);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => normalizeLocale(readStorage(KEY)) ?? detectLocale());
  useEffect(() => {
    document.documentElement.lang = locale;
    writeStorage(KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next) => setLocaleState((cur) => normalizeLocale(next) ?? cur), []);
  const value = useMemo(() => {
    const t = (key, vars) => translate(locale, key, vars);
    const intl = intlLocale(locale);
    return { locale, setLocale, t, tp: (base, count, vars) => plural(t, intl, base, count, vars), intl };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
