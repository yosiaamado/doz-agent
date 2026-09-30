import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

function NoteNode({ data, selected }) {
  const { t } = useI18n();
  const node = data.node;
  return (
    <div className={`note ${selected ? 'selected' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={180} minHeight={90} lineClassName="note-resize-line" handleClassName="note-resize-handle" />
      <div className="note-title">{node.label || t('canvas.node.info.label')}</div>
      <div className="note-text">{node.text || t('canvas.note.placeholder')}</div>
      <Handle type="source" position={Position.Right} className="fhandle" />
    </div>
  );
}

export default memo(NoteNode);
