// SEC-1: rilis tidak boleh lolos CI selama public key update masih placeholder.
// Aktif otomatis di build tag (GITHUB_REF_TYPE=tag) atau DOZ_RELEASE_CHECK=1; di CI biasa dilewati supaya pengembangan tidak merah.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_KEYS, KEY_PLACEHOLDER } from '../server/infra/updateKeys.js';

const placeholderKeyIds = (keys) => Object.entries(keys).filter(([, value]) => value === KEY_PLACEHOLDER).map(([keyId]) => keyId);

const releaseBuild = process.env.GITHUB_REF_TYPE === 'tag' || process.env.DOZ_RELEASE_CHECK === '1';

test('rilis: PUBLIC_KEYS tidak boleh berisi KEY_PLACEHOLDER', { skip: !releaseBuild && 'bukan build rilis (set DOZ_RELEASE_CHECK=1 atau build dari tag)' }, () => {
  assert.deepEqual(placeholderKeyIds(PUBLIC_KEYS), [], 'isi public key nyata di server/infra/updateKeys.js (npm run keygen) sebelum rilis');
  assert.ok(Object.keys(PUBLIC_KEYS).length > 0);
});

test('logika pemeriksaan: mendeteksi placeholder dan menerima key nyata', () => {
  assert.deepEqual(placeholderKeyIds({ 'doz-2026a': KEY_PLACEHOLDER, lain: 'MCowBQYDK2VwAyEA' }), ['doz-2026a']);
  assert.deepEqual(placeholderKeyIds({ 'doz-2026a': 'MCowBQYDK2VwAyEA' }), []);
});
