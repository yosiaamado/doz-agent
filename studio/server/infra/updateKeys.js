// Public key penanda tangan manifest update (ed25519) + canonical JSON + verifikasi signature.
// Hanya public key yang boleh ada di file ini. Private key TIDAK PERNAH masuk repo.
import crypto from 'node:crypto';

// Cara mengisi (dilakukan pemilik produk sekali, di mesin sendiri):
//   1. `npm run keygen -- --out <path di LUAR repo>`  → private key ditulis ke file itu (mode 0600),
//      public key (base64 SPKI DER) dicetak ke layar.
//   2. Simpan private key sebagai secret CI (mis. DOZ_UPDATE_SIGNING_KEY) atau di password manager.
//   3. Tempel public key di bawah menggantikan PLACEHOLDER. Rotasi = tambah keyId baru, jangan timpa yang lama
//      sampai semua pembeli sudah memakai app yang mengenal kunci baru.
// Selama masih PLACEHOLDER, semua manifest ditolak dengan UPDATE_SIGNATURE_INVALID (fail closed).
// TODO(release): isi public key nyata sebelum rilis pertama.
export const KEY_PLACEHOLDER = 'MCowBQYDK2VwAyEAb8b8E5kVDyUq8cghj6rdHSH3VfDvo5/zm+tUJaKsrqM=';

export const PUBLIC_KEYS = Object.freeze({
  'doz-2026a': KEY_PLACEHOLDER,
});

const ED25519_SIGNATURE_BYTES = 64;

// Kunci objek diurutkan rekursif, tanpa whitespace. Penanda tangan dan verifier harus memakai fungsi yang sama.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function manifestPayload(manifest) {
  const { signature: _signature, ...rest } = manifest;
  return Buffer.from(canonicalJson(rest), 'utf8');
}

// Dipanggil pada objek mentah hasil JSON.parse (bukan hasil zod, yang membuang kunci tak dikenal).
// Mengembalikan false untuk semua kegagalan; tidak pernah melempar.
export function verifyManifestSignature(manifest, keys = PUBLIC_KEYS) {
  try {
    const sig = manifest?.signature;
    if (!sig || typeof sig !== 'object' || sig.alg !== 'ed25519') return false;
    if (typeof sig.keyId !== 'string' || !Object.hasOwn(keys, sig.keyId)) return false;
    const encodedKey = keys[sig.keyId];
    if (typeof encodedKey !== 'string' || encodedKey === KEY_PLACEHOLDER) return false;
    if (typeof sig.value !== 'string') return false;
    const signature = Buffer.from(sig.value, 'base64');
    if (signature.length !== ED25519_SIGNATURE_BYTES) return false;
    const publicKey = crypto.createPublicKey({ key: Buffer.from(encodedKey, 'base64'), format: 'der', type: 'spki' });
    return crypto.verify(null, manifestPayload(manifest), publicKey, signature);
  } catch {
    return false;
  }
}
