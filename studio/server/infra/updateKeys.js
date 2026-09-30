// The public key of the update manifest signer (ed25519) plus canonical JSON and signature verification.
// Only public keys may live in this file. A private key NEVER enters the repo.
import crypto from 'node:crypto';

// How to fill this in (done once by the product owner, on their own machine):
//   1. `npm run keygen -- --out <path OUTSIDE the repo>`  -> the private key is written to that file (mode 0600),
//      and the public key (base64 SPKI DER) is printed to the screen.
//   2. Store the private key as a CI secret (e.g. DOZ_UPDATE_SIGNING_KEY) or in a password manager.
//   3. Paste the public key below in place of PLACEHOLDER. Rotation = add a new keyId; do not overwrite the old one
//      until every buyer is running an app that knows the new key.
// While PLACEHOLDER is still in place, every manifest is rejected with UPDATE_SIGNATURE_INVALID (fail closed).
// TODO(release): fill in the real public key before the first release.
export const KEY_PLACEHOLDER = 'MCowBQYDK2VwAyEAb8b8E5kVDyUq8cghj6rdHSH3VfDvo5/zm+tUJaKsrqM=';

export const PUBLIC_KEYS = Object.freeze({
  'doz-2026a': KEY_PLACEHOLDER,
});

const ED25519_SIGNATURE_BYTES = 64;

// Object keys are sorted recursively, with no whitespace. Signer and verifier must use the same function.
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

// Called on the raw object from JSON.parse (not the zod output, which drops unknown keys).
// Returns false for every failure; never throws.
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
