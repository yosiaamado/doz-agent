// The Setup wizard: language first, then the requirements before the studio can be used (Node, git, Claude Code / API key, project folder, GitHub).
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, FolderOpen, KeyRound, LogIn, PlayCircle, RefreshCw, Trash2, UsersRound } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import { errorMessage, errorWithDetails } from '../../lib/errorMessage.js';
import { LOCALES, LOCALE_LABELS } from '../../i18n/index.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import CheckRow from './CheckRow.jsx';

function Step({ n, title, hint, children }) {
  return (
    <section className="setup-step">
      <div className="setup-step-head"><span className="setup-n">{n}</span><div><h3>{title}</h3>{hint && <p className="muted small">{hint}</p>}</div></div>
      <div className="setup-step-body">{children}</div>
    </section>
  );
}

function LanguageStep() {
  const { t, locale, setLocale } = useI18n();
  return (
    <Step n={0} title={t('setup.step.language.title')} hint={t('setup.step.language.hint')}>
      <Segmented ariaLabel={t('setup.step.language.title')} value={locale} onChange={setLocale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))} />
    </Step>
  );
}

function ApiKeyForm({ onSaved }) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const res = await api.setApiKey(key.trim(), remember);
      setKey('');
      notify(t(res.saved ? 'setup.api-key.saved' : 'setup.api-key.session', { masked: res.masked }), 'success');
      onSaved();
    } catch (err) {
      notify(errorWithDetails(t, err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="setup-form">
      <input type="password" autoComplete="off" placeholder={'sk-ant-api03-…'} value={key} onChange={(e) => setKey(e.target.value)} aria-label={t('setup.check.api-key')} />
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || key.trim().length < 20} onClick={save}><KeyRound size={13} /> {t('setup.api-key.save')}</button>
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('setup.api-key.remember')}</label>
    </div>
  );
}

