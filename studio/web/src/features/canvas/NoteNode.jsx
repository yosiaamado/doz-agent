import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';

function NoteNode({ data, selected }) {
  const node = data.node;
  return (
    <div className={`note ${selected ? 'selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={180} minHeight={90} lineClassName="note-resize-line" handleClassName="note-resize-handle" />
      <div className="note-title">{node.label || 'Catatan'}</div>
      <div className="note-text">{node.text || 'Tulis catatan di panel kanan. Sambungkan ke node supaya ikut ke prompt-nya.'}</div>
      <Handle type="source" position={Position.Right} className="fhandle" />
    </div>
  );
}

export default memo(NoteNode);
