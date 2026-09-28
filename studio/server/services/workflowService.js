// Membaca dan menyimpan file workflow dari folder sumber `workflows`.
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflow, serializeWorkflow, validateWorkflow, normalize } from '../domain/workflow.js';
import { NAME_RE } from '../repositories/componentRepository.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toPosix } from '../lib/paths.js';

export function createWorkflowService({ config, components }) {
  const agentNames = () => components.list('agents').filter((a) => !a.shadowed).map((a) => a.name);

  const locate = (name, { create = false } = {}) => {
    if (!NAME_RE.test(name ?? '')) throw badRequest('nama workflow hanya boleh huruf, angka, - dan _');
    const existing = components.find('workflows', name);
    if (existing) return existing.path;
    if (!create) throw notFound(`workflow "${name}" tidak ada`);
    return path.join(config.primaryDir('workflows'), `${name}.md`);
  };

  const summarize = (entry) => {
    try {
      const wf = parseWorkflow(fs.readFileSync(entry.path, 'utf8'), entry.name);
      return { name: entry.name, file: entry.file, description: wf.description, nodes: wf.nodes.length };
    } catch (err) {
      return { name: entry.name, file: entry.file, description: `⚠ ${err.message}`, nodes: 0, invalid: true };
    }
  };

  return {
    list: () => components.list('workflows').filter((w) => !w.shadowed).map(summarize),
    load(name) {
      const wf = parseWorkflow(fs.readFileSync(locate(name), 'utf8'), name);
      return { workflow: wf, errors: validateWorkflow(wf, agentNames()) };
    },
    save(name, workflow) {
      const file = locate(name, { create: true });
      const wf = normalize({ ...workflow, name }, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, serializeWorkflow(wf));
      return { workflow: wf, errors: validateWorkflow(wf, agentNames()), file: toPosix(path.relative(config.repoRoot, file)) };
    },
    // Workflow siap jalan: dari body (versi di canvas) atau dari file.
    resolveForRun({ workflow, name }) {
      const wf = workflow ? normalize(workflow) : parseWorkflow(fs.readFileSync(locate(name), 'utf8'), name);
      return { wf, errors: validateWorkflow(wf, agentNames()) };
    },
  };
}
