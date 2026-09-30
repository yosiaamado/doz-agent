import { memo, useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { StudioContext } from '../../state/studioContext.js';
import { edgeState } from '../../lib/model.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

function StatusEdge(props) {
  const { t } = useI18n();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, source } = props;
  const { run, nodeTypes } = useContext(StudioContext);
  const loop = data?.loop;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14, offset: loop ? 40 : 20,
  });
  const state = edgeState(props, run, nodeTypes[source]);
  // Cabang ya/tidak sudah dilabeli di handle node; garis hanya diberi label kalau loop.
  const label = loop ? t('canvas.edge.loop', { max: loop }) : null;
  return (
    <>
      <BaseEdge id={id} path={path} className={`sedge ${state ? `e-${state}` : ''} ${loop ? 'e-loop' : ''} ${selected ? 'e-selected' : ''}`} />
      {label && (
        <EdgeLabelRenderer>
          <div className={`edge-label ${state ? `e-${state}` : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(StatusEdge);
