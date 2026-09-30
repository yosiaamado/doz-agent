// SEC-1: a release must not pass CI while the update public key is still a placeholder.
// Enabled automatically on a tag build (GITHUB_REF_TYPE=tag) or with DOZ_RELEASE_CHECK=1; skipped in ordinary CI so development does not go red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_KEYS, KEY_PLACEHOLDER } from '../server/infra/updateKeys.js';

const placeholderKeyIds = (keys) => Object.entries(keys).filter(([, value]) => value === KEY_PLACEHOLDER).map(([keyId]) => keyId);

const releaseBuild = process.env.GITHUB_REF_TYPE === 'tag' || process.env.DOZ_RELEASE_CHECK === '1';

test('release: PUBLIC_KEYS must not contain KEY_PLACEHOLDER', { skip: !releaseBuild && 'not a release build (set DOZ_RELEASE_CHECK=1 or build from a tag)' }, () => {
  assert.deepEqual(placeholderKeyIds(PUBLIC_KEYS), [], 'fill in the real public key in server/infra/updateKeys.js (npm run keygen) before releasing');
  assert.ok(Object.keys(PUBLIC_KEYS).length > 0);
});

test('the check logic: detects a placeholder and accepts a real key', () => {
  assert.deepEqual(placeholderKeyIds({ 'doz-2026a': KEY_PLACEHOLDER, other: 'MCowBQYDK2VwAyEA' }), ['doz-2026a']);
  assert.deepEqual(placeholderKeyIds({ 'doz-2026a': 'MCowBQYDK2VwAyEA' }), []);
});
