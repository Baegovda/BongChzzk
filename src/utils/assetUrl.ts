// WXT의 browser.runtime.getURL 은 공개 파일 경로만 받는다.
// `?no-inline` 으로 가져온 아이콘 경로는 문자열이라, 동작은 그대로 두고 타입만 맞춘다.
export const assetUrl = (path: string): string =>
    (browser.runtime.getURL as (path: string) => string)(path);
