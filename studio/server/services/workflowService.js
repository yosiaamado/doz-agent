// Reads and saves workflow files from the `workflows` source folder.
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflow, serializeWorkflow, validateWorkflow, normalize } from '../domain/workflow.js';
import { NAME_RE } from '../repositories/componentRepository.js';
import { badRequest, notFound } from '../lib/errors.js';
import { displayPath } from '../lib/paths.js';

export function createWorkflowService({ config, components }) {
  const agentNames = () => components.list('agents').filter((a) => !a.shadowed).map((a) => a.name);

  const locate = (name, { create = false } = {}) => {
    if (!NAME_RE.test(name ?? '')) throw badRequest('The workflow name may only contain letters, digits, - and _', { code: 'NAME_INVALID' });
    const existing = components.find('workflows', name);
    if (existing) return existing.path;
    if (!create) throw notFound(`Workflow "${name}" not found`, { code: 'WORKFLOW_NOT_FOUND', params: { name: String(name).slice(0, 100) } });
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
      return { workflow: wf, errors: validateWorkflow(wf, agentNames()), file: displayPath(file, { workdir: config.getWorkdir(), repoRoot: config.repoRoot }) };
    },
    // The workflow that is ready to run: either from the body (the version on the canvas) or from the file.
    resolveForRun({ workflow, name }) {
      const wf = workflow ? normalize(workflow) : parseWorkflow(fs.readFileSync(locate(name), 'utf8'), name);
      return { wf, errors: validateWorkflow(wf, agentNames()) };
    },
  };
}
