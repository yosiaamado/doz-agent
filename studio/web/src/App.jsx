import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, MiniMap, Panel, addEdge, useEdgesState, useNodesState, useReactFlow,
} from '@xyflow/react';
import { FolderOpen, Maximize, Play, Save, Settings2, Square, ZoomIn, ZoomOut, Plus } from 'lucide-react';
import { api, connectEvents } from './api.js';
import { StudioContext } from './context.js';
import FlowNode from './nodes/FlowNode.jsx';
import NoteNode from './nodes/NoteNode.jsx';
import StatusEdge from './nodes/StatusEdge.jsx';
import LeftPanel from './panels/LeftPanel.jsx';
import SettingsPanel from './panels/SettingsPanel.jsx';
import LogsPanel from './panels/LogsPanel.jsx';
import ComponentEditor from './dialogs/ComponentEditor.jsx';
import SourcesDialog from './dialogs/SourcesDialog.jsx';
import {
  BRANCHING, emptyRun, emptyWorkflow, fromFlow, reduceRun, toFlow, uniqueId, validate,
} from './model.js';

const nodeTypes = { doz: FlowNode, note: NoteNode };
const edgeTypes = { status: StatusEdge };
const defaultEdgeOptions = { type: 'status' };
const LAST_KEY = 'doz-studio:last-workflow';

function storage(fn) {
  try { return fn(window.localStorage); } catch { return null; }
}

function splitMeta(wf) {
  const { nodes, edges, layout, ...meta } = wf;
  return meta;
}

