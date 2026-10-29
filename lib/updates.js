export const RELEASES_LATEST = 'https://api.github.com/repos/Baegovda/BongChzzk/releases/latest';
export const RELEASES_PAGE = 'https://github.com/Baegovda/BongChzzk/releases';

export function parseVersion(value) {
  const match = String(value || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function describeUpdate(currentVersion, latest) {
  if (!latest) return '최신 릴리스 버전을 읽지 못했습니다.';
  if (compareVersions(latest, currentVersion) <= 0) {
    return `최신 버전입니다. (${currentVersion})`;
  }
  return `새 버전 ${latest} 사용 가능`;
}

export async function checkForUpdate(currentVersion, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const response = await fetchImpl(deps.url || RELEASES_LATEST, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'BongChzzk',
      ...(deps.token ? { Authorization: `Bearer ${deps.token}` } : {}),
    },
  });
  if (!response.ok) {
    const hint = (response.status === 404 || response.status === 401)
      ? (deps.token ? ' 토큰 권한(Contents: Read)을 확인해 주세요.' : ' 비공개 저장소라면 GitHub 토큰을 입력해 주세요.')
      : '';
    const error = new Error(`업데이트 정보를 가져오지 못했습니다. (HTTP ${response.status})${hint}`);
    error.code = 'UPDATE_CHECK_FAILED';
    throw error;
  }
  const body = typeof response.json === 'function' ? await response.json() : null;
  const latest = String(body?.tag_name || '').replace(/^v/i, '');
  const assets = Array.isArray(body?.assets) ? body.assets : [];
  const zip = pickReleaseZip(assets);
  const htmlUrl = body?.html_url || RELEASES_PAGE;
  return {
    upToDate: compareVersions(latest, currentVersion) <= 0,
    current: currentVersion,
    latest,
    htmlUrl,
    zipUrl: zip?.browser_download_url || htmlUrl,
    message: describeUpdate(currentVersion, latest),
  };
}

export const TOKEN_KEY = 'githubToken';

export function pickReleaseZip(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const named = (pattern) => list.find((asset) => pattern.test(String(asset?.name || '')));
  return named(/^bongchzzk-.*\.zip$/i)
    || list.find((asset) => String(asset?.name || '').endsWith('.zip'))
    || null;
}

export function extensionsPageUrl(extensionId) {
  return `chrome://extensions/?id=${extensionId}`;
}

export function openExtensionsPage() {
  return chrome.tabs.create({ url: extensionsPageUrl(chrome.runtime.id) });
}
