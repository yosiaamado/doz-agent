import { AlertTriangle, ClipboardCheck, Download, FolderOpen, GitBranch, Building2, Plus, Save, Settings2, Workflow } from 'lucide-react';
import Logo from '../../components/ui/Logo.jsx';
import Segmented from '../../components/ui/Segmented.jsx';
import Select from '../../components/ui/Select.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { codeText } from '../../lib/errorMessage.js';
import ProfileSwitcher from './ProfileSwitcher.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import UsageWidget from './UsageWidget.jsx';

const SAVE_SHORTCUT = 'Ctrl+S';

export default function TopBar({
  meta, workflows, dirty, errors, status, theme, gitChanges, setupPending, updateAvailable, onUpdate, profiles, onManageProfiles, view, onViewChange, onSwitch, onNew, onSave, onPickWorkdir, onWorkflowSettings, onGit, onSetup,
}) {
  const { t, tp } = useI18n();
  const saved = workflows.some((w) => w.name === meta.name);
  const options = [
    ...(saved ? [] : [{ value: meta.name, label: t('topbar.workflow.unsaved-option', { name: meta.name }), group: t('topbar.workflow.group') }]),
    ...workflows.map((w) => ({ value: w.name, label: w.name, description: w.description, group: t('topbar.workflow.group'), icon: <Workflow size={15} /> })),
  ];
  return (
    <header className="topbar">
      {/* i18n-ignore: product name */}
      <div className="brand"><Logo size={30} /><span className="brand-name">Doz <span>Studio</span></span></div>
      <span className="topbar-divider" />
      <Segmented
        ariaLabel={t('topbar.view.aria')} value={view} onChange={onViewChange}
        options={[{ value: 'canvas', label: t('topbar.view.canvas'), icon: <Workflow size={14} /> }, { value: 'office', label: t('topbar.view.office'), icon: <Building2 size={14} /> }]}
      />
      <Select
        className="wf-switch" variant="ghost" ariaLabel={t('topbar.workflow.select-aria')} value={meta.name} options={options} searchable
        onChange={onSwitch} actions={[{ label: t('topbar.workflow.new'), icon: <Plus size={15} />, onSelect: onNew }]}
      />
      {dirty && <span className="dirty" title={t('topbar.unsaved-title')}>●</span>}
      {errors.length > 0 && <span className="errors" title={errors.join('\n')}><AlertTriangle size={14} /> {tp('topbar.issues', errors.length)}</span>}
      <div className="topbar-right">
        <div className="runners" style={{ display: 'flex', gap: 10 }}>
          {status && Object.entries(status.runners).map(([name, r]) => (
            <span key={name} className={`runner ${r.available ? 'ok' : 'off'}`} title={codeText(t, 'runner.code', r.code, undefined, r.detail)}><span className="runner-dot" /><span className="name">{name}</span></span>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" title={t('topbar.setup.title')} onClick={onSetup}>
          <ClipboardCheck size={15} /> <span className="save-label">{t('topbar.setup.label')}</span>{setupPending && <span className="setup-dot" />}
        </button>
        <button type="button" className="btn btn-ghost" title={t(updateAvailable ? 'topbar.update.available' : 'topbar.update.title')} aria-label={t(updateAvailable ? 'topbar.update.available' : 'topbar.update.title')} onClick={onUpdate}>
          <Download size={15} /> <span className="save-label">{t('topbar.update.label')}</span>{updateAvailable && <span className="setup-dot" />}
        </button>
        <ProfileSwitcher profiles={profiles.profiles} activeProfileId={profiles.activeProfileId} onSwitch={profiles.switchTo} onManage={onManageProfiles} />
        <UsageWidget profileKey={profiles.activeProfileId} />
        <button type="button" className="btn btn-ghost workdir-btn" title={t('topbar.workdir.title', { path: status?.workdir ?? '' })} onClick={onPickWorkdir}>
          <FolderOpen size={15} /> <span>{status?.workdirName}</span>
        </button>
        <button type="button" className="btn btn-ghost git-btn" title={t('topbar.git.title')} onClick={onGit}>
          <GitBranch size={15} /> <span className="save-label">{t('topbar.git.label')}</span>{gitChanges > 0 && <span className="badge">{gitChanges}</span>}
        </button>
        <ThemeToggle {...theme} />
        <button type="button" className="icon-btn" title={t('topbar.workflow-settings')} aria-label={t('topbar.workflow-settings')} onClick={onWorkflowSettings}><Settings2 size={17} /></button>
        <button type="button" className="btn btn-primary" onClick={onSave} title={t('topbar.save.title', { shortcut: SAVE_SHORTCUT })} aria-label={t('common.save')}><Save size={14} /> <span className="save-label">{t('common.save')}</span></button>
      </div>
    </header>
  );
}
