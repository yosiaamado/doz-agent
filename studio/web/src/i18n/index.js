// i18n with no dependencies: flat `namespace.subject.item` keys, `en` as the source language, falling back to `en`, then to the key itself.
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

// On first use: a browser language starting with "id" → id, otherwise en.
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

// Pure. `{name}` is substituted from vars; a placeholder with no value is left in place so a forgotten one is visible.
export function translate(locale, key, vars) {
  const raw = lookup(locale, key);
  if (raw === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    return String(key);
  }
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(vars, name) && vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : m));
}

// Plural forms: the keys `<base>.one` / `<base>.other`; the category is picked by Intl.PluralRules for the language. `count` automatically becomes a variable.
export function plural(t, intl, base, count, vars) {
  const category = new Intl.PluralRules(intl).select(count);
  return t(`${base}.${category === 'one' ? 'one' : 'other'}`, { ...vars, count });
}
