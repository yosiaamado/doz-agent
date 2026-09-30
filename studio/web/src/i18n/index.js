// i18n tanpa dependency: kunci flat `namespace.subject.item`, bahasa sumber `en`, fallback ke `en`, lalu ke kunci itu sendiri.
import en from './locales/en.json' with { type: 'json' };
import id from './locales/id.json' with { type: 'json' };

export const LOCALES = ['en', 'id'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_LABELS = { en: 'English', id: 'Bahasa Indonesia' };
const INTL_LOCALES = { en: 'en-US', id: 'id-ID' };
const DICTS = { en, id };
const warned = new Set();

export function normalizeLocale(value) {
  return LOCALES.includes(value) ? value : null;
}

// Pertama kali dipakai: bahasa browser diawali "id" → id, selain itu en.
export function detectLocale(language = globalThis.navigator?.language) {
  return String(language ?? '').toLowerCase().startsWith('id') ? 'id' : DEFAULT_LOCALE;
}

export function intlLocale(locale = DEFAULT_LOCALE) {
  return INTL_LOCALES[locale] ?? INTL_LOCALES[DEFAULT_LOCALE];
}

// WORKDIR_NOT_FOUND → workdir-not-found
export function kebabFromCode(code) {
  return String(code).toLowerCase().replace(/_/g, '-');
}

function lookup(locale, key) {
  const dict = Object.hasOwn(DICTS, locale) ? DICTS[locale] : DICTS[DEFAULT_LOCALE];
  if (Object.hasOwn(dict, key)) return dict[key];
  return Object.hasOwn(DICTS[DEFAULT_LOCALE], key) ? DICTS[DEFAULT_LOCALE][key] : undefined;
}

// Murni. `{name}` diganti dari vars; placeholder tanpa nilai dibiarkan supaya kelihatan kalau ada yang lupa.
export function translate(locale, key, vars) {
  const raw = lookup(locale, key);
  if (raw === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] kunci tidak ada: ${key}`);
    }
    return String(key);
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(vars, name) && vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : m));
}

// Bentuk jamak: kunci `<base>.one` / `<base>.other`; kategori dipilih Intl.PluralRules sesuai bahasa. `count` otomatis jadi variabel.
export function plural(t, intl, base, count, vars) {
  const category = new Intl.PluralRules(intl).select(count);
  return t(`${base}.${category === 'one' ? 'one' : 'other'}`, { ...vars, count });
}
