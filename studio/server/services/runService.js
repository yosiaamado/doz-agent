// Memulai, menghentikan, dan menyetujui run; menyimpan event lewat run log repository.
import crypto from 'node:crypto';
import { WorkflowRun } from '../domain/engine.js';
import { badRequest, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

export function createRunService({ config, components, workflows, attachments, runLog, runners, tracker }) {
  const activeRun = (id) => {
    const run = runLog.runs.get(id)?.run;
    if (!run) throw notFound('run tidak aktif di studio ini');
    return run;
  };

  return {
    list: () => runLog.list(),
    events(id) {
      const events = runLog.events(id);
      if (!events) throw notFound('run tidak ada');
      return { id, events };
    },
    start({ workflow, name, input, attachments: attachmentIds }) {
      const { wf, errors } = workflows.resolveForRun({ workflow, name });
      if (errors.length) throw badRequest('workflow belum valid', errors);
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
        throw badRequest(err.message);
      }
      return { approved };
    },
  };
}
