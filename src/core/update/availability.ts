import {compareVersions} from "@/core/semver";

const norm = (v: string | undefined | null): string => (v ?? "").trim().replace(/^v/i, "");

// 저장된 "업데이트 가능" 표시는 예전 버전에서 확인한 결과일 수 있다.
// 최신 버전이 지금 설치된 버전보다 높을 때만 업데이트 가능으로 본다.
export const deriveUpdateAvailable = (
    stored: boolean | undefined | null,
    latestVersion: string | undefined | null,
    currentVersion: string | undefined | null
): boolean => {
    if (!stored) return false;
    return compareVersions(norm(latestVersion), norm(currentVersion)) === 1;
};

export const isNewerVersion = (latestVersion: string | undefined | null, currentVersion: string | undefined | null): boolean =>
    compareVersions(norm(latestVersion), norm(currentVersion)) === 1;
