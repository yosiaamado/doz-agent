import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, useReactFlow,
} from '@xyflow/react';
import { api, connectEvents } from './api.js';
import NodeCard, { StudioContext } from './NodeCard.jsx';
import Inspector from './Inspector.jsx';
import RunPanel from './RunPanel.jsx';
import {
  NODE_META, AGENT_COLORS, BRANCHING, emptyRun, emptyWorkflow, edgeStyle, fromFlow, reduceRun, toFlow, uniqueId, validate,
} from './model.js';

const nodeTypes = { doz: NodeCard };
const LAST_KEY = 'doz-studio:last-workflow';

function storage(fn) {
  try { return fn(window.localStorage); } catch { return null; }
}

function splitMeta(wf) {
  const { nodes, edges, layout, ...meta } = wf;
  return meta;
}

export default function App() {
  const [status, setStatus] = useState(null);
  const [agents, setAgents] = useState([]);
  const [skills, setSkills] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [meta, setMetaState] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState(null); // { kind: 'node'|'edge', id }
  const [serverErrors, setServerErrors] = useState([]);
  const [run, setRun] = useState(emptyRun());
  const [runs, setRuns] = useState([]);
  const [follow, setFollow] = useState(true);
  const [runDialog, setRunDialog] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [toast, setToast] = useState(null);
  const [editingWorkdir, setEditingWorkdir] = useState(null);
  const wrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  const refs = useRef({});
  refs.current = { ...refs.current, meta, dirty, follow, workflows };
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

  const agentsByName = useMemo(() => Object.fromEntries(agents.map((a) => [a.name, a])), [agents]);

  const openWorkflow = useCallback(async (name) => {
    const { workflow, errors } = await api.workflow(name);
    const flow = toFlow(workflow);
    setMetaState(splitMeta(workflow));
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setServerErrors(errors);
    setSelection(null);
    setDirty(false);
    storage((s) => s.setItem(LAST_KEY, name));
  }, [setNodes, setEdges]);

  const refreshRuns = useCallback(() => api.runs().then(setRuns).catch(() => {}), []);

  const selectRun = useCallback(async (id) => {
    if (!id) { showRun(emptyRun()); return; }
    refs.current.runId = id;
    const { events } = await api.run(id);
    if (refs.current.runId !== id) return;
    const state = events.reduce(reduceRun, emptyRun(id));
    showRun(state);
    const { meta: m, dirty: d, workflows: list } = refs.current;
    if (state.workflow && state.workflow !== m?.name && !d && list.some((w) => w.name === state.workflow)) {
      await openWorkflow(state.workflow);
    }
  }, [openWorkflow, showRun]);

  // Muat awal
  useEffect(() => {
    (async () => {
      const [st, ag, sk, wfs] = await Promise.all([api.status(), api.agents(), api.skills().catch(() => []), api.workflows()]);
      setStatus(st); setAgents(ag); setSkills(sk); setWorkflows(wfs);
      const last = storage((s) => s.getItem(LAST_KEY));
      const first = wfs.find((w) => w.name === last) ?? wfs[0];
      if (first) await openWorkflow(first.name);
      else { const wf = emptyWorkflow('workflow-baru'); setMetaState(splitMeta(wf)); const f = toFlow(wf); setNodes(f.nodes); setEdges(f.edges); setDirty(true); }
      refreshRuns();
    })().catch((err) => notify(`Gagal memuat: ${err.message}`, 'error'));
  }, [openWorkflow, refreshRuns, notify, setNodes, setEdges]);

  // Event realtime
  useEffect(() => connectEvents((msg) => {
    if (msg.type !== 'event') return;
    const ev = msg.event;
    const { runId, follow: f, meta: m, dirty: d, workflows: list } = refs.current;
    if (ev.type === 'run_start' || ev.type === 'run_end') refreshRuns();
    if (ev.run === runId) {
      setRun((r) => (r.id === ev.run ? reduceRun(r, ev) : r));
    } else if (ev.type === 'run_start' && f) {
      showRun(reduceRun(emptyRun(ev.run), ev));
      if (ev.workflow !== m?.name && !d && list.some((w) => w.name === ev.workflow)) openWorkflow(ev.workflow);
      if (ev.source === 'claude-code') notify(`Run dari Claude Code: ${ev.workflow}`);
    }
  }), [openWorkflow, refreshRuns, notify, showRun]);

  const markDirty = useCallback(() => setDirty(true), []);
  const setMeta = (m) => { setMetaState(m); markDirty(); };

  const onNodesChangeWrapped = useCallback((changes) => {
    onNodesChange(changes);
    if (changes.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false))) markDirty();
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
    const e = { from: conn.source, to: conn.target, ...data };
    setEdges((eds) => addEdge({ ...conn, id: `e${Date.now()}`, data, ...edgeStyle(e, source?.type) }, eds));
    markDirty();
  }, [nodes, reaches, setEdges, markDirty, notify]);

  const addNode = useCallback((spec, position) => {
    const ids = new Set(nodes.map((n) => n.id));
    const node = { type: spec.type };
    if (spec.type === 'agent') node.agent = spec.agent;
    if (spec.type === 'skill') node.skill = spec.skill;
    if (spec.type === 'condition') node.check = 'Apakah langkah sebelumnya lolos?';
    node.id = uniqueId(spec.agent ?? spec.skill?.split(':').pop() ?? spec.type, ids);
    let pos = position;
    if (!pos) {
      const rect = wrapper.current.getBoundingClientRect();
      pos = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 });
      pos.x += (nodes.length % 5) * 20;
    }
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })).concat({ id: node.id, type: 'doz', position: pos, data: { node }, selected: true }));
    setSelection({ kind: 'node', id: node.id });
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
    setEdges((es) => es.map((e) => {
      if (e.id !== selection.id) return e;
      const srcType = nodes.find((n) => n.id === e.source)?.data.node.type;
      return { ...e, data, sourceHandle: data.when === undefined ? e.sourceHandle : String(data.when), ...edgeStyle({ ...data }, srcType) };
    }));
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

  const currentWorkflow = () => fromFlow(meta, nodes, edges);
  const clientErrors = meta ? validate(currentWorkflow(), agents.map((a) => a.name)) : [];

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
    setMetaState(splitMeta(wf)); setNodes(f.nodes); setEdges(f.edges); setServerErrors([]); setSelection(null); setDirty(true);
  };

  const switchWorkflow = (name) => {
    if (dirty && !window.confirm('Perubahan belum disimpan. Buang?')) return;
    openWorkflow(name);
  };

  const startRun = async () => {
    try {
      const { id } = await api.startRun(currentWorkflow(), runInput);
      setRunDialog(false);
      showRun(emptyRun(id));
      setSelection(null);
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
      refreshRuns();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const onApprove = useCallback((nodeId, approved) => {
    const note = approved ? '' : window.prompt('Alasan menolak (opsional, ikut ke langkah berikutnya):') ?? '';
    api.approve(refs.current.runId, nodeId, approved, note).catch((err) => notify(err.message, 'error'));
  }, [notify]);

  const ctxValue = useMemo(() => ({ agentsByName, meta, run, onApprove }), [agentsByName, meta, run, onApprove]);

  const selected = selection?.kind === 'node'
    ? { kind: 'node', node: nodes.find((n) => n.id === selection.id)?.data.node }
    : selection?.kind === 'edge'
      ? (() => {
        const edge = edges.find((e) => e.id === selection.id);
        return edge && { kind: 'edge', edge, sourceType: nodes.find((n) => n.id === edge.source)?.data.node.type };
      })()
      : null;
  const validSelection = selected && (selected.node || selected.edge) ? selected : null;
  const nodeLabel = (id) => nodes.find((n) => n.id === id)?.data.node.label || id;
  const errors = [...new Set([...clientErrors, ...(dirty ? [] : serverErrors)])];
  const runners = status?.runners;

  if (!meta) return <div className="loading">Memuat doz studio…</div>;

  return (
    <StudioContext.Provider value={ctxValue}>
      <div className="app">
        <header className="topbar">
          <div className="brand">doz <span>studio</span></div>
          <select className="wf-select" value={workflows.some((w) => w.name === meta.name) ? meta.name : ''} onChange={(e) => switchWorkflow(e.target.value)}>
            {!workflows.some((w) => w.name === meta.name) && <option value="">{meta.name} (belum disimpan)</option>}
            {workflows.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
          <button className="btn" onClick={newWorkflow}>Baru</button>
          <button className="btn" onClick={save} title="Ctrl+S">Simpan{dirty ? ' •' : ''}</button>
          <button className="btn btn-primary" onClick={() => setRunDialog(true)} disabled={errors.length > 0 || run.status === 'running' && run.source === 'studio'}>
            ▶ Jalankan
          </button>
          {errors.length > 0 && <span className="errors" title={errors.join('\n')}>⚠ {errors.length} masalah</span>}
          <div className="spacer" />
          <div className="runners">
            {runners && Object.entries(runners).map(([name, r]) => (
              <span key={name} className={`runner ${r.available ? 'ok' : 'off'}`} title={r.detail}>{r.available ? '●' : '○'} {name}</span>
            ))}
          </div>
          <div className="workdir" title="Folder project tempat agent bekerja">
            {editingWorkdir !== null ? (
              <>
                <input value={editingWorkdir} onChange={(e) => setEditingWorkdir(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && changeWorkdir()} autoFocus />
                <button className="btn btn-sm" onClick={changeWorkdir}>OK</button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setEditingWorkdir(status?.workdir ?? '')}>📁 {status?.workdir}</button>
            )}
          </div>
        </header>

        <div className="main">
          <aside className="palette">
            <div className="palette-title">Node</div>
            {Object.entries(NODE_META).filter(([t]) => !['agent', 'skill'].includes(t)).map(([type, m]) => (
              <div key={type} className="palette-item" draggable title={m.hint}
                onDragStart={(e) => e.dataTransfer.setData('application/doz', JSON.stringify({ type }))}
                onClick={() => addNode({ type })}>
                <span className="glyph">{m.glyph}</span> {m.label}
              </div>
            ))}
            <div className="palette-title">Agent</div>
            {agents.map((a) => (
              <div key={a.name} className="palette-item" draggable title={a.description}
                onDragStart={(e) => e.dataTransfer.setData('application/doz', JSON.stringify({ type: 'agent', agent: a.name }))}
                onClick={() => addNode({ type: 'agent', agent: a.name })}>
                <span className="dot" style={{ background: AGENT_COLORS[a.color] ?? '#888' }} /> {a.name}
                {a.canEdit && <span className="chip">edit</span>}
              </div>
            ))}
            <div className="palette-title">Skill</div>
            {skills.map((s) => (
              <div key={s.name} className="palette-item" draggable title={s.description}
                onDragStart={(e) => e.dataTransfer.setData('application/doz', JSON.stringify({ type: 'skill', skill: s.name }))}
                onClick={() => addNode({ type: 'skill', skill: s.name })}>
                <span className="glyph">✦</span> {s.name.replace('doz-agent:', '')}
              </div>
            ))}
          </aside>

          <div className="canvas" ref={wrapper} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChangeWrapped}
              onEdgesChange={onEdgesChangeWrapped}
              onConnect={onConnect}
              onNodeClick={(_, n) => setSelection({ kind: 'node', id: n.id })}
              onEdgeClick={(_, e) => setSelection({ kind: 'edge', id: e.id })}
              onPaneClick={() => setSelection(null)}
              deleteKeyCode={['Delete', 'Backspace']}
              fitView
              fitViewOptions={{ padding: 0.15, maxZoom: 1, minZoom: 0.7 }}
              colorMode="dark"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls />
              <MiniMap pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
          </div>

          <Inspector
            selection={validSelection}
            ctx={{ agents, skills, meta, nodes, runners }}
            meta={meta}
            setMeta={setMeta}
            onNodeChange={updateNode}
            onEdgeChange={updateEdge}
            onDelete={deleteSelection}
          />
        </div>

        <RunPanel
          run={run}
          runs={runs}
          selectedNode={selection?.kind === 'node' ? selection.id : null}
          nodeLabel={nodeLabel}
          onSelectRun={selectRun}
          onStop={() => api.stopRun(run.id).catch((err) => notify(err.message, 'error'))}
          follow={follow}
          setFollow={setFollow}
        />

        {runDialog && (
          <div className="modal-backdrop" onClick={() => setRunDialog(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Jalankan {meta.name}</h2>
              <p className="muted small">Agent bekerja di <code>{status?.workdir}</code>. Versi di canvas yang dijalankan, termasuk perubahan yang belum disimpan.</p>
              <textarea rows={6} autoFocus placeholder="Permintaan, mis. tambah endpoint export CSV untuk laporan penjualan"
                value={runInput} onChange={(e) => setRunInput(e.target.value)} />
              <div className="modal-actions">
                <button className="btn" onClick={() => setRunDialog(false)}>Batal</button>
                <button className="btn btn-primary" onClick={startRun}>▶ Mulai</button>
              </div>
            </div>
          </div>
        )}
        {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
      </div>
    </StudioContext.Provider>
  );
}
