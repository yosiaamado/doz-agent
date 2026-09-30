import { useCallback, useMemo, useState } from 'react';
import { addEdge, useEdgesState, useNodesState } from '@xyflow/react';
import { api } from '../lib/api.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { BRANCHING, emptyWorkflow, fromFlow, toFlow, uniqueId, validate } from '../lib/model.js';

function splitMeta(wf) {
  const { nodes, edges, layout, ...meta } = wf;
  return meta;
}

const withEdgeType = (edges) => edges.map((e) => ({ ...e, type: 'status' }));

function reaches(edges, from, to) {
  const adj = edges.filter((e) => !e.data?.loop).reduce((acc, e) => ({ ...acc, [e.source]: [...(acc[e.source] ?? []), e.target] }), {});
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop();
    if (id === to) return true;
    if (!seen.has(id)) {
      seen.add(id);
      stack.push(...(adj[id] ?? []));
    }
  }
  return false;
}

export function newNode(spec, ids) {
  const node = { type: spec.type };
  if (spec.type === 'agent') node.agent = spec.agent;
  if (spec.type === 'skill') node.skill = spec.skill;
  if (spec.type === 'action' && spec.action) node.action = spec.action;
  if (spec.type === 'condition') node.check = 'Did the previous step pass?'; // workflow file content, not UI copy
  return { ...node, id: uniqueId(spec.agent ?? spec.skill?.split(':').pop() ?? spec.action ?? spec.type, ids) };
}

// Editor state: the workflow meta plus the React Flow nodes/edges plus the unsaved-changes flag.
export function useWorkflowEditor({ agentNames, notify }) {
  const { t } = useI18n();
  const [meta, setMetaState] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dirty, setDirty] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const load = useCallback((wf, errors = []) => {
    const flow = toFlow(wf);
    setMetaState(splitMeta(wf));
    setNodes(flow.nodes);
    setEdges(withEdgeType(flow.edges));
    setServerErrors(errors);
    setDirty(false);
  }, [setNodes, setEdges]);

  const open = useCallback(async (name) => {
    const { workflow, errors } = await api.workflow(name);
    load(workflow, errors);
  }, [load]);

  const createFrom = useCallback(async (name, template) => {
    const base = template ? (await api.workflow(template)).workflow : emptyWorkflow(name);
    load({ ...base, name });
    setDirty(true);
  }, [load]);

  const setMeta = useCallback((m) => { setMetaState(m); setDirty(true); }, []);

  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    const persistent = changes.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false) || (c.type === 'dimensions' && c.resizing === false));
    if (persistent) setDirty(true);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    if (changes.some((c) => c.type === 'remove')) setDirty(true);
  }, [onEdgesChange]);

  const connect = useCallback((conn) => {
    const source = nodes.find((n) => n.id === conn.source)?.data.node;
    const branching = BRANCHING.has(source?.type);
    const loop = reaches(edges, conn.target, conn.source);
    if (loop && !branching) {
      notify(t('editor.cycle-error'), 'error');
      return;
    }
    const data = { ...(branching ? { when: conn.sourceHandle !== 'false' } : {}), ...(loop ? { loop: 2 } : {}) };
    if (loop) notify(t('editor.loop-created'));
    setEdges((eds) => addEdge({ ...conn, id: `e${Date.now()}`, type: 'status', data }, eds));
    setDirty(true);
  }, [nodes, edges, setEdges, notify, t]);

  const addNode = useCallback((spec, position) => {
    const node = newNode(spec, new Set(nodes.map((n) => n.id)));
    const flowNode = { id: node.id, type: spec.type === 'info' ? 'note' : 'doz', position, data: { node }, selected: true };
    const extra = spec.type === 'info' ? { style: { width: 260, height: 160 }, zIndex: -1 } : {};
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...flowNode, ...extra }]);
    setDirty(true);
    return node.id;
  }, [nodes, setNodes]);

  const updateNode = useCallback((node) => {
    setNodes((ns) => ns.map((n) => (n.id === node.id ? { ...n, data: { node } } : n)));
    setDirty(true);
  }, [setNodes]);

  const updateEdge = useCallback((id, data) => {
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, data, sourceHandle: data.when === undefined ? e.sourceHandle : String(data.when) } : e)));
    setDirty(true);
  }, [setEdges]);

  const removeNode = useCallback((id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setDirty(true);
  }, [setNodes, setEdges]);

  const removeEdge = useCallback((id) => {
    setEdges((es) => es.filter((e) => e.id !== id));
    setDirty(true);
  }, [setEdges]);

  const selectOnly = useCallback((id) => setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id }))), [setNodes]);

  const current = useCallback(() => fromFlow(meta, nodes, edges), [meta, nodes, edges]);

  const save = useCallback(async (name) => {
    const res = await api.saveWorkflow(name, { ...fromFlow(meta, nodes, edges), name });
    setMetaState((m) => ({ ...m, name }));
    setServerErrors(res.errors);
    setDirty(false);
    return res;
  }, [meta, nodes, edges]);

  const errors = useMemo(() => {
    if (!meta) return [];
    const client = validate(fromFlow(meta, nodes, edges), agentNames, t);
    return [...new Set([...client, ...(dirty ? [] : serverErrors)])];
  }, [meta, nodes, edges, agentNames, dirty, serverErrors, t]);

  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.data.node])), [nodes]);

  return {
    meta, nodes, edges, dirty, errors, nodesById,
    load, open, createFrom, setMeta, handleNodesChange, handleEdgesChange, connect, addNode,
    updateNode, updateEdge, removeNode, removeEdge, selectOnly, current, save,
  };
}
