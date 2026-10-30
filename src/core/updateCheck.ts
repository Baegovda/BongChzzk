import {updateStorage} from "@/storage/wxtStorage";
import {compareVersions, parseSemver} from "@/core/semver";
import {GITHUB_RELEASE_REPO, pickReleaseZip} from "@/core/update/release";
import {deriveUpdateAvailable} from "@/core/update/availability";

// 하루 한 번 최신 릴리스를 확인한다.
// 크롬 압축 해제 설치는 업데이트 탭에서 폴더에 바로 넣고, 그 외에는 zip을 받아 덮어쓴다.

export {GITHUB_RELEASE_REPO};
export const UPDATE_ALARM_NAME = "refresher-update-check";
export const UPDATE_CHECK_INTERVAL_MINUTES = 24 * 60;
export const UPDATE_NOTIFICATION_ID = "refresher-update-available";

const RELEASE_NOTES_LIMIT = 400;
const CHECK_INTERVAL_MS = UPDATE_CHECK_INTERVAL_MINUTES * 60_000;
const CHECK_INTERVAL_SLACK_MS = 5 * 60_000;

export type UpdateBrowser = "chrome" | "firefox";

export type ExtensionUpdateStatus = {
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    downloadUrl: string;
    downloadFilename: string;
    releaseNotes: string;
    releaseUrl: string;
    lastCheckedAt: number;
    error: string;
    autoCheck: boolean;
    browser: UpdateBrowser;
};

export type UpdateApplyResult = {
    ok: boolean;
    via?: "download" | "tab";
    error?: string;
};

type GitHubReleaseAsset = {
    name: string;
    browser_download_url: string;
};

type GitHubReleaseResponse = {
    tag_name?: string;
    html_url?: string;
    body?: string | null;
    assets?: GitHubReleaseAsset[];
    message?: string;
};

class UpdateCheckError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UpdateCheckError";
    }
}

export const getUpdateBrowser = (): UpdateBrowser => (import.meta.env.FIREFOX ? "firefox" : "chrome");

const normalizeVersion = (version: string): string => version.trim().replace(/^v/i, "");

const briefReleaseNotes = (body: string): string => {
    const text = body.replace(/\r\n/g, "\n").trim();
    if (text.length <= RELEASE_NOTES_LIMIT) return text;
    return `${text.slice(0, RELEASE_NOTES_LIMIT).trimEnd()}…`;
};

const findAssetUrl = (assets: GitHubReleaseAsset[], browserName: UpdateBrowser): string =>
    pickReleaseZip(assets, browserName)?.browser_download_url ?? "";

const filenameFromUrl = (url: string, fallback: string): string => {
    try {
        const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
        if (name.toLowerCase().endsWith(".zip")) return name;
    } catch {
        // 주소에서 파일 이름을 얻지 못하면 기본 이름을 쓴다.
    }

    return fallback;
};

const readReleasePayload = async (response: Response): Promise<GitHubReleaseResponse | null> => {
    try {
        return (await response.json()) as GitHubReleaseResponse;
    } catch {
        return null;
    }
};

const fetchLatestRelease = async () => {
    let response: Response;

    try {
        response = await fetch(`https://api.github.com/repos/${GITHUB_RELEASE_REPO}/releases/latest`, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "BongExtend",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        });
    } catch {
        throw new UpdateCheckError("네트워크에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.");
    }

    const payload = await readReleasePayload(response);

    if (response.status === 404) {
        throw new UpdateCheckError("공개된 릴리스가 없어요.");
    }

    if (!response.ok) {
        const message = payload?.message ?? "";
        const remaining = response.headers.get("x-ratelimit-remaining");
        const rateLimited = response.status === 429
            || remaining === "0"
            || /rate limit/i.test(message);

        if (rateLimited) {
            throw new UpdateCheckError("GitHub API 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.");
        }

        throw new UpdateCheckError(`GitHub 릴리스 조회에 실패했어요 (${response.status}).`);
    }

    const version = normalizeVersion(payload?.tag_name ?? "");
    if (!parseSemver(version)) {
        throw new UpdateCheckError(payload?.tag_name
            ? "릴리스 버전 형식을 읽을 수 없어요."
            : "릴리스 정보를 읽지 못했어요.");
    }

    const assets = payload?.assets ?? [];

    return {
        version,
        chromeDownloadUrl: findAssetUrl(assets, "chrome"),
        firefoxDownloadUrl: findAssetUrl(assets, "firefox"),
        releaseUrl: payload?.html_url || `https://github.com/${GITHUB_RELEASE_REPO}/releases/latest`,
        releaseNotes: briefReleaseNotes(payload?.body ?? "")
    };
};

const badgeApi = () => (import.meta.env.FIREFOX ? browser.browserAction : browser.action);