function withEdgeType(edges) {
  return edges.map((e) => ({ ...e, type: 'status' }));
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [library, setLibrary] = useState({ agents: [], skills: [], actions: [] });
  const [sources, setSources] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [meta, setMetaState] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState(null); // { kind: 'node'|'edge', id }
  const [rightOpen, setRightOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [run, setRun] = useState(emptyRun());
  const [runs, setRuns] = useState([]);
  const [tab, setTab] = useState('editor');
  const [logsOpen, setLogsOpen] = useState(true);
  const [runDialog, setRunDialog] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [editor, setEditor] = useState(null); // { kind, name|null }
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingWorkdir, setEditingWorkdir] = useState(null);
  const wrapper = useRef(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const refs = useRef({});
  refs.current = { ...refs.current, meta, dirty, workflows };
  // Id run yang ditampilkan disimpan langsung di ref, supaya event WebSocket yang datang beruntun
  // sebelum render berikutnya tetap masuk ke run yang benar.
  const showRun = useCallback((state) => {
    refs.current.runId = state.id;
    setRun(state);
  }, []);

  const notify = useCallback((text, kind = 'info') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadLibrary = useCallback(async () => {
    const [agents, skills, actions, src, wfs] = await Promise.all([
      api.library('agents'), api.library('skills').catch(() => []), api.library('actions').catch(() => []), api.sources(), api.workflows(),
    ]);
    setLibrary({ agents, skills, actions });
    setSources(src);
    setWorkflows(wfs);
    return wfs;
  }, []);

  const agentsByName = useMemo(() => Object.fromEntries(library.agents.filter((a) => !a.shadowed).map((a) => [a.name, a])), [library]);

  const openWorkflow = useCallback(async (name) => {
    const { workflow, errors } = await api.workflow(name);
    const flow = toFlow(workflow);
    setMetaState(splitMeta(workflow));
    setNodes(flow.nodes);
    setEdges(withEdgeType(flow.edges));
    setServerErrors(errors);
    setSelection(null);
    setDirty(false);
    storage((s) => s.setItem(LAST_KEY, name));
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 200 }), 50);
  }, [setNodes, setEdges, fitView]);

  const refreshRuns = useCallback(() => api.runs().then(setRuns).catch(() => {}), []);

  const selectRun = useCallback(async (id) => {
    if (!id) { showRun(emptyRun()); return; }
    refs.current.runId = id;
    const { events } = await api.run(id);
    if (refs.current.runId !== id) return;
    const state = events.reduce(reduceRun, emptyRun(id));
    showRun(state);
    setLogsOpen(true);
    const { meta: m, dirty: d, workflows: list } = refs.current;
    if (state.workflow && state.workflow !== m?.name && !d && list.some((w) => w.name === state.workflow)) {
      await openWorkflow(state.workflow);
    }
  }, [openWorkflow, showRun]);

  // Muat awal
  useEffect(() => {
    (async () => {
      const [st, wfs] = await Promise.all([api.status(), loadLibrary()]);
      setStatus(st);
      const last = storage((s) => s.getItem(LAST_KEY));
      const first = wfs.find((w) => w.name === last) ?? wfs[0];
      if (first) await openWorkflow(first.name);
      else {
        const wf = emptyWorkflow('workflow-baru');
        const f = toFlow(wf);
        setMetaState(splitMeta(wf)); setNodes(f.nodes); setEdges(withEdgeType(f.edges)); setDirty(true);
      }
      refreshRuns();
    })().catch((err) => notify(`Gagal memuat: ${err.message}`, 'error'));
  }, [openWorkflow, refreshRuns, notify, setNodes, setEdges, loadLibrary]);

  // Event realtime
  useEffect(() => connectEvents((msg) => {
    if (msg.type !== 'event') return;
    const ev = msg.event;
    const { runId, meta: m, dirty: d, workflows: list } = refs.current;
    if (ev.type === 'run_start' || ev.type === 'run_end') refreshRuns();
    if (ev.run === runId) {
      setRun((r) => (r.id === ev.run ? reduceRun(r, ev) : r));
    } else if (ev.type === 'run_start') {
      showRun(reduceRun(emptyRun(ev.run), ev));
      setLogsOpen(true);
      if (ev.workflow !== m?.name && !d && list.some((w) => w.name === ev.workflow)) openWorkflow(ev.workflow);
      if (ev.source === 'claude-code') notify(`Run dari Claude Code: ${ev.workflow}`);
    }
  }), [openWorkflow, refreshRuns, notify, showRun]);

  const markDirty = useCallback(() => setDirty(true), []);
  const setMeta = (m) => { setMetaState(m); markDirty(); };

  const onNodesChangeWrapped = useCallback((changes) => {
    onNodesChange(changes);
    if (changes.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false) || (c.type === 'dimensions' && c.resizing === false))) markDirty();
    if (changes.some((c) => c.type === 'remove')) setSelection(null);
  }, [onNodesChange, markDirty]);

  const onEdgesChangeWrapped = useCallback((changes) => {
    onEdgesChange(changes);
    if (changes.some((c) => c.type === 'remove')) { markDirty(); setSelection(null); }
  }, [onEdgesChange, markDirty]);

  const reaches = useCallback((from, to) => {
    const adj = {};
    for (const e of edges) if (!e.data?.loop) (adj[e.source] ??= []).push(e.target);
    const stack = [from];
    const seen = new Set();
    while (stack.length) {
      const id = stack.pop();
      if (id === to) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(adj[id] ?? []));
    }
    return false;
  }, [edges]);

  const onConnect = useCallback((conn) => {
    const source = nodes.find((n) => n.id === conn.source)?.data.node;
    const branching = BRANCHING.has(source?.type);
    const data = {};
    if (branching) data.when = conn.sourceHandle !== 'false';
    if (reaches(conn.target, conn.source)) {
      if (!branching) { notify('Garis ini membuat siklus. Loop hanya boleh keluar dari Condition/Approval.', 'error'); return; }
      data.loop = 2;
      notify('Garis balik dijadikan loop (maks 2x). Ubah di panel kanan.');
    }
    setEdges((eds) => addEdge({ ...conn, id: `e${Date.now()}`, type: 'status', data }, eds));
    markDirty();
  }, [nodes, reaches, setEdges, markDirty, notify]);

  const addNode = useCallback((spec, position) => {
    const ids = new Set(nodes.map((n) => n.id));
    const node = { type: spec.type };
    if (spec.type === 'agent') node.agent = spec.agent;
    if (spec.type === 'skill') node.skill = spec.skill;
    if (spec.type === 'action' && spec.action) node.action = spec.action;
    if (spec.type === 'condition') node.check = 'Apakah langkah sebelumnya lolos?';
    node.id = uniqueId(spec.agent ?? spec.skill?.split(':').pop() ?? spec.action ?? spec.type, ids);
    let pos = position;
    if (!pos) {
      const rect = wrapper.current.getBoundingClientRect();
      pos = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 });
      pos.x += (nodes.length % 5) * 24;
    }
    const flowNode = { id: node.id, type: spec.type === 'info' ? 'note' : 'doz', position: pos, data: { node }, selected: true };
    if (spec.type === 'info') { flowNode.style = { width: 260, height: 160 }; flowNode.zIndex = -1; }
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat(flowNode));
    setSelection({ kind: 'node', id: node.id });
    setRightOpen(true);
    markDirty();
  }, [nodes, setNodes, screenToFlowPosition, markDirty]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/doz');
    if (!raw) return;
    addNode(JSON.parse(raw), screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [addNode, screenToFlowPosition]);

  const updateNode = (node) => {
    setNodes((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: { node } } : n)));
    markDirty();
  };

  const updateEdge = (data) => {
    setEdges((es) => es.map((e) => (e.id === selection.id
      ? { ...e, data, sourceHandle: data.when === undefined ? e.sourceHandle : String(data.when) }
      : e)));
    markDirty();
  };

  const deleteSelection = () => {
    if (selection?.kind === 'node') {
      setNodes((ns) => ns.filter((n) => n.id !== selection.id));
      setEdges((es) => es.filter((e) => e.source !== selection.id && e.target !== selection.id));
    } else if (selection?.kind === 'edge') {
      setEdges((es) => es.filter((e) => e.id !== selection.id));
    }
    setSelection(null);
    markDirty();
  };

  const selectNode = (id) => {
    setSelection({ kind: 'node', id });
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
  };

  const currentWorkflow = () => fromFlow(meta, nodes, edges);
  const clientErrors = meta ? validate(currentWorkflow(), Object.keys(agentsByName)) : [];

  const save = useCallback(async () => {
    let name = meta.name;
    if (!workflows.some((w) => w.name === name)) {
      name = window.prompt('Nama file workflow (huruf kecil, angka, -):', name)?.trim();
      if (!name) return;
    }
    try {
      const res = await api.saveWorkflow(name, { ...fromFlow(meta, nodes, edges), name });
      setMetaState((m) => ({ ...m, name }));
      setServerErrors(res.errors);
      setDirty(false);
      setWorkflows(await api.workflows());
      storage((s) => s.setItem(LAST_KEY, name));
      notify(`Tersimpan ke ${res.file}`);
    } catch (err) {
      notify(err.message, 'error');
    }
  }, [meta, nodes, edges, workflows, notify]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (meta) save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, meta]);

  const newWorkflow = () => {
    if (dirty && !window.confirm('Perubahan belum disimpan. Buang?')) return;
    const name = window.prompt('Nama workflow baru:', 'workflow-baru')?.trim();
    if (!name) return;
    const wf = emptyWorkflow(name);
    const f = toFlow(wf);
    setMetaState(splitMeta(wf)); setNodes(f.nodes); setEdges(withEdgeType(f.edges)); setServerErrors([]); setSelection(null); setDirty(true);
  };

  const switchWorkflow = (name) => {
    if (name === '__new') { newWorkflow(); return; }
    if (dirty && !window.confirm('Perubahan belum disimpan. Buang?')) return;
    openWorkflow(name);
  };

  const startRun = async () => {
    try {
      const { id } = await api.startRun(currentWorkflow(), runInput);
      setRunDialog(false);
      showRun(emptyRun(id));
      setLogsOpen(true);
      refreshRuns();
      await selectRun(id);
    } catch (err) {
      notify(err.errors?.length ? `${err.message}: ${err.errors.join('; ')}` : err.message, 'error');
    }
  };

  const changeWorkdir = async () => {
    try {
      setStatus(await api.setWorkdir(editingWorkdir));
      setEditingWorkdir(null);
      await loadLibrary();
      refreshRuns();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const onApprove = useCallback((nodeId, approved) => {
    const note = approved ? '' : window.prompt('Alasan menolak (opsional, ikut ke langkah berikutnya):') ?? '';
    api.approve(refs.current.runId, nodeId, approved, note).catch((err) => notify(err.message, 'error'));
  }, [notify]);

  const onEditComponent = useCallback((kind, name) => setEditor({ kind, name }), []);

  const nodeTypesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.data.node.type])), [nodes]);
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.data.node])), [nodes]);
  const ctxValue = useMemo(
    () => ({ agentsByName, meta, run, onApprove, onEditComponent, nodeTypes: nodeTypesById }),
    [agentsByName, meta, run, onApprove, onEditComponent, nodeTypesById],
  );

  const selected = selection?.kind === 'node'
    ? { kind: 'node', node: nodesById[selection.id] }
    : selection?.kind === 'edge'
      ? (() => {
        const edge = edges.find((e) => e.id === selection.id);
        return edge && { kind: 'edge', edge, sourceType: nodeTypesById[edge.source] };
      })()
      : null;
  const validSelection = selected && (selected.node || selected.edge) ? selected : null;
  const errors = [...new Set([...clientErrors, ...(dirty ? [] : serverErrors)])];
  const runners = status?.runners;
  const running = run.status === 'running' && run.source === 'studio';

  if (!meta) return <div className="loading">Memuat doz studio…</div>;

  return (
    <StudioContext.Provider value={ctxValue}>
      <div className="app">
        <header className="topbar">
          <div className="brand"><span className="brand-dot" />doz <b>studio</b></div>
          <select className="wf-select" value={workflows.some((w) => w.name === meta.name) ? meta.name : ''} onChange={(e) => switchWorkflow(e.target.value)}>
            {!workflows.some((w) => w.name === meta.name) && <option value="">{meta.name} (belum disimpan)</option>}
            {workflows.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
            <option value="__new">+ Workflow baru…</option>
          </select>
          {dirty && <span className="dirty" title="Belum disimpan">●</span>}
          {errors.length > 0 && <span className="errors" title={errors.join('\n')}>⚠ {errors.length} masalah</span>}

          <div className="tabs-pill">
            <button type="button" className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>Editor</button>
            <button type="button" className={tab === 'executions' ? 'active' : ''} onClick={() => { setTab('executions'); refreshRuns(); }}>Executions</button>
          </div>

          <div className="topbar-right">
            {runners && Object.entries(runners).map(([name, r]) => (
              <span key={name} className={`runner ${r.available ? 'ok' : 'off'}`} title={r.detail}><span className="runner-dot" />{name}</span>
            ))}
            {editingWorkdir !== null ? (
              <span className="workdir-edit">
                <input value={editingWorkdir} onChange={(e) => setEditingWorkdir(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && changeWorkdir()} autoFocus />
                <button type="button" className="btn btn-sm" onClick={changeWorkdir}>OK</button>
                <button type="button" className="btn btn-sm" onClick={() => setEditingWorkdir(null)}>Batal</button>
              </span>
            ) : (
              <button type="button" className="btn btn-ghost workdir" title={`Folder project: ${status?.workdir}`} onClick={() => setEditingWorkdir(status?.workdir ?? '')}>
                <FolderOpen size={14} /> {status?.workdir?.split(/[/\\]/).slice(-2).join('/')}
              </button>
            )}
            <button type="button" className="icon-btn" title="Pengaturan workflow" onClick={() => { setSelection(null); setRightOpen(true); }}><Settings2 size={17} /></button>
            <button type="button" className="btn" onClick={save} title="Ctrl+S"><Save size={14} /> Simpan</button>
          </div>
        </header>

        <div className="workspace">
          <LeftPanel
            tab={tab} library={library} onAdd={addNode} onEdit={onEditComponent}
            onCreate={(kind) => setEditor({ kind, name: null })} onSources={() => setSourcesOpen(true)}
            runs={runs} workflowName={meta.name} currentRunId={run.id} onSelectRun={selectRun}
          />
          <div className="center">
            <div className="canvas" ref={wrapper} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                onNodesChange={onNodesChangeWrapped}
                onEdgesChange={onEdgesChangeWrapped}
                onConnect={onConnect}
                onNodeClick={(_, n) => { setSelection({ kind: 'node', id: n.id }); setRightOpen(true); }}
                onEdgeClick={(_, e) => { setSelection({ kind: 'edge', id: e.id }); setRightOpen(true); }}
                onPaneClick={() => setSelection(null)}
                deleteKeyCode={['Delete', 'Backspace']}
                // Navigasi ala Figma: scroll = geser, Ctrl/⌘ + scroll atau pinch = zoom,
                // Space + drag / klik tengah = geser, drag di area kosong = pilih banyak.
                panOnScroll
                zoomOnScroll={false}
                zoomOnPinch
                zoomActivationKeyCode={['Control', 'Meta']}
                panOnDrag={[1, 2]}
                selectionOnDrag
                panActivationKeyCode="Space"
                minZoom={0.2}
                maxZoom={2}
                fitView
                fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                colorMode="dark"
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#4a4a4a" />
                <MiniMap pannable zoomable nodeStrokeWidth={2} maskColor="rgba(20,20,20,.6)" nodeColor="#555" style={{ width: 170, height: 110 }} />
                <Panel position="bottom-left" className="zoom-bar">
                  <button type="button" onClick={() => fitView({ padding: 0.2, duration: 200 })} title="Muat semua"><Maximize size={15} /></button>
                  <button type="button" onClick={() => zoomIn({ duration: 150 })} title="Zoom in"><ZoomIn size={15} /></button>
                  <button type="button" onClick={() => zoomOut({ duration: 150 })} title="Zoom out"><ZoomOut size={15} /></button>
                </Panel>
                <Panel position="bottom-center" className="run-bar">
                  {running ? (
                    <button type="button" className="btn btn-stop" onClick={() => api.stopRun(run.id)}><Square size={14} /> Stop workflow</button>
                  ) : (
                    <button type="button" className="btn btn-run" disabled={errors.length > 0} onClick={() => setRunDialog(true)} title={errors.join('\n')}>
                      <Play size={15} /> Jalankan workflow
                    </button>
                  )}
                </Panel>
                <Panel position="top-right" className="canvas-hint">Scroll = geser · Ctrl+scroll = zoom · Space+drag = geser · drag kosong = pilih</Panel>
                {nodes.length <= 1 && (
                  <Panel position="top-center" className="canvas-empty"><Plus size={14} /> Seret agent, skill, atau action dari panel kiri ke sini</Panel>
                )}
              </ReactFlow>
            </div>
            <LogsPanel
              run={run} nodesById={nodesById} git={status?.git}
              selectedNode={selection?.kind === 'node' && run.nodes[selection.id] ? selection.id : null}
              onSelectNode={selectNode}
              onStop={() => api.stopRun(run.id).catch((err) => notify(err.message, 'error'))}
              open={logsOpen} setOpen={setLogsOpen}
            />
          </div>
          {rightOpen && (
            <SettingsPanel
              selection={validSelection}
              ctx={{ library, meta, nodes, runners }}
              meta={meta}
              setMeta={setMeta}
              onNodeChange={updateNode}
              onEdgeChange={updateEdge}
              onDelete={deleteSelection}
              onClose={() => setRightOpen(false)}
              onEditComponent={onEditComponent}
            />
          )}
        </div>

        {runDialog && (
          <div className="modal-backdrop" onMouseDown={() => setRunDialog(false)}>
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="editor-title">Jalankan {meta.name}</div>
              <p className="muted small">Agent bekerja di <code>{status?.workdir}</code>. Versi di canvas yang dijalankan, termasuk perubahan yang belum disimpan.</p>
              <textarea rows={6} autoFocus placeholder="Permintaan, mis. tambah endpoint export CSV untuk laporan penjualan"
                value={runInput} onChange={(e) => setRunInput(e.target.value)} />
              <div className="editor-foot">
                <span className="spacer" />
                <button type="button" className="btn" onClick={() => setRunDialog(false)}>Batal</button>
                <button type="button" className="btn btn-run" onClick={startRun}><Play size={14} /> Mulai</button>
              </div>
            </div>
          </div>
        )}
        {editor && (
          <ComponentEditor
            kind={editor.kind} name={editor.name} sources={sources}
            onClose={() => setEditor(null)}
            onSaved={async (item) => {
              setEditor(null);
              await loadLibrary();
              notify(`Tersimpan: ${item.file}`);
            }}
          />
        )}
        {sourcesOpen && sources && (
          <SourcesDialog
            sources={sources}
            onClose={() => setSourcesOpen(false)}
            onSave={async (draft) => {
              try {
                await api.saveSources(draft);
                await loadLibrary();
                setSourcesOpen(false);
                notify('Folder sumber diperbarui');
              } catch (err) {
                notify(err.message, 'error');
              }
            }}
          />
        )}
        {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
      </div>
    </StudioContext.Provider>
  );
}
