// Endpoint update yang bisa diganti user (HTTPS wajib; divalidasi server). Kosong = endpoint bawaan.
import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Field, Section } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { api } from '../../lib/api.js';
import { errorMessage } from '../../lib/errorMessage.js';

export default function UpdateSettings() {
  const { t } = useI18n();
  const notify = useToast();
  const [saved, setSaved] = useState(null); // { endpoint, endpointIsDefault }
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.updateSettings()
      .then((s) => { setSaved(s); setValue(s.endpoint); })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (endpoint, doneKey) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.saveUpdateSettings(endpoint);
      setSaved(s);
      setValue(s.endpoint);
      notify(t(doneKey), 'success');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const dirty = saved && value.trim() !== saved.endpoint;
  const hint = loading ? t('common.loading') : saved?.endpointIsDefault ? t('update.settings.hint-default') : saved ? t('update.settings.hint-custom') : null;
  return (
    <Section title={t('update.settings.title')}>
      <Field label={t('update.settings.endpoint')} hint={hint}>
        <input type="url" value={value} disabled={!saved || busy} placeholder={'https://example.com/doz-update.json'} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {error && <p className="err small" role="alert">{errorMessage(t, error)}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Gagal memuat: input terkunci, jadi harus ada jalan keluar (retry). */}
        {!saved && !loading && (
          <button type="button" className="btn btn-sm" onClick={load}><RefreshCw size={13} /> {t('common.retry')}</button>
        )}
        {loading && <Loader2 size={14} className="spin" />}
        {saved && (
          <>
            <button type="button" className="btn btn-sm btn-primary" disabled={!dirty || busy || !value.trim()} onClick={() => save(value.trim(), 'update.settings.saved')}>{t('update.settings.save')}</button>
            <button type="button" className="btn btn-sm" disabled={saved.endpointIsDefault || busy} onClick={() => save(null, 'update.settings.reset-done')}>{t('update.settings.reset')}</button>
          </>
        )}
      </div>
    </Section>
  );
}
