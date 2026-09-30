// The update manifest: canonical JSON, the ed25519 signature, the schema, minAppVersion, the HTTPS endpoint, and network failures.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, verifyManifestSignature, PUBLIC_KEYS, KEY_PLACEHOLDER } from '../server/infra/updateKeys.js';
import { compareVersions, validateEndpoint, DEFAULT_UPDATE_ENDPOINT } from '../server/infra/updateConfig.js';
import { buildManifest, sign, makeKeys, makeEnvironment, startPayloadServer, rejectsWith } from './updateFixture.js';

let srv;
before(async () => { srv = await startPayloadServer(); });
after(() => srv.close());

const file = (p = 'plugins/agents/a.md', content = 'hello') => ({ path: p, target: 'plugins', content });

test('canonicalJson is stable against key order, and array order is preserved', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } }), canonicalJson({ a: { c: 'x', d: [3, 1] }, b: 1 }));
  assert.equal(canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } }), '{"a":{"c":"x","d":[3,1]},"b":1}');
  assert.notEqual(canonicalJson({ a: [1, 2] }), canonicalJson({ a: [2, 1] }));
  assert.equal(canonicalJson({ a: undefined, b: null }), '{"b":null}');
});

test('signature: a valid one passes; a tampered manifest, a foreign keyId, the wrong alg, or no signature → rejected', () => {
  const { privateKey, keys } = makeKeys();
  const base = { schema: 1, contentVersion: '1.0.0', files: [{ path: 'a', sha256: 'x' }] };
  const signed = sign(base, privateKey);
  assert.equal(verifyManifestSignature(signed, keys), true);
  assert.equal(verifyManifestSignature({ ...signed, contentVersion: '9.9.9' }, keys), false);
  assert.equal(verifyManifestSignature({ ...signed, files: [{ path: 'b', sha256: 'x' }] }, keys), false);
  assert.equal(verifyManifestSignature({ ...signed, signature: { ...signed.signature, keyId: 'other' } }, keys), false);
  assert.equal(verifyManifestSignature({ ...signed, signature: { ...signed.signature, alg: 'rsa' } }, keys), false);
  assert.equal(verifyManifestSignature(base, keys), false);
  assert.equal(verifyManifestSignature({ ...signed, signature: { ...signed.signature, value: 'not-base64!!' } }, keys), false);
  const other = makeKeys();
  assert.equal(verifyManifestSignature(signed, other.keys), false, 'a different public key');
  assert.equal(verifyManifestSignature({ ...signed, signature: { ...signed.signature, keyId: '__proto__' } }, keys), false);
});

test('the built-in key is still a placeholder → every manifest is rejected (fail closed)', () => {
  assert.ok(Object.values(PUBLIC_KEYS).every((k) => k === KEY_PLACEHOLDER || typeof k === 'string'));
  const { privateKey } = makeKeys();
  assert.equal(verifyManifestSignature(sign({ schema: 1 }, privateKey, 'doz-2026a')), false);
});

test('version: semver comparison', () => {
  assert.equal(compareVersions('1.21.0', '1.20.0'), 1);
  assert.equal(compareVersions('1.9.0', '1.10.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0-beta', '1.0.0'), -1);
});

