// The left sidebar: an icon rail when collapsed, expanded (floating above the canvas) on hover or focus,
// and collapsed again when the cursor leaves or when an item starts being dragged onto the canvas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderCog, History, LayoutGrid } from 'lucide-react';
import Segmented from '../../components/ui/Segmented.jsx';
import { TypeIcon } from '../../components/icons.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import ComponentsPanel from './ComponentsPanel.jsx';
import ExecutionsPanel from './ExecutionsPanel.jsx';

const COLLAPSE_DELAY_MS = 160;

function Rail({ tab, onPick, onSources }) {
  const { t } = useI18n();
  return (
    <nav className="rail" aria-label={t('sidebar.rail.menu')}>
      <button type="button" className={`rail-item ${tab === 'editor' ? 'active' : ''}`} title={t('sidebar.tab.editor')} onClick={() => onPick('editor')}><LayoutGrid size={18} /></button>
      <button type="button" className={`rail-item ${tab === 'executions' ? 'active' : ''}`} title={t('sidebar.tab.executions')} onClick={() => onPick('executions')}><History size={18} /></button>
      <hr />
      {['agent', 'skill', 'action', 'condition'].map((type) => (
        <button key={type} type="button" className="rail-item" title={t('sidebar.rail.components')} onClick={() => onPick('editor')}><TypeIcon type={type} size={18} /></button>
      ))}
      <button type="button" className="rail-item rail-bottom" title={t('sidebar.sources.label')} onClick={onSources}><FolderCog size={18} /></button>
    </nav>
  );
}

export default function Sidebar({ tab, setTab, onSources, ...panelProps }) {
  const { t } = useI18n();
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
      <Rail tab={tab} onPick={(tabName) => { setTab(tabName); expand(); }} onSources={onSources} />
      <div className="sidebar-inner">
        <div className="sidebar-top">
          <Segmented
            ariaLabel={t('sidebar.mode-aria')} value={tab} onChange={setTab}
            options={[{ value: 'editor', label: t('sidebar.tab.editor'), icon: <LayoutGrid size={14} /> }, { value: 'executions', label: t('sidebar.tab.executions'), icon: <History size={14} /> }]}
          />
        </div>
        {tab === 'executions'
          ? <ExecutionsPanel {...panelProps} />
          : <ComponentsPanel {...panelProps} onDragStart={() => collapse(0)} />}
        <button type="button" className="lfooter" onClick={onSources}><FolderCog size={16} /> <span className="label">{t('sidebar.sources.label')}</span></button>
      </div>
    </aside>
  );
}
