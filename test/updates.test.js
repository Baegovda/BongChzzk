import test from 'node:test';
import assert from 'node:assert/strict';
import { isBongManifest, compareVersions, checkForUpdate, pickReleaseZip } from '../lib/updates.js';
import { extractChangelog } from '../scripts/extract-changelog.js';
import { readFileSync } from 'node:fs';

test('compareVersions', () => {
  assert.equal(compareVersions('v1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('1.1.0', '1.1.0'), 0);
});
test('zip asset', () => {
  assert.equal(pickReleaseZip([{ name: 'x.txt' }, { name: 'bongchzzk-1.2.0.zip', browser_download_url: 'u' }]).browser_download_url, 'u');
});
test('headers and new version', async () => {
  let headers;
  const r = await checkForUpdate('1.1.0', { fetchImpl: async (_u, o) => { headers = o.headers; return { ok: true, json: async () => ({ tag_name: 'v1.2.0', assets: [{ name: 'bongchzzk-1.2.0.zip', browser_download_url: 'z' }] }) }; } });
  assert.equal(headers.Authorization, undefined);
  assert.equal(r.upToDate, false);
  assert.equal(r.zipUrl, 'z');
  assert.equal(r.assetUrl, 'z');
});
test('404 error', async () => {
  await assert.rejects(checkForUpdate('1.1.0', { fetchImpl: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
});
test('manifest version has changelog', () => {
  const v = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
  assert.match(extractChangelog(readFileSync('CHANGELOG.md', 'utf8'), v), /manifest/);
});
test('isBongManifest', () => {
  assert.equal(isBongManifest('{"name":"BongChzzk"}'), true);
  assert.equal(isBongManifest('{"name":"Other"}'), false);
  assert.equal(isBongManifest('nope'), false);
});
