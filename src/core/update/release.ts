import {compareVersions} from "@/core/semver";

export const GITHUB_RELEASE_REPO = "Baegovda/BongChrome";
export const EXTENSION_NAME = "BongChrome";
export const RELEASES_LATEST = `https://api.github.com/repos/${GITHUB_RELEASE_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${GITHUB_RELEASE_REPO}/releases`;

export type UpdateBrowserName = "chrome" | "firefox";

export type ReleaseZipAsset = {
    name?: string;
    browser_download_url?: string;
};

export type LatestRelease = {
    upToDate: boolean;
    current: string;
    latest: string;
    htmlUrl: string;
    zipUrl: string;
    assetUrl: string | null;
    message: string;
    releaseNotes: string;
};

export const describeUpdate = (currentVersion: string, latest: string | null | undefined): string => {
    if (!latest) return "최신 릴리스 버전을 읽지 못했습니다.";

    const compared = compareVersions(latest, currentVersion);
    if (compared === null) return "최신 릴리스 버전을 읽지 못했습니다.";
    if (compared <= 0) return `최신 버전입니다. (${currentVersion})`;
    return `${currentVersion} → ${latest} 업데이트 가능`;
};

export const canApplyVersion = (currentVersion: string, nextVersion: string): boolean =>
    compareVersions(nextVersion, currentVersion) === 1;

export const pickReleaseZip = (
    assets: ReleaseZipAsset[] | null | undefined,
    browserName: UpdateBrowserName
): ReleaseZipAsset | null => {
    const list = Array.isArray(assets) ? assets : [];
    return list.find((asset) =>
        String(asset?.name ?? "").endsWith(`-${browserName}.zip`) && Boolean(asset?.browser_download_url)
    ) ?? null;
};

export const isBongChromeManifest = (text: string): boolean => {
    try {
        return JSON.parse(text)?.name === EXTENSION_NAME;
    } catch {
        return false;
    }
};

type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

export const checkLatestRelease = async (
    currentVersion: string,
    browserName: UpdateBrowserName,
    deps: { fetchImpl?: FetchLike; url?: string } = {}
): Promise<LatestRelease> => {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const response = await fetchImpl(deps.url ?? RELEASES_LATEST, {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "BongChrome",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });

    if (!response.ok) {
        const error = new Error(`업데이트 정보를 가져오지 못했습니다. (HTTP ${response.status})`);
        throw error;
    }

    const body = await response.json() as {
        tag_name?: string;
        html_url?: string;
        body?: string | null;
        assets?: ReleaseZipAsset[];
    };
    const latest = String(body?.tag_name || "").replace(/^v/i, "");
    const zip = pickReleaseZip(body?.assets, browserName);
    const htmlUrl = body?.html_url || RELEASES_PAGE;
    const assetUrl = zip?.browser_download_url || null;
    const compared = compareVersions(latest, currentVersion);

    return {
        upToDate: compared !== null && compared <= 0,
        current: currentVersion,
        latest,
        htmlUrl,
        zipUrl: assetUrl || htmlUrl,
        assetUrl,
        message: describeUpdate(currentVersion, latest || null),
        releaseNotes: typeof body?.body === "string" ? body.body : ""
    };
};