const syncUpdateBadge = async (updateAvailable: boolean) => {
    const api = badgeApi();

    try {
        await api.setBadgeText({text: updateAvailable ? "NEW" : ""});
        if (!updateAvailable) return;
        await api.setBadgeBackgroundColor({color: "#3b5bdb"});
    } catch (error) {
        console.error("업데이트 배지 표시 실패:", error);
        return;
    }

    if (import.meta.env.FIREFOX) return;

    try {
        await browser.action.setBadgeTextColor({color: "#ffffff"});
    } catch {
        // 배지 글자색을 지원하지 않는 브라우저는 건너뛴다.
    }
};

const publishAvailability = async (updateAvailable: boolean, notify: boolean, version: string) => {
    await syncUpdateBadge(updateAvailable);

    if (!updateAvailable) {
        try {
            await browser.notifications.clear(UPDATE_NOTIFICATION_ID);
        } catch {
            // 지울 알림이 없으면 무시한다.
        }
        return;
    }

    if (!notify) return;

    try {
        await browser.notifications.create(UPDATE_NOTIFICATION_ID, {
            type: "basic",
            iconUrl: browser.runtime.getURL("/icons/128.png"),
            title: "BongExtend 업데이트",
            message: `새 버전 ${version}이 있어요. 설정에서 받을 수 있어요.`
        });
    } catch (error) {
        console.error("업데이트 알림 표시 실패:", error);
    }
};

const buildStatus = async (currentVersion = getCurrentExtensionVersion()): Promise<ExtensionUpdateStatus> => {
    const browserName = getUpdateBrowser();
    const [
        latestVersion,
        storedUpdateAvailable,
        chromeDownloadUrl,
        firefoxDownloadUrl,
        releaseNotes,
        releaseUrl,
        lastCheckedAt,
        storedError,
        autoCheck
    ] = await Promise.all([
        updateStorage.latestVersion.getValue(),
        updateStorage.updateAvailable.getValue(),
        updateStorage.chromeDownloadUrl.getValue(),
        updateStorage.firefoxDownloadUrl.getValue(),
        updateStorage.releaseNotes.getValue(),
        updateStorage.releaseUrl.getValue(),
        updateStorage.lastCheck.getValue(),
        updateStorage.checkError.getValue(),
        updateStorage.autoCheck.getValue()
    ]);

    const downloadUrl = browserName === "firefox" ? firefoxDownloadUrl : chromeDownloadUrl;
    const updateAvailable = deriveUpdateAvailable(storedUpdateAvailable, latestVersion, currentVersion);
    let error = storedError;

    if (storedUpdateAvailable && !updateAvailable) {
        // 예전 버전에서 저장된 "업데이트 가능" 표시를 바로잡는다.
        error = "";
        try {
            await Promise.all([
                updateStorage.updateAvailable.setValue(false),
                updateStorage.checkError.setValue("")
            ]);
        } catch {
            // 저장 실패는 다음 확인 때 다시 고친다.
        }
    }

    return {
        currentVersion: normalizeVersion(currentVersion),
        latestVersion,
        updateAvailable,
        downloadUrl,
        downloadFilename: downloadUrl
            ? filenameFromUrl(downloadUrl, `bongextend-${latestVersion}-${browserName}.zip`)
            : "",
        releaseNotes,
        releaseUrl,
        lastCheckedAt,
        error,
        autoCheck,
        browser: browserName
    };
};

export const getCurrentExtensionVersion = (): string => browser.runtime.getManifest().version;

export const getExtensionUpdateStatus = async (): Promise<ExtensionUpdateStatus> => {
    const status = await buildStatus();
    await syncUpdateBadge(status.updateAvailable);
    return status;
};

const missingAssetMessage = (browserName: UpdateBrowser): string =>
    browserName === "firefox"
        ? "Firefox용 설치 파일(*-firefox.zip)을 찾지 못했어요."
        : "Chrome용 설치 파일(*-chrome.zip)을 찾지 못했어요.";

export const checkExtensionUpdate = async (force = false): Promise<ExtensionUpdateStatus> => {
    const currentVersion = getCurrentExtensionVersion();
    const autoCheck = await updateStorage.autoCheck.getValue();

    if (!force && !autoCheck) {
        return buildStatus(currentVersion);
    }

    const lastCheckedAt = await updateStorage.lastCheck.getValue();
    const elapsed = Date.now() - lastCheckedAt;

    if (!force && elapsed >= 0 && elapsed < CHECK_INTERVAL_MS - CHECK_INTERVAL_SLACK_MS) {
        return buildStatus(currentVersion);
    }

    const wasAvailable = await updateStorage.updateAvailable.getValue();

    try {
        const latest = await fetchLatestRelease();
        const compared = compareVersions(latest.version, normalizeVersion(currentVersion));

        if (compared === null) {
            throw new UpdateCheckError("릴리스 버전 형식을 읽을 수 없어요.");
        }

        const updateAvailable = compared > 0;
        const browserName = getUpdateBrowser();
        const downloadUrl = browserName === "firefox" ? latest.firefoxDownloadUrl : latest.chromeDownloadUrl;
        const error = updateAvailable && !downloadUrl ? missingAssetMessage(browserName) : "";

        await Promise.all([
            updateStorage.lastCheck.setValue(Date.now()),
            updateStorage.latestVersion.setValue(latest.version),
            updateStorage.updateAvailable.setValue(updateAvailable),
            updateStorage.chromeDownloadUrl.setValue(latest.chromeDownloadUrl),
            updateStorage.firefoxDownloadUrl.setValue(latest.firefoxDownloadUrl),
            updateStorage.releaseNotes.setValue(latest.releaseNotes),
            updateStorage.releaseUrl.setValue(latest.releaseUrl),
            updateStorage.checkError.setValue(error)
        ]);

        await publishAvailability(updateAvailable, !force && updateAvailable && !wasAvailable, latest.version);
        return buildStatus(currentVersion);
    } catch (error) {
        const message = error instanceof UpdateCheckError
            ? error.message
            : "업데이트 확인에 실패했어요. 잠시 후 다시 시도해 주세요.";

        await Promise.all([
            updateStorage.lastCheck.setValue(Date.now()),
            updateStorage.checkError.setValue(message)
        ]);

        const status = await buildStatus(currentVersion);
        await syncUpdateBadge(status.updateAvailable);
        return status;
    }
};

