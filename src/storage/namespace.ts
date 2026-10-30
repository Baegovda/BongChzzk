// BongChrome 저장소 구역
// - 디시(BongDC) 모듈: 기존 키 그대로 `refresher:*` (옛 BongDC 내보내기 파일을 그대로 가져올 수 있게 유지)
// - 치지직 모듈: `chzzk.*` (sync/local)
// - 번역 모듈: `trans.*` (local)
// - 공통: `core.*`
export const OTHER_MODULE_PREFIXES = ["chzzk.", "trans.", "core."] as const;

export const isOtherModuleKey = (key: string): boolean =>
    OTHER_MODULE_PREFIXES.some((prefix) => key.startsWith(prefix));

export const onlyDcKeys = <T>(data: Record<string, T>): Record<string, T> => {
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(data ?? {})) {
        if (!isOtherModuleKey(key)) result[key] = value;
    }
    return result;
};
