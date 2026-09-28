import { AlertTriangle, FolderOpen, GitBranch, Plus, Save, Settings2, Workflow } from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Select from '../../components/ui/Select.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import UsageWidget from './UsageWidget.jsx';

export default function TopBar({
  meta, workflows, dirty, errors, status, theme, gitChanges, onSwitch, onNew, onSave, onPickWorkdir, onWorkflowSettings, onGit,
}) {
  const saved = workflows.some((w) => w.name === meta.name);
  const options = [
    ...(saved ? [] : [{ value: meta.name, label: `${meta.name} (belum disimpan)`, group: 'Semua Workflow' }]),
    ...workflows.map((w) => ({ value: w.name, label: w.name, description: w.description, group: 'Semua Workflow', icon: <Workflow size={15} /> })),
  ];
  return (
    <header className="topbar">
      <div className="brand"><Logo size={30} /><span className="brand-name">Doz <span>Studio</span></span></div>
      <span className="topbar-divider" />
      <Select
        className="wf-switch" variant="ghost" ariaLabel="Pilih workflow" value={meta.name} options={options} searchable
        onChange={onSwitch} actions={[{ label: 'Workflow Baru…', icon: <Plus size={15} />, onSelect: onNew }]}
      />
      {dirty && <span className="dirty" title="Belum disimpan">●</span>}
      {errors.length > 0 && <span className="errors" title={errors.join('\n')}><AlertTriangle size={14} /> {errors.length} Masalah</span>}
      <div className="topbar-right">
        <div className="runners" style={{ display: 'flex', gap: 10 }}>
          {status && Object.entries(status.runners).map(([name, r]) => (
            <span key={name} className={`runner ${r.available ? 'ok' : 'off'}`} title={r.detail}><span className="runner-dot" /><span className="name">{name}</span></span>
          ))}
        </div>
        <UsageWidget />
        <button type="button" className="btn btn-ghost workdir-btn" title={`Folder project: ${status?.workdir ?? ''}`} onClick={onPickWorkdir}>
          <FolderOpen size={15} /> <span>{status?.workdirName}</span>
        </button>
        <button type="button" className="btn btn-ghost git-btn" title="Pull / commit / push ke GitHub" onClick={onGit}>
          <GitBranch size={15} /> <span className="save-label">GitHub</span>{gitChanges > 0 && <span className="badge">{gitChanges}</span>}
        </button>
        <ThemeToggle {...theme} />
        <button type="button" className="icon-btn" title="Pengaturan Workflow" aria-label="Pengaturan Workflow" onClick={onWorkflowSettings}><Settings2 size={17} /></button>
        <button type="button" className="btn btn-primary" onClick={onSave} title="Ctrl+S"><Save size={14} /> <span className="save-label">Simpan</span></button>
      </div>
    </header>
  );
}
