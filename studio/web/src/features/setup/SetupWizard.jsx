// Wizard Persiapan: syarat sebelum studio dipakai (Node, git, Claude Code / API key, folder project, GitHub).
import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, FolderOpen, KeyRound, LogIn, PlayCircle, RefreshCw, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { api } from '../../lib/api.js';
import CheckRow from './CheckRow.jsx';

function Step({ n, title, hint, children }) {
  return (
    <section className="setup-step">
      <div className="setup-step-head"><span className="setup-n">{n}</span><div><h3>{title}</h3>{hint && <p className="muted small">{hint}</p>}</div></div>
      <div className="setup-step-body">{children}</div>
    </section>
  );
}

function ApiKeyForm({ onSaved }) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const res = await api.setApiKey(key.trim(), remember);
      setKey('');
      notify(`API key ${res.masked} dipasang${res.saved ? ' dan disimpan' : ' untuk sesi ini'}`, 'success');
      onSaved();
    } catch (err) {
      notify([err.message, ...err.details].join(': '), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="setup-form">
      <input type="password" autoComplete="off" placeholder="sk-ant-api03-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Anthropic API key" />
      <button type="button" className="btn btn-primary btn-sm" disabled={busy || key.trim().length < 20} onClick={save}><KeyRound size={13} /> Pasang & Tes</button>
      <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Ingat di komputer ini (studio/.local.json, tidak ikut git)</label>
    </div>
  );
}

function GitIdentityForm({ onSaved }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const notify = useToast();
  const save = async () => {
    try {
      await api.setGitIdentity(name, email);
      notify('Identitas git disimpan (global)', 'success');
      onSaved();
    } catch (err) {
      notify([err.message, ...err.details].join(': '), 'error');
    }
  };
  return (
    <div className="setup-form three">
      <input placeholder="Nama (user.name)" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Email GitHub (user.email)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="button" className="btn btn-sm" disabled={!name || !email} onClick={save}>Simpan</button>
    </div>
  );
}