export const applyExtensionUpdate = async (): Promise<UpdateApplyResult> => {
    const status = await buildStatus();

    if (!status.updateAvailable) {
        return {ok: false, error: "설치할 새 버전이 없어요."};
    }

    if (!status.downloadUrl) {
        if (status.releaseUrl) {
            await browser.tabs.create({url: status.releaseUrl});
            return {ok: true, via: "tab"};
        }

        return {ok: false, error: "다운로드 주소를 찾을 수 없어요."};
    }

    try {
        await browser.downloads.download({
            url: status.downloadUrl,
            filename: status.downloadFilename,
            saveAs: false
        });
        return {ok: true, via: "download"};
    } catch (error) {
        console.error("업데이트 zip 다운로드 실패:", error);
    }

    try {
        await browser.tabs.create({url: status.downloadUrl});
        return {ok: true, via: "tab"};
    } catch (error) {
        console.error("업데이트 zip 페이지 열기 실패:", error);
        return {ok: false, error: "zip 다운로드에 실패했어요. 릴리스 페이지에서 직접 받아 주세요."};
    }
};

export const setUpdateAutoCheck = async (enabled: boolean): Promise<ExtensionUpdateStatus> => {
    await updateStorage.autoCheck.setValue(enabled);

    if (!enabled) {
        await browser.alarms.clear(UPDATE_ALARM_NAME);
        return buildStatus();
    }

    await ensureUpdateAlarm();
    return checkExtensionUpdate(false);
};

const ensureUpdateAlarm = async () => {
    const existing = await browser.alarms.get(UPDATE_ALARM_NAME);
    // 서비스 워커가 깨어날 때마다 알람을 다시 만들면 24시간 주기가 초기화된다.
    // 예전 1분 주기 알람만 교체하고, 그 외 기존 알람은 유지한다.
    if (existing && existing.periodInMinutes !== 1) return;

    await browser.alarms.create(UPDATE_ALARM_NAME, {
        periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES
    });
};

let updateListenersBound = false;

const bindUpdateListeners = () => {
    if (updateListenersBound) return;
    updateListenersBound = true;

    browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== UPDATE_ALARM_NAME) return;
        void checkExtensionUpdate(false);
    });

    browser.notifications.onClicked.addListener((notificationId) => {
        if (notificationId !== UPDATE_NOTIFICATION_ID) return;

        void (async () => {
            const releaseUrl = await updateStorage.releaseUrl.getValue();
            if (releaseUrl) await browser.tabs.create({url: releaseUrl});
        })();
    });
};

const LAST_SEEN_VERSION_KEY = "refresher:update:lastSeenVersion";

// 확장 자체가 업데이트·재설치된 뒤에는 배지를 지우고 바로 다시 확인한다.
export const refreshUpdateStateAfterInstall = async (force = false): Promise<void> => {
    try {
        const current = normalizeVersion(getCurrentExtensionVersion());
        const stored = await browser.storage.local.get(LAST_SEEN_VERSION_KEY);
        const lastSeen = stored?.[LAST_SEEN_VERSION_KEY];
        if (!force && lastSeen === current) return;
        await browser.storage.local.set({[LAST_SEEN_VERSION_KEY]: current});
        await syncUpdateBadge(false);
        await checkExtensionUpdate(true);
    } catch (error) {
        console.error("설치 후 업데이트 상태 갱신 실패:", error);
    }
};

export const scheduleUpdateChecks = () => {
    bindUpdateListeners();

    void (async () => {
        const autoCheck = await updateStorage.autoCheck.getValue();
        const {updateAvailable} = await buildStatus();
        await syncUpdateBadge(updateAvailable);

        if (!autoCheck) {
            await browser.alarms.clear(UPDATE_ALARM_NAME);
            return;
        }

        await ensureUpdateAlarm();
        await refreshUpdateStateAfterInstall(false);
        await checkExtensionUpdate(false);
    })();
};
