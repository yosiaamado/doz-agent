// Manage Claude profiles: each has its own config folder (login) and optional API key. Keys are only ever shown masked.
import { useState } from 'react';
import { KeyRound, Loader2, LogIn, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { useDialog } from '../../components/ui/Dialogs.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useProfiles } from '../../hooks/useProfiles.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { apiKeyLabel, authLabel, buildProfileBody, configDirLabel, safeHttpUrl } from '../../lib/profiles.js';

function ProfileForm({ initial, lockDir, submitLabel, busy, error, onSubmit, onCancel }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [configDir, setConfigDir] = useState(initial?.configDir ?? '');
  const submit = (e) => {
    e.preventDefault();
    onSubmit(buildProfileBody(initial, { name, configDir }));
  };
  const valid = name.trim() && (lockDir || configDir.trim());
  return (
    <form className="profile-form" onSubmit={submit}>
      <Field label={t('profiles.field.name')}><input value={name} maxLength={40} autoComplete="off" onChange={(e) => setName(e.target.value)} /></Field>
      {!lockDir && (
        <Field label={t('profiles.field.config-dir')} hint={t('profiles.field.config-dir-hint')}>
          <input className="mono" value={configDir} autoComplete="off" placeholder={'~/.claude-work'} onChange={(e) => setConfigDir(e.target.value)} />
        </Field>
      )}
      {error && <p className="err small" role="alert">{errorWithDetails(t, error)}</p>}
      <div className="profile-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !valid}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-sm" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

function KeyForm({ busy, error, onSubmit }) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    onSubmit(key.trim(), remember).then(() => setKey(''), () => {});
  };
  return (
    <form className="profile-form" onSubmit={submit}>
      <input type="password" autoComplete="off" placeholder={'sk-ant-api03-…'} aria-label={t('profiles.field.api-key')} value={key} onChange={(e) => setKey(e.target.value)} />
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('setup.api-key.remember')}</label>
      {error && <p className="err small" role="alert">{errorWithDetails(t, error)}</p>}
      <div className="profile-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || key.trim().length < 20}><KeyRound size={13} /> {t('profiles.key.save')}</button>
      </div>
    </form>
  );
}

