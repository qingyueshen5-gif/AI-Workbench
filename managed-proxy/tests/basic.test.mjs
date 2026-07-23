import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('worker source does not allow client upstream override', () => {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.equal(/upstreamUrl|base_url|baseUrlOverride|providerUrl/.test(source), false);
});

test('schema contains required tables', () => {
  const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  for (const table of ['installations', 'daily_usage', 'revoked_tokens']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});
