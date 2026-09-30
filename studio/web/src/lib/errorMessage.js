import { kebabFromCode } from '../i18n/index.js';

// Copy for a server code: the key `<prefix>.<code-kebab>` with params as variables.
// A key that does not exist yet (or no code at all) → `fallback` (the English message from the server).
export function codeText(t, prefix, code, params, fallback) {
  if (code) {
    const key = `${prefix}.${kebabFromCode(code)}`;
    const text = t(key, params ?? undefined);
    if (text !== key) return text;
  }
  return fallback ?? '';
}

// The error message for the user: the code is translated through `error.<code>`; with no code, or no key yet → err.message.
export function errorMessage(t, err) {
  if (!err) return '';
  return codeText(t, 'error', err.code, err.params, err.message ?? '');
}

// The main message plus the validation details from the server (untranslated), joined with `sep`.
export function errorWithDetails(t, err, sep = ': ') {
  return [errorMessage(t, err), ...(err?.details ?? [])].join(sep);
}

// The error/warning/activity on the run & node state: { error, errorCode, errorParams, warning, warningCode, activity, activityCode, activityParams }.
export const nodeErrorText = (t, o) => codeText(t, 'error', o?.errorCode, o?.errorParams, o?.error ?? '');
export const nodeWarningText = (t, o) => codeText(t, 'logs.code', o?.warningCode, o?.warningParams, o?.warning ?? '');
// activityCode null/undefined = use the activity text as-is; an empty activity = nothing is shown.
export const nodeActivityText = (t, o) => (o?.activity ? codeText(t, 'logs.code', o.activityCode, o.activityParams, o.activity) : '');

// Param values that are markers (repo/workdir, studio/environment) are mapped to a translated name.
const TARGET_KEY = { repo: 'setup.target.repo', workdir: 'setup.target.workdir' };
const SOURCE_KEY = { studio: 'setup.key-source.studio', environment: 'setup.key-source.environment' };

function mapParams(t, params) {
  if (!params) return undefined;
  const out = { ...params };
  if (Object.hasOwn(TARGET_KEY, out.target)) out.target = t(TARGET_KEY[out.target]);
  if (Object.hasOwn(SOURCE_KEY, out.source)) out.source = t(SOURCE_KEY[out.source]);
  return out;
}

// Details/fixes from the server: `code`/`fixCode` are translated; a raw command (`fix` without fixCode) is shown as-is.
export function checkDetail(t, item) {
  return codeText(t, 'setup.code', item?.code, mapParams(t, item?.params), item?.detail);
}

