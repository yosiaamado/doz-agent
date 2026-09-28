import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderCog, Pencil, Plus, Search } from 'lucide-react';
import { TypeIcon, StatusIcon } from '../icons.jsx';
import { AGENT_COLORS, NODE_META, formatCost, formatDuration } from '../model.js';

const BASIC = ['start', 'condition', 'approval', 'info', 'output'];

function drag(spec) {
  return (e) => {
    e.dataTransfer.setData('application/doz', JSON.stringify(spec));
    e.dataTransfer.effectAllowed = 'move';
  };
}

function Group({ title, count, onCreate, createLabel, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="lgroup">
      <div className="lgroup-head">
        <button type="button" className="lgroup-toggle" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {title}
          {count !== undefined && <span className="count">{count}</span>}
        </button>
        {onCreate && (
          <button type="button" className="icon-btn" title={createLabel} onClick={onCreate}><Plus size={15} /></button>
        )}
      </div>
      {open && <div className="lgroup-body">{children}</div>}
    </div>
  );
}

function Item({ spec, icon, title, sub, onAdd, onEdit, badge }) {
  return (
    <div className="litem" draggable onDragStart={drag(spec)} onDoubleClick={() => onAdd(spec)} title={`${sub ?? ''}\n\nSeret ke canvas atau klik dua kali.`}>
      {icon}
      <span className="litem-text">
        <span className="litem-title">{title}</span>
        {sub && <span className="litem-sub">{sub}</span>}
      </span>
      {badge}
      {onEdit && (
        <button type="button" className="icon-btn litem-edit" title="Edit file" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}

function Components({ library, onAdd, onEdit, onCreate, onSources }) {
  const [q, setQ] = useState('');
  const match = (x) => !q || `${x.name} ${x.description}`.toLowerCase().includes(q.toLowerCase());
  const agents = library.agents.filter((a) => !a.shadowed && match(a));
  const skills = library.skills.filter((s) => !s.shadowed && match(s));
  const actions = library.actions.filter((a) => !a.shadowed && match(a));
  return (
    <>
      <div className="lsearch">
        <Search size={14} />
        <input placeholder="Cari agent, skill, action…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="lscroll">
        <Group title="Agent" count={agents.length} onCreate={() => onCreate('agents')} createLabel="Agent baru">
          {agents.map((a) => (
            <Item key={a.path} spec={{ type: 'agent', agent: a.name }} onAdd={onAdd} onEdit={() => onEdit('agents', a.name)}
              icon={<span className="litem-icon" style={{ color: AGENT_COLORS[a.color] ?? '#aaa' }}><TypeIcon type="agent" size={16} /></span>}
              title={a.name} sub={a.description} badge={a.canEdit && <span className="tag">edit</span>} />
          ))}
        </Group>
        <Group title="Skill" count={skills.length} onCreate={() => onCreate('skills')} createLabel="Skill baru">
          {skills.map((s) => (
            <Item key={s.path} spec={{ type: 'skill', skill: s.name }} onAdd={onAdd} onEdit={() => onEdit('skills', s.name)}
              icon={<span className="litem-icon skill"><TypeIcon type="skill" size={16} /></span>}
              title={s.name.replace('doz-agent:', '')} sub={s.description} />
          ))}
        </Group>
        <Group title="Action" count={actions.length} onCreate={() => onCreate('actions')} createLabel="Action baru">
          <Item spec={{ type: 'action' }} onAdd={onAdd}
            icon={<span className="litem-icon action"><TypeIcon type="action" size={16} /></span>}
            title="Perintah custom" sub="Tulis perintah shell sendiri di node" />
          {actions.map((a) => (
            <Item key={a.path} spec={{ type: 'action', action: a.name }} onAdd={onAdd} onEdit={() => onEdit('actions', a.name)}
              icon={<span className="litem-icon action"><TypeIcon type="action" size={16} /></span>}
              title={a.name} sub={a.command} />
          ))}
        </Group>
        <Group title="Alur">
          {BASIC.map((t) => (
            <Item key={t} spec={{ type: t }} onAdd={onAdd} icon={<span className="litem-icon"><TypeIcon type={t} size={16} /></span>}
              title={NODE_META[t].label} sub={NODE_META[t].hint} />
          ))}
        </Group>
      </div>
      <button type="button" className="lfooter" onClick={onSources}><FolderCog size={15} /> Folder yang dibaca</button>
    </>
  );
}

function Executions({ runs, workflowName, currentRunId, onSelectRun }) {
  const [all, setAll] = useState(false);
  const list = all ? runs : runs.filter((r) => r.workflow === workflowName);
  return (
    <>
      <div className="lexec-head">
        <span>Executions</span>
        <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> semua workflow</label>
      </div>
      <div className="lscroll">
        {list.length === 0 && <div className="empty">Belum ada run untuk workflow ini.</div>}
        {list.map((r) => (
          <button type="button" key={r.id} className={`lexec ${r.id === currentRunId ? 'active' : ''}`} onClick={() => onSelectRun(r.id)}>
            <span className={`lexec-status s-${r.status}`}><StatusIcon status={r.status === 'done' ? 'done' : r.status === 'running' ? 'running' : 'failed'} /></span>
            <span className="lexec-text">
              <span className="lexec-title">{new Date(r.started).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' })}</span>
              <span className="lexec-sub">
                {r.status === 'running' ? 'berjalan' : r.status === 'done' ? 'Sukses' : r.status}
                {r.duration ? ` dalam ${formatDuration(r.duration)}` : ''} · {r.source === 'claude-code' ? 'Claude Code' : 'studio'}
                {r.cost ? ` · ${formatCost(r.cost)}` : ''}{all ? ` · ${r.workflow}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function LeftPanel(props) {
  return (
    <aside className="lpanel">
      {props.tab === 'executions' ? <Executions {...props} /> : <Components {...props} />}
    </aside>
  );
}
