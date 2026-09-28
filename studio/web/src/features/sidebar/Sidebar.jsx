// Sidebar kiri: rail ikon saat menyempit, melebar (melayang di atas canvas) saat di-hover atau difokus,
// dan menyempit lagi saat kursor pergi atau saat item mulai diseret ke canvas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderCog, History, LayoutGrid } from 'lucide-react';
import Segmented from '../../components/ui/Segmented.jsx';
import { TypeIcon } from '../../components/icons.jsx';
import ComponentsPanel from './ComponentsPanel.jsx';
import ExecutionsPanel from './ExecutionsPanel.jsx';

const COLLAPSE_DELAY_MS = 160;

function Rail({ tab, onPick, onSources }) {
  return (
    <nav className="rail" aria-label="Menu">
      <button type="button" className={`rail-item ${tab === 'editor' ? 'active' : ''}`} title="Editor" onClick={() => onPick('editor')}><LayoutGrid size={18} /></button>
      <button type="button" className={`rail-item ${tab === 'executions' ? 'active' : ''}`} title="Executions" onClick={() => onPick('executions')}><History size={18} /></button>
      <hr />
      {['agent', 'skill', 'action', 'condition'].map((t) => (
        <button key={t} type="button" className="rail-item" title="Komponen" onClick={() => onPick('editor')}><TypeIcon type={t} size={18} /></button>
      ))}
      <button type="button" className="rail-item rail-bottom" title="Folder yang Dibaca" onClick={onSources}><FolderCog size={18} /></button>
    </nav>
  );
}

export default function Sidebar({ tab, setTab, onSources, ...panelProps }) {
  const [expanded, setExpanded] = useState(false);
  const timer = useRef(null);
  const expand = useCallback(() => {
    clearTimeout(timer.current);
    setExpanded(true);
  }, []);
  const collapse = useCallback((delay = COLLAPSE_DELAY_MS) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setExpanded(false), delay);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <aside
      className={`sidebar ${expanded ? 'expanded' : ''}`} onMouseEnter={expand} onMouseLeave={() => collapse()}
      onFocus={expand} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && collapse()}
    >
      <Rail tab={tab} onPick={(t) => { setTab(t); expand(); }} onSources={onSources} />
      <div className="sidebar-inner">
        <div className="sidebar-top">
          <Segmented
            ariaLabel="Mode" value={tab} onChange={setTab}
            options={[{ value: 'editor', label: 'Editor', icon: <LayoutGrid size={14} /> }, { value: 'executions', label: 'Executions', icon: <History size={14} /> }]}
          />
        </div>
        {tab === 'executions'
          ? <ExecutionsPanel {...panelProps} />
          : <ComponentsPanel {...panelProps} onDragStart={() => collapse(0)} />}
        <button type="button" className="lfooter" onClick={onSources}><FolderCog size={16} /> <span className="label">Folder yang Dibaca</span></button>
      </div>
    </aside>
  );
}
