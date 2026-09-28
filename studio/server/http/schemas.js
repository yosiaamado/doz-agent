// Skema validasi input API (zod). Semua body dan query divalidasi sebelum masuk service.
import { z } from 'zod';

const shortText = z.string().max(500);
const sha = z.string().regex(/^[0-9a-f]{40,64}$/, 'snapshot tidak valid');

export const workdirBody = z.object({ path: z.string().min(1).max(4096) });

export const sourcesBody = z.object({
  agents: z.array(shortText).optional(),
  skills: z.array(shortText).optional(),
  actions: z.array(shortText).optional(),
  workflows: z.array(shortText).optional(),
});

export const componentKind = z.enum(['agents', 'skills', 'actions']);

export const createComponentBody = z.object({
  name: z.string().min(1).max(64),
  dir: z.string().max(4096).optional(),
  area: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  body: z.string().max(500_000).optional(),
});

export const updateComponentBody = z.union([
  z.object({ text: z.string().min(1).max(500_000) }),
  z.object({ meta: z.record(z.string(), z.unknown()).optional(), body: z.string().max(500_000).optional() }),
]);

const workflowObject = z.object({ nodes: z.array(z.record(z.string(), z.unknown())), edges: z.array(z.unknown()) }).passthrough();

export const saveWorkflowBody = z.object({ workflow: workflowObject });

export const startRunBody = z.object({
  workflow: workflowObject.optional(),
  name: z.string().max(64).optional(),
  input: z.string().max(200_000).default(''),
  attachments: z.array(z.string().regex(/^[a-f0-9]{16}$/)).max(20).default([]),
}).refine((b) => b.workflow || b.name, 'isi workflow atau name');

export const approveBody = z.object({ node: z.string().min(1), approved: z.boolean(), note: z.string().max(5000).default('') });

export const attachmentBody = z.object({ name: z.string().min(1).max(255), contentBase64: z.string().min(1) });

export const diffQuery = z.object({ base: sha, head: sha, file: z.string().max(4096).optional() });

export const folderQuery = z.object({ path: z.string().max(4096).optional() });

export const gitTarget = z.enum(['repo', 'workdir']);

export const commitBody = z.object({
  message: z.string().trim().min(1, 'pesan commit wajib diisi').max(2000),
  files: z.array(z.string().min(1).max(4096)).max(500).optional(),
});
