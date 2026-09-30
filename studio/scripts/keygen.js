// Generates an ed25519 key pair for signing update manifests. Run by the product owner, on their own machine.
// Usage: npm run keygen -- --out <private key file OUTSIDE the repo>
// The public key (base64 SPKI DER) is printed to the screen so it can be pasted into server/infra/updateKeys.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--out');
const out = i > -1 ? process.argv[i + 1] : undefined;

if (!out) {
  console.error('Usage: npm run keygen -- --out <private key file outside the repo>');
  process.exit(1);
}
const target = path.resolve(out);
if (target === repoRoot || target.startsWith(repoRoot + path.sep)) {
  console.error(`Rejected: the private key must not be stored inside the repo (${repoRoot}). Pick another folder.`);
  process.exit(1);
}
if (fs.existsSync(target)) {
  console.error(`Rejected: ${target} already exists. Delete it or pick another name; an existing key must never be overwritten.`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
console.log(`Private key written to: ${target}  (do not commit it; store it as a CI secret)`);
console.log('Public key (paste into PUBLIC_KEYS in server/infra/updateKeys.js):');
console.log(publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