test('endpoint: https only; http only for loopback + DOZ_UPDATE_ALLOW_HTTP=1', () => {
  assert.equal(validateEndpoint(DEFAULT_UPDATE_ENDPOINT, {}), DEFAULT_UPDATE_ENDPOINT);
  for (const bad of ['http://example.com/x.json', 'ftp://x/y', 'file:///etc/passwd', 'not a url', '', 'https://user:pw@example.com/x.json']) {
    assert.throws(() => validateEndpoint(bad, {}), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT' && e.status === 400, bad);
  }
  assert.throws(() => validateEndpoint('http://127.0.0.1:1/x.json', {}), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT');
  // SEC-6: the flag alone is not enough in a production build (no test runtime marker)
  assert.throws(() => validateEndpoint('http://127.0.0.1:1/x.json', { DOZ_UPDATE_ALLOW_HTTP: '1' }), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT');
  assert.throws(() => validateEndpoint('http://127.0.0.1:1/x.json', { DOZ_UPDATE_ALLOW_HTTP: '1', NODE_ENV: 'production' }), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT');
  assert.throws(() => validateEndpoint('http://example.com/x.json', { DOZ_UPDATE_ALLOW_HTTP: '1' }), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT');
  assert.equal(validateEndpoint('http://127.0.0.1:1/x.json', { DOZ_UPDATE_ALLOW_HTTP: '1', NODE_ENV: 'test' }), 'http://127.0.0.1:1/x.json');
  assert.equal(validateEndpoint('http://localhost:1/x.json', { DOZ_UPDATE_ALLOW_HTTP: '1', NODE_TEST_CONTEXT: 'child-v8' }), 'http://localhost:1/x.json');
});

test('check: a valid manifest → updateAvailable true with the release notes, and no payload downloaded', async () => {
  const env = makeEnvironment();
  const files = [file()];
  srv.publish({ manifest: buildManifest({ base: srv.base, files }), files, privateKey: env.privateKey });
  srv.hits.length = 0;
  const data = await env.service.check({ endpoint: `${srv.base}/doz-update.json` });
  assert.equal(data.updateAvailable, true);
  assert.equal(data.currentContentVersion, env.config.appVersion);
  assert.equal(data.contentVersion, '1.21.0');
  assert.equal(data.notes.en, '- change');
  assert.equal(data.fileCount, 1);
  assert.deepEqual(srv.hits, ['/doz-update.json']);
  assert.equal(env.service.status().lastResult, 'available');
  assert.equal(env.service.status().endpointIsDefault, true, 'a one-off override is not persisted');
});

test('check: the version equals the installed one → updateAvailable false', async () => {
  const env = makeEnvironment();
  const files = [file()];
  srv.publish({ manifest: buildManifest({ version: env.config.appVersion, base: srv.base, files }), files, privateKey: env.privateKey });
  const data = await env.service.check({ endpoint: `${srv.base}/doz-update.json` });
  assert.equal(data.updateAvailable, false);
  assert.equal(env.service.status().available, null);
});

test('check: the wrong schema → UPDATE_SCHEMA_UNSUPPORTED (before the signature)', async () => {
  const env = makeEnvironment();
  srv.set('/s2.json', JSON.stringify({ schema: 2, version: '2.0.0' }));
  const e = await rejectsWith(env.service.check({ endpoint: `${srv.base}/s2.json` }), 'UPDATE_SCHEMA_UNSUPPORTED', 422);
  assert.equal(e.params.schema, 2);
});

test('check: a wrong / missing / tampered signature → UPDATE_SIGNATURE_INVALID and no payload downloaded', async () => {
  const env = makeEnvironment();
  const files = [file()];
  const manifest = buildManifest({ base: srv.base, files });
  const stranger = makeKeys();
  srv.set('/bad-key.json', JSON.stringify(sign(manifest, stranger.privateKey)));
  srv.set('/unsigned.json', JSON.stringify(manifest));
  srv.set('/tampered.json', JSON.stringify({ ...sign(manifest, env.privateKey), contentVersion: '9.9.9' }));
  srv.hits.length = 0;
  for (const p of ['/bad-key.json', '/unsigned.json', '/tampered.json']) {
    await rejectsWith(env.service.check({ endpoint: `${srv.base}${p}` }), 'UPDATE_SIGNATURE_INVALID', 422);
  }
  assert.ok(srv.hits.every((h) => h.endsWith('.json')), 'no request went to /payload');
});

test('check: a minAppVersion higher than the app → UPDATE_REQUIRES_NEW_APP', async () => {
  const env = makeEnvironment();
  const files = [file()];
  srv.publish({ manifest: buildManifest({ base: srv.base, files, extra: { minAppVersion: '99.0.0' } }), files, privateKey: env.privateKey });
  const e = await rejectsWith(env.service.check({ endpoint: `${srv.base}/doz-update.json` }), 'UPDATE_REQUIRES_NEW_APP', 422);
  assert.equal(e.params.minAppVersion, '99.0.0');
});

test('check: a manifest that is not JSON, a corrupt sha256, empty files, too large → the matching code', async () => {
  const env = makeEnvironment();
  const files = [file()];
  const manifest = buildManifest({ base: srv.base, files });
  const signedBroken = (patch) => JSON.stringify(sign({ ...manifest, ...patch }, env.privateKey));
  srv.set('/notjson.json', 'not json');
  srv.set('/badsha.json', signedBroken({ files: [{ ...manifest.files[0], sha256: 'XYZ' }] }));
  srv.set('/nofiles.json', signedBroken({ files: [] }));
  srv.set('/dupe.json', signedBroken({ files: [manifest.files[0], manifest.files[0]] }));
  srv.set('/huge.json', 'x'.repeat(1024 * 1024 + 10));
  srv.set('/bigfile.json', signedBroken({ files: [{ ...manifest.files[0], size: 21 * 1024 * 1024 }] }));
  const total = Array.from({ length: 5 }, (_, i) => ({ ...manifest.files[0], path: `plugins/agents/f${i}.md`, size: 19 * 1024 * 1024 }));
  srv.set('/total.json', signedBroken({ files: total }));
  const at = (p) => env.service.check({ endpoint: `${srv.base}${p}` });
  await rejectsWith(at('/notjson.json'), 'UPDATE_MANIFEST_INVALID', 422);
  const e = await rejectsWith(at('/badsha.json'), 'UPDATE_MANIFEST_INVALID', 422);
  assert.ok(e.details.some((d) => d.startsWith('files.0.sha256')));
  await rejectsWith(at('/nofiles.json'), 'UPDATE_MANIFEST_INVALID', 422);
  await rejectsWith(at('/dupe.json'), 'UPDATE_MANIFEST_INVALID', 422);
  await rejectsWith(at('/huge.json'), 'UPDATE_MANIFEST_TOO_LARGE', 422);
  await rejectsWith(at('/bigfile.json'), 'UPDATE_MANIFEST_INVALID', 422);
  await rejectsWith(at('/total.json'), 'UPDATE_MANIFEST_TOO_LARGE', 422);
});

test('check: the endpoint returns 404, 500, no server at all, or redirects to a foreign http → UPDATE_UNREACHABLE; the state stays healthy', async () => {
  const env = makeEnvironment();
  srv.set('/e500.json', 'boom', { status: 500 });
  srv.set('/redir.json', '', { status: 302, headers: { location: 'http://example.com/x.json' } });
  const e404 = await rejectsWith(env.service.check({ endpoint: `${srv.base}/does-not-exist.json` }), 'UPDATE_UNREACHABLE', 503);
  assert.equal(e404.params.status, 404);
  const e500 = await rejectsWith(env.service.check({ endpoint: `${srv.base}/e500.json` }), 'UPDATE_UNREACHABLE', 503);
  assert.equal(e500.params.status, 500);
  await rejectsWith(env.service.check({ endpoint: `${srv.base}/redir.json` }), 'UPDATE_UNREACHABLE', 503);
  await rejectsWith(env.service.check({ endpoint: 'http://127.0.0.1:1/x.json' }), 'UPDATE_UNREACHABLE', 503);
  const status = env.service.status();
  assert.equal(status.lastResult, 'error');
  assert.equal(status.applying, false);
});

test('settings: the endpoint can be changed, http is rejected, and null returns to the default', () => {
  const env = makeEnvironment();
  assert.equal(env.service.getSettings().endpointIsDefault, true);
  const set = env.service.setSettings({ endpoint: 'https://example.com/doz-update.json' });
  assert.deepEqual(set, { endpoint: 'https://example.com/doz-update.json', endpointIsDefault: false });
  assert.equal(env.service.status().endpoint, 'https://example.com/doz-update.json');
  assert.throws(() => env.service.setSettings({ endpoint: 'http://example.com/x.json' }), (e) => e.code === 'UPDATE_INSECURE_ENDPOINT');
  assert.equal(env.service.getSettings().endpoint, 'https://example.com/doz-update.json', 'the previous value is unchanged after a failure');
  assert.deepEqual(env.service.setSettings({ endpoint: null }), { endpoint: DEFAULT_UPDATE_ENDPOINT, endpointIsDefault: true });
});
