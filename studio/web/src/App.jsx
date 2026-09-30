import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { api } from './lib/api.js';
import { errorMessage, errorWithDetails } from './lib/errorMessage.js';
import { useI18n } from './i18n/I18nProvider.jsx';
import { readStorage, writeStorage } from './lib/storage.js';
import { useTheme } from './hooks/useTheme.js';
import { useLibrary } from './hooks/useLibrary.js';
import { useRuns } from './hooks/useRuns.js';
import { useWorkflowEditor } from './hooks/useWorkflowEditor.js';
import { useUpdate } from './hooks/useUpdate.js';
import { useToast } from './components/ui/Toast.jsx';
import { useDialog } from './components/ui/Dialogs.jsx';
import { StudioContext } from './state/studioContext.js';
import TopBar from './features/topbar/TopBar.jsx';
import Sidebar from './features/sidebar/Sidebar.jsx';
import FlowCanvas, { GRID } from './features/canvas/FlowCanvas.jsx';
import LogsPanel from './features/logs/LogsPanel.jsx';
import SettingsPanel from './features/settings/SettingsPanel.jsx';

const ComponentEditor = lazy(() => import('./features/dialogs/ComponentEditor.jsx'));
const SourcesDialog = lazy(() => import('./features/dialogs/SourcesDialog.jsx'));
const FolderPicker = lazy(() => import('./features/dialogs/FolderPicker.jsx'));
const RunDialog = lazy(() => import('./features/dialogs/RunDialog.jsx'));
const NewWorkflowDialog = lazy(() => import('./features/dialogs/NewWorkflowDialog.jsx'));
const GitDialog = lazy(() => import('./features/dialogs/GitDialog.jsx'));
const SetupWizard = lazy(() => import('./features/setup/SetupWizard.jsx'));
const UpdateDialog = lazy(() => import('./features/update/UpdateDialog.jsx'));

const LAST_KEY = 'doz-studio:last-workflow';
const snap = (v) => Math.round(v / GRID) * GRID;