function GitIdentityForm({ onSaved }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const notify = useToast();
  const save = async () => {
    try {
      await api.setGitIdentity(name, email);
      notify(t('setup.git-identity.saved'), 'success');
      onSaved();
    } catch (err) {
      notify(errorWithDetails(t, err), 'error');
    }
  };
  return (
    <div className="setup-form three">
      <input placeholder={t('setup.git-identity.name')} aria-label={t('setup.git-identity.name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder={t('setup.git-identity.email')} aria-label={t('setup.git-identity.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="button" className="btn btn-sm" disabled={!name || !email} onClick={save}>{t('common.save')}</button>
    </div>
  );
}

export default function SetupWizard({ workdir, profileId, profileName, onManageProfiles, onClose, onPickWorkdir, onDone }) {
  const { t } = useI18n();
  const [checks, setChecks] = useState(null);
  const [tests, setTests] = useState({});
  const [login, setLogin] = useState(null);
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      setChecks(await api.setup());
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    }
  }, [notify, t]);
  // Reload when the project folder is changed from the wizard too.
  useEffect(() => { load(); }, [load, workdir, profileId]);

  const runTest = async (key, name, target) => {
    setTests((prev) => ({ ...prev, [key]: { status: 'loading', detail: t('setup.testing') } }));
    try {
      const res = await api.setupTest(name, target);
      setTests((prev) => ({ ...prev, [key]: res }));
    } catch (err) {
      setTests((prev) => ({ ...prev, [key]: { status: 'error', detail: errorMessage(t, err) } }));
    }
  };

  const startLogin = async (useConsole) => {
    setLogin({ loading: true });
    const res = await api.claudeLogin(useConsole).catch((err) => ({ output: errorMessage(t, err) }));
    setLogin(res);
  };

  const state = checks?.state ?? {};
  const cliOk = tests.cli?.status === 'ok' || state['claude-cli']?.ok;
  const apiOk = tests.api?.status === 'ok' || state.api?.ok;
  const brainReady = cliOk || apiOk;
  const required = checks && checks.node.status === 'ok' && checks.git.status !== 'error' && brainReady;
  const finish = async () => {
    try {
      await api.completeSetup();
    } catch (err) {
      notify(errorMessage(t, err), 'error');
      return;
    }
    notify(t('setup.complete'), 'success');
    onDone?.();
    onClose();
  };

  return (
    <Modal
      size="lg" title={t('setup.title')} icon={<ClipboardCheck size={18} />} onClose={onClose}
      subtitle={t('setup.subtitle')}
      headerExtra={<button type="button" className="icon-btn" title={t('setup.recheck')} aria-label={t('setup.recheck')} onClick={() => { setChecks(null); load(); }}><RefreshCw size={16} /></button>}
      footer={(
        <>
          <span className="muted small">{required ? t('setup.footer.ready') : brainReady ? t('setup.footer.fix') : t('setup.footer.test-first')}</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>{t('setup.skip')}</button>
          <button type="button" className="btn btn-primary" disabled={!required} onClick={finish}>{t('setup.done')}</button>
        </>
      )}
    >
      <LanguageStep />

      <Step n={1} title={t('setup.step.system.title')} hint={t('setup.step.system.hint')}>
        <CheckRow title={t('setup.check.node')} check={checks?.node} />
        <CheckRow title={t('setup.check.git')} check={checks?.git}>
          {checks?.git?.action === 'git-identity' && <GitIdentityForm onSaved={load} />}
        </CheckRow>
      </Step>

      <Step n={2} title={t('setup.step.brain.title')} hint={t('setup.step.brain.hint')}>
        <CheckRow title={t('setup.check.claude')} check={checks?.claude} />
        <div className="setup-profile">
          <span>{t('setup.profile', { name: profileName ?? '…' })}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onManageProfiles}><UsersRound size={13} /> {t('setup.profile.manage')}</button>
        </div>
        <CheckRow title={t('setup.check.claude-auth')} check={checks?.claudeAuth} test={tests.cli}>
          <div className="setup-actions">
            {checks?.claudeAuth?.status !== 'ok' && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => startLogin(false)}><LogIn size={13} /> {t('setup.login.account')}</button>
                <button type="button" className="btn btn-sm" onClick={() => startLogin(true)}>{t('setup.login.console')}</button>
              </>
            )}
            <button type="button" className="btn btn-sm" disabled={checks?.claude?.status !== 'ok'} onClick={() => runTest('cli', 'claude-cli')}><PlayCircle size={13} /> {t('setup.test-cli')}</button>
          </div>
          {login && (
            <div className="setup-login">
              {login.loading ? t('setup.login.opening') : login.url
                ? <>{t('setup.login.browser-open')} <a href={login.url} target="_blank" rel="noreferrer">{login.url.slice(0, 70)}…</a>. {t('setup.login.then-refresh')}</>
                : <>{t('setup.login.window')} {login.output && <code>{login.output}</code>}</>}
            </div>
          )}
        </CheckRow>
        <CheckRow title={t('setup.check.api-key')} check={checks?.apiKey} test={tests.api}>
          {checks?.apiKey?.status === 'ok' ? (
            <div className="setup-actions">
              <button type="button" className="btn btn-sm" onClick={() => runTest('api', 'api')}><PlayCircle size={13} /> {t('setup.test-api')}</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={async () => { await api.clearApiKey(); setTests((prev) => ({ ...prev, api: undefined })); load(); }}><Trash2 size={13} /> {t('setup.api-key.remove')}</button>
            </div>
          ) : <ApiKeyForm onSaved={async () => { await load(); runTest('api', 'api'); }} />}
        </CheckRow>
      </Step>

      <Step n={3} title={t('setup.step.project.title')} hint={t('setup.step.project.hint')}>
        <CheckRow title={t('setup.check.project')} check={checks?.project}>
          <div className="setup-actions">
            <span className="muted small mono">{checks?.workdir}</span>
            <button type="button" className="btn btn-sm" onClick={onPickWorkdir}><FolderOpen size={13} /> {t('setup.pick-folder')}</button>
          </div>
        </CheckRow>
      </Step>

      <Step n={4} title={t('setup.step.github.title')} hint={t('setup.step.github.hint')}>
        <CheckRow title={t('setup.check.repo-doz')} check={checks?.repo} test={tests.ghRepo}>
          {checks?.repo?.status === 'ok' && <div className="setup-actions"><button type="button" className="btn btn-sm" onClick={() => runTest('ghRepo', 'github', 'repo')}><PlayCircle size={13} /> {t('setup.test-github')}</button></div>}
        </CheckRow>
        <CheckRow title={t('setup.check.repo-project')} check={checks?.project} test={tests.ghProject}>
          {checks?.project?.status === 'ok' && <div className="setup-actions"><button type="button" className="btn btn-sm" onClick={() => runTest('ghProject', 'github', 'workdir')}><PlayCircle size={13} /> {t('setup.test-github')}</button></div>}
        </CheckRow>
      </Step>

      <Step n={5} title={t('setup.step.plugin.title')} hint={t('setup.step.plugin.hint')}>
        <CheckRow title={t('setup.check.plugin')} check={checks?.plugin} />
      </Step>
    </Modal>
  );
}