export default function SetupWizard({ workdir, onClose, onPickWorkdir, onDone }) {
  const [checks, setChecks] = useState(null);
  const [tests, setTests] = useState({});
  const [login, setLogin] = useState(null);
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      setChecks(await api.setup());
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [notify]);
  // Muat ulang juga saat folder project diganti dari wizard.
  useEffect(() => { load(); }, [load, workdir]);

  const runTest = async (key, name, target) => {
    setTests((t) => ({ ...t, [key]: { status: 'loading', detail: 'Mengetes…' } }));
    try {
      const res = await api.setupTest(name, target);
      setTests((t) => ({ ...t, [key]: res }));
    } catch (err) {
      setTests((t) => ({ ...t, [key]: { status: 'error', detail: err.message } }));
    }
  };

  const startLogin = async (useConsole) => {
    setLogin({ loading: true });
    const res = await api.claudeLogin(useConsole).catch((err) => ({ output: err.message }));
    setLogin(res);
  };

  const state = checks?.state ?? {};
  const cliOk = tests.cli?.status === 'ok' || state['claude-cli']?.ok;
  const apiOk = tests.api?.status === 'ok' || state.api?.ok;
  const brainReady = cliOk || apiOk;
  const required = checks && checks.node.status === 'ok' && checks.git.status !== 'error' && brainReady;
  const finish = async () => {
    await api.completeSetup();
    notify('Persiapan selesai', 'success');
    onDone?.();
    onClose();
  };

  return (
    <Modal
      size="lg" title="Persiapan Doz Studio" icon={<ClipboardCheck size={18} />} onClose={onClose}
      subtitle="Cek dan tes semua yang dibutuhkan sebelum menjalankan workflow. Minimal satu otak AI (Claude Code atau API key) harus lolos tes."
      headerExtra={<button type="button" className="icon-btn" title="Periksa ulang" aria-label="Periksa ulang" onClick={() => { setChecks(null); load(); }}><RefreshCw size={16} /></button>}
      footer={(
        <>
          <span className="muted small">{required ? 'Siap dipakai.' : brainReady ? 'Lengkapi yang bertanda merah.' : 'Tes Claude Code atau API key dulu.'}</span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Lewati Dulu</button>
          <button type="button" className="btn btn-primary" disabled={!required} onClick={finish}>Selesai</button>
        </>
      )}
    >
      <Step n={1} title="Sistem" hint="Node.js untuk studio, git untuk diff per node dan sinkronisasi GitHub.">
        <CheckRow title="Node.js" check={checks?.node} />
        <CheckRow title="Git" check={checks?.git}>
          {checks?.git?.action === 'git-identity' && <GitIdentityForm onSaved={load} />}
        </CheckRow>
      </Step>

      <Step n={2} title="Otak AI" hint="Pilih salah satu atau keduanya. Runner claude-cli memakai akun Claude Code; runner api memakai API key Anthropic.">
        <CheckRow title="Claude Code terpasang" check={checks?.claude} />
        <CheckRow title="Akun Claude Code" check={checks?.claudeAuth} test={tests.cli}>
          <div className="setup-actions">
            {checks?.claudeAuth?.status !== 'ok' && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => startLogin(false)}><LogIn size={13} /> Login Akun Claude</button>
                <button type="button" className="btn btn-sm" onClick={() => startLogin(true)}>Login Anthropic Console</button>
              </>
            )}
            <button type="button" className="btn btn-sm" disabled={checks?.claude?.status !== 'ok'} onClick={() => runTest('cli', 'claude-cli')}><PlayCircle size={13} /> Tes claude -p</button>
          </div>
          {login && (
            <div className="setup-login">
              {login.loading ? 'Membuka halaman login…' : login.url
                ? <>Browser seharusnya terbuka. Kalau tidak, buka: <a href={login.url} target="_blank" rel="noreferrer">{login.url.slice(0, 70)}…</a>. Setelah selesai, klik ↻ di atas.</>
                : <>Selesaikan login di jendela yang terbuka, lalu klik ↻. {login.output && <code>{login.output}</code>}</>}
            </div>
          )}
        </CheckRow>
        <CheckRow title="API Key Anthropic" check={checks?.apiKey} test={tests.api}>
          {checks?.apiKey?.status === 'ok' ? (
            <div className="setup-actions">
              <button type="button" className="btn btn-sm" onClick={() => runTest('api', 'api')}><PlayCircle size={13} /> Tes API</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={async () => { await api.clearApiKey(); setTests((t) => ({ ...t, api: undefined })); load(); }}><Trash2 size={13} /> Hapus Key</button>
            </div>
          ) : <ApiKeyForm onSaved={async () => { await load(); runTest('api', 'api'); }} />}
        </CheckRow>
      </Step>

      <Step n={3} title="Folder Project" hint="Folder tempat agent bekerja. Sebaiknya repo git supaya perubahan per node bisa dilihat.">
        <CheckRow title="Project aktif" check={checks?.project}>
          <div className="setup-actions">
            <span className="muted small mono">{checks?.workdir}</span>
            <button type="button" className="btn btn-sm" onClick={onPickWorkdir}><FolderOpen size={13} /> Pilih Folder</button>
          </div>
        </CheckRow>
      </Step>

      <Step n={4} title="GitHub" hint="Tes baca ke remote (tanpa mengubah apa pun). Kredensial diambil dari komputer ini: gh auth login, SSH key, atau credential helper.">
        <CheckRow title="Repo doz-agent" check={checks?.repo} test={tests.ghRepo}>
          {checks?.repo?.status === 'ok' && <div className="setup-actions"><button type="button" className="btn btn-sm" onClick={() => runTest('ghRepo', 'github', 'repo')}><PlayCircle size={13} /> Tes Akses GitHub</button></div>}
        </CheckRow>
        <CheckRow title="Repo project" check={checks?.project} test={tests.ghProject}>
          {checks?.project?.status === 'ok' && <div className="setup-actions"><button type="button" className="btn btn-sm" onClick={() => runTest('ghProject', 'github', 'workdir')}><PlayCircle size={13} /> Tes Akses GitHub</button></div>}
        </CheckRow>
      </Step>

      <Step n={5} title="Plugin Claude Code (Opsional)" hint="Dibutuhkan untuk /doz-agent:ship-feature dan /doz-agent:run-workflow di terminal.">
        <CheckRow title="Plugin doz-agent" check={checks?.plugin} />
      </Step>
    </Modal>
  );
}