export default function App() {
  const { t } = useI18n();
  const theme = useTheme();
  const notify = useToast();
  const dialog = useDialog();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const lib = useLibrary();
  const update = useUpdate();
  const editor = useWorkflowEditor({ agentNames: useMemo(() => Object.keys(lib.agentsByName), [lib.agentsByName]), notify });
  const [status, setStatus] = useState(null);
  const [selection, setSelection] = useState(null);
  const [rightOpen, setRightOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);
  const [tab, setTab] = useState('editor');
  const [modal, setModal] = useState(null); // { kind, ...props }
  const [gitChanges, setGitChanges] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupPending, setSetupPending] = useState(false);
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { meta: editor.meta, dirty: editor.dirty, workflows: lib.workflows };

  const openWorkflow = useCallback(async (name) => {
    await editor.open(name);
    setSelection(null);
    writeStorage(LAST_KEY, name);
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 200 }), 50);
  }, [editor, fitView]);

  // Ikuti run baru (termasuk dari Claude Code) kalau workflow-nya ada dan canvas tidak punya perubahan.
  const followRun = useCallback((ev) => {
    setLogsOpen(true);
    const { meta, dirty, workflows } = stateRef.current;
    if (ev.workflow !== meta?.name && !dirty && workflows.some((w) => w.name === ev.workflow)) openWorkflow(ev.workflow);
    if (ev.source === 'claude-code') notify(t('app.run-from-claude-code', { workflow: ev.workflow }));
  }, [openWorkflow, notify, t]);
  const runsState = useRuns({ onRunStarted: followRun });
  const { run } = runsState;

  useEffect(() => {
    (async () => {
      const [st, wfs] = await Promise.all([api.status(), lib.reload()]);
      setStatus(st);
      // Pertama kali dipakai: buka wizard Persiapan.
      api.setup().then((s) => {
        const pending = !s.state?.completedAt;
        setSetupPending(pending);
        if (pending) setSetupOpen(true);
      }).catch(() => {});
      const last = readStorage(LAST_KEY);
      const first = wfs.find((w) => w.name === last) ?? wfs[0];
      if (first) await openWorkflow(first.name);
      else await editor.createFrom('new-workflow', null);
      runsState.refresh();
    })().catch((err) => notify(t('app.load-failed', { message: errorMessage(t, err) }), 'error'));
    // Hanya saat pertama kali dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmDiscard = useCallback(async () => !editor.dirty || dialog.confirm({
    title: t('dialogs.discard.title'), message: t('dialogs.discard.workflow'), confirmLabel: t('dialogs.discard.confirm'), tone: 'danger',
  }), [editor.dirty, dialog, t]);

  const selectRun = useCallback(async (id) => {
    const state = await runsState.select(id);
    setLogsOpen(true);
    const { meta, dirty, workflows } = stateRef.current;
    if (state?.workflow && state.workflow !== meta?.name && !dirty && workflows.some((w) => w.name === state.workflow)) await openWorkflow(state.workflow);
  }, [runsState, openWorkflow]);

  const save = useCallback(async () => {
    let name = editor.meta.name;
    if (!lib.workflows.some((w) => w.name === name)) {
      name = await dialog.prompt({ title: t('app.save-workflow.title'), label: t('dialogs.new-workflow.field.name'), defaultValue: name, validate: (v) => (/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v) ? null : t('dialogs.new-workflow.name-invalid')) });
      if (!name) return;
    }
    try {
      const res = await editor.save(name);
      await lib.reloadWorkflows();
      refreshGit();
      writeStorage(LAST_KEY, name);
      notify(t('app.saved-to', { file: res.file }), 'success');
    } catch (err) {
      notify(errorMessage(t, err), 'error');
    }
  }, [editor, lib, dialog, notify, t]);

  // Jumlah file berubah di repo doz-agent (badge tombol GitHub).
  const refreshGit = useCallback(() => api.gitStatus('repo').then((s) => setGitChanges(s.files?.length ?? 0)).catch(() => {}), []);
  useEffect(() => { refreshGit(); }, [refreshGit]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (editor.meta) save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, editor.meta]);

  const addNode = useCallback((spec, position) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = rect ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 }) : { x: 0, y: 0 };
    const pos = position ?? center;
    const id = editor.addNode(spec, { x: snap(pos.x), y: snap(pos.y) });
    setSelection({ kind: 'node', id });
    setRightOpen(true);
  }, [editor, screenToFlowPosition]);

  const onSelect = useCallback((sel) => {
    setSelection(sel);
    if (sel) setRightOpen(true);
  }, []);

  const startRun = async (body) => {
    try {
      const { id } = await api.startRun({ workflow: editor.current(), ...body });
      setModal(null);
      runsState.refresh();
      await selectRun(id);
    } catch (err) {
      notify(errorWithDetails(t, err), 'error');
    }
  };

  const onApprove = useCallback(async (nodeId, approved) => {
    const note = approved ? '' : await dialog.prompt({
      title: t('app.reject.title'), label: t('app.reject.label'), multiline: true, confirmLabel: t('canvas.reject'),
    });
    if (note === null) return;
    api.approve(runsState.runId(), nodeId, approved, note).catch((err) => notify(errorMessage(t, err), 'error'));
  }, [dialog, runsState, notify, t]);

  const onEditComponent = useCallback((kind, name) => setModal({ kind: 'component', type: kind, name }), []);
  const nodeTypesById = useMemo(() => Object.fromEntries(editor.nodes.map((n) => [n.id, n.data.node.type])), [editor.nodes]);
  const ctxValue = useMemo(
    () => ({ agentsByName: lib.agentsByName, meta: editor.meta, run, onApprove, onEditComponent, nodeTypes: nodeTypesById }),
    [lib.agentsByName, editor.meta, run, onApprove, onEditComponent, nodeTypesById],
  );

  if (!editor.meta) return <div className="loading">{t('app.loading')}</div>;

  const selected = selection?.kind === 'node' && editor.nodesById[selection.id]
    ? { kind: 'node', node: editor.nodesById[selection.id] }
    : selection?.kind === 'edge' && editor.edges.find((e) => e.id === selection.id)
      ? { kind: 'edge', edge: editor.edges.find((e) => e.id === selection.id), sourceType: nodeTypesById[editor.edges.find((e) => e.id === selection.id).source] }
      : null;
  const closeModal = () => setModal(null);

  return (
    <StudioContext.Provider value={ctxValue}>
      <div className="app">
        <TopBar
          meta={editor.meta} workflows={lib.workflows} dirty={editor.dirty} errors={editor.errors} status={status} theme={theme}
          onSwitch={async (name) => { if (name !== editor.meta.name && await confirmDiscard()) openWorkflow(name); }}
          onNew={async () => { if (await confirmDiscard()) setModal({ kind: 'new' }); }}
          onSave={save} onPickWorkdir={() => setModal({ kind: 'workdir' })}
          onWorkflowSettings={() => { setSelection(null); setRightOpen(true); }}
          gitChanges={gitChanges} onGit={() => setModal({ kind: 'git' })}
          setupPending={setupPending} onSetup={() => setSetupOpen(true)}
          updateAvailable={update.available} onUpdate={() => setModal({ kind: 'update' })}
        />
        <div className="workspace">
          <Sidebar
            tab={tab} setTab={(name) => { setTab(name); if (name === 'executions') runsState.refresh(); }}
            library={lib.library} onAdd={addNode} onEdit={onEditComponent}
            onCreate={(kind) => setModal({ kind: 'component', type: kind, name: null })} onSources={() => setModal({ kind: 'sources' })}
            runs={runsState.runs} workflowName={editor.meta.name} currentRunId={run.id} onSelectRun={selectRun}
          />
          <div className="center">
            <FlowCanvas
              ref={canvasRef} editor={editor} theme={theme.theme} onSelect={onSelect} onDropSpec={addNode}
              running={run.status === 'running' && run.source === 'studio'} errors={editor.errors}
              onRun={() => setModal({ kind: 'run' })} onStop={() => api.stopRun(run.id)}
            />
            <LogsPanel
              run={run} nodesById={editor.nodesById} git={status?.git}
              selectedNode={selection?.kind === 'node' && run.nodes[selection.id] ? selection.id : null}
              onSelectNode={(id) => { setSelection({ kind: 'node', id }); editor.selectOnly(id); }}
              onStop={() => api.stopRun(run.id).catch((err) => notify(errorMessage(t, err), 'error'))}
              open={logsOpen} setOpen={setLogsOpen}
            />
          </div>
          {rightOpen && (
            <SettingsPanel
              selection={selected} ctx={{ library: lib.library, meta: editor.meta, nodes: editor.nodes, runners: status?.runners }}
              meta={editor.meta} setMeta={editor.setMeta} onNodeChange={editor.updateNode}
              onEdgeChange={(data) => editor.updateEdge(selection.id, data)}
              onDelete={() => { if (selection?.kind === 'node') editor.removeNode(selection.id); else if (selection) editor.removeEdge(selection.id); setSelection(null); }}
              onClose={() => setRightOpen(false)} onEditComponent={onEditComponent}
            />
          )}
        </div>
        <Suspense fallback={null}>
          {modal?.kind === 'run' && <RunDialog workflowName={editor.meta.name} workdir={status?.workdirName} onStart={startRun} onClose={closeModal} />}
          {setupOpen && (
            <SetupWizard workdir={status?.workdir} onClose={() => setSetupOpen(false)} onPickWorkdir={() => setModal({ kind: 'workdir' })}
              onDone={async () => { setSetupPending(false); setStatus(await api.status()); }} />
          )}
          {modal?.kind === 'update' && <UpdateDialog update={update} onClose={closeModal} />}
          {modal?.kind === 'git' && (
            <GitDialog onClose={() => { closeModal(); refreshGit(); }}
              onSynced={async (target) => { if (target === 'repo') { await lib.reload(); refreshGit(); } }} />
          )}
          {modal?.kind === 'new' && (
            <NewWorkflowDialog workflows={lib.workflows} onClose={closeModal}
              onCreate={async (name, from) => { await editor.createFrom(name, from); setSelection(null); closeModal(); setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50); }} />
          )}
          {modal?.kind === 'component' && (
            <ComponentEditor kind={modal.type} name={modal.name} sources={lib.sources} onClose={closeModal}
              onSaved={async (item) => { closeModal(); await lib.reload(); refreshGit(); notify(t('app.saved-item', { file: item.file }), 'success'); }} />
          )}
          {modal?.kind === 'sources' && lib.sources && (
            <SourcesDialog sources={lib.sources} onClose={closeModal}
              onSave={async (draft) => {
                try { await api.saveSources(draft); await lib.reload(); closeModal(); notify(t('app.sources-updated'), 'success'); } catch (err) { notify(errorMessage(t, err), 'error'); }
              }} />
          )}
          {modal?.kind === 'workdir' && (
            <FolderPicker title={t('app.workdir.title')} initialPath={status?.workdir} confirmLabel={t('app.workdir.confirm')} onClose={closeModal}
              onPick={async (listing) => {
                try { setStatus(await api.setWorkdir(listing.path)); await lib.reload(); runsState.refresh(); closeModal(); notify(t('app.workdir.set', { path: listing.display }), 'success'); } catch (err) { notify(errorMessage(t, err), 'error'); }
              }} />
          )}
        </Suspense>
      </div>
    </StudioContext.Provider>
  );
}
