// Starts, stops, and approves runs; persists events through the run log repository.
import crypto from 'node:crypto';
import { WorkflowRun } from '../domain/engine.js';
import { badRequest, notFound, codeOf } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

const EXTERNAL_RUN_FRESH_MS = 10 * 60 * 1000;

export function createRunService({ config, components, workflows, attachments, runLog, runners, tracker }) {
  const activeRun = (id) => {
    const run = runLog.runs.get(id)?.run;
    if (!run) throw notFound('The run is not active in this studio', { code: 'RUN_NOT_ACTIVE' });
    return run;
  };

  return {
    list: () => runLog.list(),
    // Used by the update guard: `claude-cli` uses --plugin-dir for as long as a run is in flight.
    // Studio runs always count; runs from a terminal (source claude-code) count while their last event is still fresh,
    // so a run that crashed without a run_end does not block updates forever.
    hasActive: (now = Date.now()) => [...runLog.runs.values()].some((r) => r.status === 'running'
      && (r.run || now - (r.events.at(-1)?.ts ?? r.started) < EXTERNAL_RUN_FRESH_MS)),
    events(id) {
      const events = runLog.events(id);
      if (!events) throw notFound('Run not found', { code: 'RUN_NOT_FOUND' });
      return { id, events };
    },
    start({ workflow, name, input, attachments: attachmentIds }) {
      const { wf, errors } = workflows.resolveForRun({ workflow, name });
      if (errors.length) throw badRequest('The workflow is not valid', { code: 'WORKFLOW_INVALID', details: errors });
      const id = newRunId();
      const run = new WorkflowRun({
        id,
        wf,
        agents: components.list('agents').filter((x) => !x.shadowed),
        actions: components.list('actions').filter((x) => !x.shadowed),
        input: attachments.composeInput(input, attachmentIds),
        workdir: config.getWorkdir(),
        runners,
        tracker,
        emit: (ev) => runLog.record({ source: 'studio', ...ev }),
      });
      runLog.create(id, wf.name, run);
      run.start().catch((err) => logger.error('run crashed', { run: id, error: err.message }));
      return { id };
    },
    stop(id) {
      activeRun(id).stop();
      return { stopped: true };
    },
    approve(id, { node, approved, note }) {
      try {
        activeRun(id).approve(node, approved, note);
      } catch (err) {
        throw badRequest(err.message, codeOf(err));
      }
      return { approved };
    },
  };
}
