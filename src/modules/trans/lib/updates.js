// BongChrome: 번역 모듈의 개별 업데이트는 없앴다. 업데이트는 BongChrome 팝업의 "업데이트" 탭에서 한 번에 한다.
// 기존 화면 코드(popup.js, options.js)가 그대로 동작하도록 같은 이름의 함수만 남긴다.
export const UPDATE_PAGE = 'update.html';

export async function checkForUpdate() {
  return { upToDate: true, message: '업데이트는 BongChrome 팝업의 "업데이트" 탭에서 한 번에 합니다.' };
}

export function openExtensionsPage() {
  return chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
}

export function openUpdatePage() {
  return chrome.tabs.create({ url: chrome.runtime.getURL(UPDATE_PAGE) });
}
