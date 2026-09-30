// Membuat pasangan kunci ed25519 untuk menandatangani manifest update. Dijalankan pemilik produk, di mesinnya sendiri.
// Pemakaian: npm run keygen -- --out <file private key di LUAR repo>
// Public key (base64 SPKI DER) dicetak ke layar untuk ditempel di server/infra/updateKeys.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--out');
const out = i > -1 ? process.argv[i + 1] : undefined;

if (!out) {
  console.error('Pakai: npm run keygen -- --out <file private key di luar repo>');
  process.exit(1);
}
const target = path.resolve(out);
if (target === repoRoot || target.startsWith(repoRoot + path.sep)) {
  console.error(`Ditolak: private key tidak boleh disimpan di dalam repo (${repoRoot}). Pilih folder lain.`);
  process.exit(1);
}
if (fs.existsSync(target)) {
  console.error(`Ditolak: ${target} sudah ada. Hapus atau pilih nama lain; kunci lama tidak boleh tertimpa.`);
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600, flag: 'wx' });
console.log(`Private key ditulis ke: ${target}  (jangan commit; simpan sebagai secret CI)`);
console.log('Public key (tempel di PUBLIC_KEYS di server/infra/updateKeys.js):');
console.log(publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
