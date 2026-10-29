import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, checkForUpdate, pickReleaseZip } from '../lib/updates.js';
import { extractChangelog } from '../scripts/extract-changelog.js';
import { readFileSync } from 'node:fs';

test('compareVersions', () => {
  assert.equal(compareVersions('v1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('1.1.0', '1.1.0'), 0);
});
test('zip asset', () => {
  assert.equal(pickReleaseZip([{ name: 'x.txt' }, { name: 'bongchzzk-1.2.0.zip', browser_download_url: 'u' }]).browser_download_url, 'u');
});
test('token header and new version', async () => {
  let headers;
  const r = await checkForUpdate('1.1.0', { token: 't', fetchImpl: async (_u, o) => { headers = o.headers; return { ok: true, json: async () => ({ tag_name: 'v1.2.0', assets: [{ name: 'bongchzzk-1.2.0.zip', browser_download_url: 'z' }] }) }; } });
  assert.equal(headers.Authorization, 'Bearer t');
  assert.equal(r.upToDate, false);
  assert.equal(r.zipUrl, 'z');
});
test('404 hint', async () => {
  await assert.rejects(checkForUpdate('1.1.0', { fetchImpl: async () => ({ ok: false, status: 404 }) }), /토큰/);
});
test('manifest version has changelog', () => {
  const v = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
  assert.match(extractChangelog(readFileSync('CHANGELOG.md', 'utf8'), v), /1\.1\.0/);
});
