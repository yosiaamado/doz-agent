// Komponen (agent/skill/action) dan workflow.
import { componentKind, createComponentBody, updateComponentBody, saveWorkflowBody } from '../http/schemas.js';

// Isi prompt agent tidak ikut di daftar supaya respons tetap kecil.
const withoutPrompt = ({ prompt, ...rest }) => rest;

export function registerLibraryRoutes(router, { components, workflows }) {
  router
    .get('/api/library/:kind', ({ params }) => components.list(componentKind.parse(params.kind)).map(withoutPrompt))
    .post('/api/library/:kind', ({ params, body }) => components.create(componentKind.parse(params.kind), createComponentBody.parse(body)))
    .get('/api/library/:kind/:name', ({ params }) => components.read(componentKind.parse(params.kind), params.name))
    .put('/api/library/:kind/:name', ({ params, body }) => components.update(componentKind.parse(params.kind), params.name, updateComponentBody.parse(body)))
    .get('/api/workflows', () => workflows.list())
    .get('/api/workflows/:name', ({ params }) => workflows.load(params.name))
    .put('/api/workflows/:name', ({ params, body }) => workflows.save(params.name, saveWorkflowBody.parse(body).workflow));
}
