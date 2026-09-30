// Canvas React Flow. Navigasi: drag kiri/tengah = geser, scroll = geser, Ctrl/⌘ + scroll atau pinch = zoom,
// Shift + drag = pilih banyak. Node menempel ke grid 20px.
import { forwardRef } from 'react';
import { ReactFlow, Background, BackgroundVariant, MiniMap, Panel, useReactFlow } from '@xyflow/react';
import { Maximize, Play, Plus, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import FlowNode from './FlowNode.jsx';
import NoteNode from './NoteNode.jsx';
import StatusEdge from './StatusEdge.jsx';

export const GRID = 20;
const nodeTypes = { doz: FlowNode, note: NoteNode };
const edgeTypes = { status: StatusEdge };
const defaultEdgeOptions = { type: 'status' };

const FlowCanvas = forwardRef(function FlowCanvas({ editor, theme, onSelect, onDropSpec, running, errors, onRun, onStop }, ref) {
  const { t } = useI18n();
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();
  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/doz');
    if (raw) onDropSpec(JSON.parse(raw), screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  return (
    <div className="canvas" ref={ref} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
      <ReactFlow
        nodes={editor.nodes}
        edges={editor.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={editor.handleNodesChange}
        onEdgesChange={editor.handleEdgesChange}
        onConnect={editor.connect}
        onNodeClick={(_, n) => onSelect({ kind: 'node', id: n.id })}
        onEdgeClick={(_, e) => onSelect({ kind: 'edge', id: e.id })}
        onPaneClick={() => onSelect(null)}
        deleteKeyCode={['Delete', 'Backspace']}
        snapToGrid
        snapGrid={[GRID, GRID]}
        panOnDrag={[0, 1]}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={['Control', 'Meta']}
        selectionKeyCode="Shift"
        selectionOnDrag={false}
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        colorMode={theme}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID} size={1.5} color="var(--dots)" />
        <MiniMap pannable zoomable nodeStrokeWidth={2} style={{ width: 170, height: 110 }} />
        <Panel position="bottom-left" className="zoom-bar">
          <button type="button" onClick={() => fitView({ padding: 0.2, duration: 200 })} title={t('canvas.controls.fit')} aria-label={t('canvas.controls.fit')}><Maximize size={15} /></button>
          <button type="button" onClick={() => zoomIn({ duration: 150 })} title={t('canvas.controls.zoom-in')} aria-label={t('canvas.controls.zoom-in')}><ZoomIn size={15} /></button>
          <button type="button" onClick={() => zoomOut({ duration: 150 })} title={t('canvas.controls.zoom-out')} aria-label={t('canvas.controls.zoom-out')}><ZoomOut size={15} /></button>
        </Panel>
        <Panel position="bottom-center" className="run-bar">
          {running
            ? <button type="button" className="btn btn-stop" onClick={onStop}><Square size={14} /> {t('canvas.run.stop')}</button>
            : (
              <button type="button" className="btn btn-run" disabled={errors.length > 0} onClick={onRun} title={errors.join('\n')}>
                <Play size={15} /> {t('canvas.run.start')}
              </button>
            )}
        </Panel>
        <Panel position="top-right" className="canvas-hint">{t('canvas.hint')}</Panel>
        {editor.nodes.length <= 1 && (
          <Panel position="top-center" className="canvas-empty"><Plus size={14} /> {t('canvas.empty-hint')}</Panel>
        )}
      </ReactFlow>
    </div>
  );
});

export default FlowCanvas;