function ProfileRow({ profile, hook }) {
  const { t } = useI18n();
  const notify = useToast();
  const dialog = useDialog();
  const [panel, setPanel] = useState(null); // 'edit' | 'key'
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [auth, setAuth] = useState(null);
  const [login, setLogin] = useState(null);
  const url = safeHttpUrl(login?.url);

  const run = async (name, fn, { closePanel = false } = {}) => {
    setBusy(name);
    setError(null);
    try {
      const result = await fn();
      if (closePanel) setPanel(null);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setBusy(null);
    }
  };
  const quiet = (promise) => promise.catch(() => {});

  const checkAuth = () => quiet(run('auth', async () => setAuth(await hook.auth(profile.id))));
  const startLogin = (useConsole) => quiet(run('login', async () => {
    setLogin(await hook.login(profile.id, useConsole));
    setAuth(null);
  }));
  const remove = async () => {
    const ok = await dialog.confirm({ title: t('profiles.delete.title', { name: profile.name }), message: t('profiles.delete.message'), confirmLabel: t('common.delete'), tone: 'danger' });
    if (!ok) return;
    try {
      await hook.remove(profile.id);
      notify(t('profiles.deleted', { name: profile.name }), 'success');
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    }
  };
  const togglePanel = (name) => { setError(null); setPanel(panel === name ? null : name); };

  return (
    <li className="profile-row">
      <div className="profile-head">
        <strong className="profile-title">{profile.name}</strong>
        {profile.isDefault && <span className="pill">{t('profiles.badge.default')}</span>}
        {profile.active && <span className="pill pill-active">{t('profiles.badge.active')}</span>}
      </div>
      <dl className="profile-meta">
        <dt>{t('profiles.field.config-dir')}</dt><dd className="mono">{configDirLabel(t, profile)}</dd>
        <dt>{t('profiles.field.api-key')}</dt><dd>{apiKeyLabel(t, profile.apiKey)}</dd>
        <dt>{t('profiles.field.projects')}</dt><dd className="mono">{profile.projectsDir}</dd>
        {auth && <><dt>{t('profiles.field.auth')}</dt><dd role="status">{authLabel(t, auth)}</dd></>}
      </dl>
      <div className="profile-actions">
        <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => startLogin(false)}>
          {busy === 'login' ? <Loader2 size={13} className="spin" /> : <LogIn size={13} />} {t('profiles.login')}
        </button>
        <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => startLogin(true)}>{t('setup.login.console')}</button>
        <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={checkAuth}>
          {busy === 'auth' ? <Loader2 size={13} className="spin" /> : <ShieldCheck size={13} />} {t('profiles.auth.check')}
        </button>
        <button type="button" className="btn btn-sm" aria-expanded={panel === 'key'} onClick={() => togglePanel('key')}><KeyRound size={13} /> {t('profiles.key.manage')}</button>
        <button type="button" className="btn btn-sm" aria-expanded={panel === 'edit'} onClick={() => togglePanel('edit')}><Pencil size={13} /> {t('profiles.edit')}</button>
        {!profile.isDefault && (
          <button type="button" className="btn btn-sm btn-danger" disabled={profile.active} title={profile.active ? t('profiles.delete.active-hint') : undefined} onClick={remove}>
            <Trash2 size={13} /> {t('common.delete')}
          </button>
        )}
      </div>
      {login && (
        <div className="setup-login" role="status">
          {url
            ? <>{t('setup.login.browser-open')} <a href={url} target="_blank" rel="noreferrer noopener">{url.slice(0, 70)}…</a>. {t('setup.login.then-refresh')}</>
            : t('setup.login.window')}
          {login.output && <> <code>{login.output}</code></>}
        </div>
      )}
      {panel === 'edit' && (
        <ProfileForm
          initial={profile} lockDir={profile.isDefault} submitLabel={t('common.save')} busy={busy === 'save'} error={error} onCancel={() => togglePanel('edit')}
          onSubmit={(body) => quiet(run('save', () => hook.update(profile.id, body), { closePanel: true }))}
        />
      )}
      {panel === 'key' && (
        <div className="profile-key">
          <KeyForm busy={busy === 'key'} error={error} onSubmit={(key, remember) => run('key', () => hook.setKey(profile.id, key, remember))} />
          {profile.apiKey.state !== 'none' && profile.apiKey.state !== 'environment' && (
            <button type="button" className="btn btn-sm btn-danger" disabled={busy !== null} onClick={() => quiet(run('clear-key', () => hook.clearKey(profile.id)))}>
              <Trash2 size={13} /> {t('setup.api-key.remove')}
            </button>
          )}
        </div>
      )}
      {panel === null && error && <p className="err small" role="alert">{errorMessage(t, error)}</p>}
    </li>
  );
}

export default function ProfilesDialog({ onClose }) {
  const { t } = useI18n();
  const hook = useProfiles();
  const notify = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const created = await hook.create(body);
      notify(t('profiles.created', { name: created.name }), 'success');
      setAdding(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const failedToLoad = !hook.loading && hook.error && hook.profiles.length === 0;

  return (
    <Modal
      size="lg" title={t('profiles.title')} subtitle={t('profiles.subtitle')} icon={<UsersRound size={18} />} onClose={onClose}
      footer={(
        <>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('common.close')}</button>
        </>
      )}
    >
      {hook.loading && <p className="muted" role="status"><Loader2 size={14} className="spin" /> {t('common.loading')}</p>}
      {failedToLoad && (
        <div className="profile-empty">
          <p className="err" role="alert">{errorMessage(t, hook.error)}</p>
          <button type="button" className="btn btn-sm" onClick={hook.refresh}><RefreshCw size={13} /> {t('common.retry')}</button>
        </div>
      )}
      <ul className="profile-list">
        {hook.profiles.map((p) => <ProfileRow key={p.id} profile={p} hook={hook} />)}
      </ul>
      {!hook.loading && !failedToLoad && (adding ? (
        <div className="profile-add">
          <h3 className="profile-add-title">{t('profiles.add.title')}</h3>
          <ProfileForm submitLabel={t('profiles.add.submit')} busy={busy} error={error} onSubmit={create} onCancel={() => { setAdding(false); setError(null); }} />
        </div>
      ) : null)}
      {!hook.loading && !failedToLoad && !adding && (
        <button type="button" className="btn btn-sm profile-add-btn" onClick={() => setAdding(true)}><Plus size={13} /> {t('profiles.add.title')}</button>
      )}
    </Modal>
  );
}
