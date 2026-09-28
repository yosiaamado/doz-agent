import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from 'lucide-react';
import { TypeIcon } from '../../components/icons.jsx';
import { AGENT_COLORS, NODE_META } from '../../lib/model.js';
import { useDebounce } from '../../hooks/useDebounce.js';

const BASIC = ['start', 'condition', 'approval', 'info', 'output'];

function Group({ title, count, onCreate, createLabel, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="lgroup">
      <div className="lgroup-head">
        <button type="button" className="lgroup-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
          {count !== undefined && <span className="count">{count}</span>}
        </button>
        {onCreate && <button type="button" className="icon-btn" title={createLabel} aria-label={createLabel} onClick={onCreate}><Plus size={15} /></button>}
      </div>
      {open && <div className="lgroup-body">{children}</div>}
    </div>
  );
}

function Item({ spec, icon, title, sub, onAdd, onEdit, onDragStart }) {
  const startDrag = (e) => {
    e.dataTransfer.setData('application/doz', JSON.stringify(spec));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.();
  };
  return (
    <div className="litem" draggable onDragStart={startDrag} onDoubleClick={() => onAdd(spec)} title={`${sub ?? ''}\n\nSeret ke canvas atau klik dua kali.`}>
      {icon}
      <span className="litem-text">
        <span className="litem-title">{title}</span>
        {sub && <span className="litem-sub">{sub}</span>}
      </span>
      {onEdit && (
        <button type="button" className="icon-btn litem-edit" title="Edit file" aria-label={`Edit ${title}`} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}

export default function ComponentsPanel({ library, onAdd, onEdit, onCreate, onDragStart }) {
  const [q, setQ] = useState('');
  const query = useDebounce(q, 120).toLowerCase();
  const visible = (list) => list.filter((x) => !x.shadowed && (!query || `${x.name} ${x.description}`.toLowerCase().includes(query)));
  const agents = visible(library.agents);
  const skills = visible(library.skills);
  const actions = visible(library.actions);
  const common = { onAdd, onDragStart };
  return (
    <>
      <div className="sidebar-top" style={{ paddingTop: 0 }}>
        <div className="lsearch">
          <Search size={14} />
          <input placeholder="Cari agent, skill, action…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari komponen" />
        </div>
      </div>
      <div className="lscroll">
        <Group title="Agent" count={agents.length} onCreate={() => onCreate('agents')} createLabel="Agent Baru">
          {agents.map((a) => (
            <Item key={a.path} spec={{ type: 'agent', agent: a.name }} onEdit={() => onEdit('agents', a.name)} {...common}
              icon={<span className="litem-icon" style={{ color: AGENT_COLORS[a.color] }}><TypeIcon type="agent" size={16} /></span>}
              title={a.name} sub={a.description} />
          ))}
        </Group>
        <Group title="Skill" count={skills.length} onCreate={() => onCreate('skills')} createLabel="Skill Baru">
          {skills.map((s) => (
            <Item key={s.path} spec={{ type: 'skill', skill: s.name }} onEdit={() => onEdit('skills', s.name)} {...common}
              icon={<span className="litem-icon skill"><TypeIcon type="skill" size={16} /></span>}
              title={s.name.replace('doz-agent:', '')} sub={s.description} />
          ))}
        </Group>
        <Group title="Action" count={actions.length} onCreate={() => onCreate('actions')} createLabel="Action Baru">
          <Item spec={{ type: 'action' }} {...common} icon={<span className="litem-icon action"><TypeIcon type="action" size={16} /></span>}
            title="Perintah Custom" sub="Tulis perintah shell sendiri di node" />
          {actions.map((a) => (
            <Item key={a.path} spec={{ type: 'action', action: a.name }} onEdit={() => onEdit('actions', a.name)} {...common}
              icon={<span className="litem-icon action"><TypeIcon type="action" size={16} /></span>}
              title={a.name} sub={a.command} />
          ))}
        </Group>
        <Group title="Alur">
          {BASIC.map((t) => (
            <Item key={t} spec={{ type: t }} {...common} icon={<span className="litem-icon"><TypeIcon type={t} size={16} /></span>}
              title={NODE_META[t].label} sub={NODE_META[t].hint} />
          ))}
        </Group>
      </div>
    </>
  );
}
