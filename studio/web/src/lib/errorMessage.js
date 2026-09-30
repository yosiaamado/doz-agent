import { kebabFromCode } from '../i18n/index.js';

// Teks dari kode server: kunci `<prefix>.<code-kebab>` dengan params sebagai variabel.
// Kunci belum ada (atau tanpa kode) → `fallback` (pesan Inggris dari server).
export function codeText(t, prefix, code, params, fallback) {
  if (code) {
    const key = `${prefix}.${kebabFromCode(code)}`;
    const text = t(key, params ?? undefined);
    if (text !== key) return text;
  }
  return fallback ?? '';
}

// Pesan error untuk user: kode diterjemahkan lewat `error.<code>`; tanpa kode atau kunci belum ada → err.message.
export function errorMessage(t, err) {
  if (!err) return '';
  return codeText(t, 'error', err.code, err.params, err.message ?? '');
}

// Pesan utama + detail validasi dari server (tidak diterjemahkan), digabung dengan `sep`.
export function errorWithDetails(t, err, sep = ': ') {
  return [errorMessage(t, err), ...(err?.details ?? [])].join(sep);
}

// Error/warning/activity pada state run & node: { error, errorCode, errorParams, warning, warningCode, activity, activityCode, activityParams }.
export const nodeErrorText = (t, o) => codeText(t, 'error', o?.errorCode, o?.errorParams, o?.error ?? '');
export const nodeWarningText = (t, o) => codeText(t, 'logs.code', o?.warningCode, o?.warningParams, o?.warning ?? '');
// activityCode null/undefined = pakai teks activity apa adanya; activity kosong = tidak ada yang ditampilkan.
export const nodeActivityText = (t, o) => (o?.activity ? codeText(t, 'logs.code', o.activityCode, o.activityParams, o.activity) : '');

// Nilai param yang berupa penanda (repo/workdir, studio/environment) dipetakan ke nama yang diterjemahkan.
const TARGET_KEY = { repo: 'setup.target.repo', workdir: 'setup.target.workdir' };
const SOURCE_KEY = { studio: 'setup.key-source.studio', environment: 'setup.key-source.environment' };

function mapParams(t, params) {
  if (!params) return undefined;
  const out = { ...params };
  if (Object.hasOwn(TARGET_KEY, out.target)) out.target = t(TARGET_KEY[out.target]);
  if (Object.hasOwn(SOURCE_KEY, out.source)) out.source = t(SOURCE_KEY[out.source]);
  return out;
}

// Detail/perbaikan dari server: `code`/`fixCode` diterjemahkan; perintah mentah (`fix` tanpa fixCode) ditampilkan apa adanya.
export function checkDetail(t, item) {
  return codeText(t, 'setup.code', item?.code, mapParams(t, item?.params), item?.detail);
}

