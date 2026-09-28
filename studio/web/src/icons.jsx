import {
  Bot, Sparkles, SquareTerminal, GitBranch, Hand, StickyNote, Flag, Zap, Check, X, Loader2, Pause, CircleSlash,
} from 'lucide-react';

export const TYPE_ICON = {
  start: Zap, agent: Bot, skill: Sparkles, action: SquareTerminal, condition: GitBranch,
  approval: Hand, info: StickyNote, output: Flag,
};

export const STATUS_ICON = { done: Check, failed: X, running: Loader2, waiting: Pause, skipped: CircleSlash, stopped: X };

export function TypeIcon({ type, size = 18, ...rest }) {
  const Icon = TYPE_ICON[type] ?? Bot;
  return <Icon size={size} strokeWidth={1.8} {...rest} />;
}

export function StatusIcon({ status, size = 14 }) {
  const Icon = STATUS_ICON[status];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={2.4} className={`status-icon s-${status} ${status === 'running' ? 'spin' : ''}`} />;
}
