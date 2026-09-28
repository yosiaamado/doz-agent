// Lampiran dokumen untuk permintaan run. Disimpan di <workdir>/.doz-studio/attachments/<id>/.
// Teks (md, txt, kode, csv, json, docx) disisipkan ke prompt; PDF/gambar dirujuk lewat path supaya
// agent membacanya dengan tool Read (Claude Code bisa membaca PDF dan gambar).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { badRequest, notFound } from '../lib/errors.js';
import { toPosix } from '../lib/paths.js';

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_INLINE_CHARS = 40_000;
const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
  '.js', '.jsx', '.ts', '.tsx', '.py', '.cs', '.java', '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.css', '.scss', '.env.example', '.log', '.ini', '.toml']);
const ID_RE = /^[a-f0-9]{16}$/;

function safeName(name) {
  const base = path.basename(String(name ?? 'dokumen')).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return base || 'dokumen';
}

function decodeXml(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function docxToText(buffer) {
  const files = unzipSync(new Uint8Array(buffer), { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('bukan file docx yang valid');
  const text = strFromU8(xml)
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>|<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeXml(text).replace(/\n{3,}/g, '\n\n').trim();
}

export function extractText(name, buffer) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.docx') return { kind: 'docx', text: docxToText(buffer) };
  if (TEXT_EXT.has(ext)) return { kind: 'text', text: buffer.toString('utf8') };
  if (ext === '.pdf') return { kind: 'pdf', text: null };
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return { kind: 'image', text: null };
  throw badRequest(`Tipe file ${ext || '(tanpa ekstensi)'} belum didukung. Pakai md, txt, docx, pdf, gambar, atau file kode.`);
}

export function createAttachmentService(config) {
  const dirOf = (id) => {
    if (!ID_RE.test(id)) throw badRequest('id lampiran tidak valid');
    return path.join(config.attachmentsDir(), id);
  };

  const save = ({ name, contentBase64 }) => {
    const buffer = Buffer.from(String(contentBase64 ?? ''), 'base64');
    if (!buffer.length) throw badRequest('file kosong');
    if (buffer.length > MAX_BYTES) throw badRequest('file lebih dari 15 MB');
    const fileName = safeName(name);
    const { kind, text } = extractText(fileName, buffer);
    const id = crypto.randomBytes(8).toString('hex');
    const dir = dirOf(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), buffer);
    const meta = { id, name: fileName, kind, size: buffer.length, chars: text?.length ?? 0 };
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
    if (text !== null) fs.writeFileSync(path.join(dir, 'text.txt'), text);
    return { ...meta, preview: text ? text.slice(0, 400) : null };
  };

  const load = (id) => {
    const dir = dirOf(id);
    const metaFile = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaFile)) throw notFound(`lampiran ${id} tidak ada`);
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const textFile = path.join(dir, 'text.txt');
    const text = fs.existsSync(textFile) ? fs.readFileSync(textFile, 'utf8') : null;
    const rel = toPosix(path.relative(config.getWorkdir(), path.join(dir, meta.name)));
    return { ...meta, text, relPath: rel };
  };

  const section = (doc) => {
    if (!doc.text) return `### ${doc.name}\nFile ${doc.kind} di \`${doc.relPath}\`. Baca dengan tool Read sebelum mengerjakan.`;
    const clipped = doc.text.length > MAX_INLINE_CHARS
      ? `${doc.text.slice(0, MAX_INLINE_CHARS)}\n\n[... dipotong; isi lengkap di \`${doc.relPath}\`]`
      : doc.text;
    return `### ${doc.name}\n\`\`\`\n${clipped}\n\`\`\``;
  };

  // Permintaan user + dokumen terlampir, jadi input node start.
  const composeInput = (input, ids = []) => {
    if (!ids.length) return input;
    const docs = ids.map(load);
    return `${input}\n\n## Dokumen terlampir\n\n${docs.map(section).join('\n\n')}`;
  };

  return { save, load, composeInput };
}
