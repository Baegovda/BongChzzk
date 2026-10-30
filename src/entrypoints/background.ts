import {onMessage, sendMessage, sendToContentTab} from "@/http/messaging";
import {migrateLocalStorageData} from "@/storage/migration";
import {databaseStorage, moduleSchemaStorage} from "@/storage/wxtStorage";
import {isDcContentScriptUrl} from "@/utils/dcinsideTab";
import {fetchRemoteIpIsp, isIpIspDatabase} from "@/utils/ipIsp";
import {
    applyExtensionUpdate,
    checkExtensionUpdate,
    getExtensionUpdateStatus,
    scheduleUpdateChecks,
    setUpdateAutoCheck
} from "@/core/updateCheck";

// @ts-ignore 번역 모듈은 기존 BongTrans 순수 JS를 그대로 쓴다.
import {createTransMenus, startTransBackground} from "@/modules/trans/background.js";
// @ts-ignore 공통 모듈 스위치(순수 JS)
import {MODULES_KEY, getModules} from "@/modules/core-modules.js";
import {syncChzzkScripts} from "@/modules/chzzk-register";

export default defineBackground(() => {
    // ===== BongExtend: 번역 모듈(옛 BongTrans) 처리기 =====
    startTransBackground();

    // ===== BongExtend: 치지직 모듈(옛 BongChzzk) 콘텐츠 스크립트 등록 =====
    // 모듈 스위치를 끄면 등록을 풀어서 치지직 페이지에 아예 붙지 않게 한다.
    void syncChzzkScripts(getModules);
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[MODULES_KEY]) void syncChzzkScripts(getModules);
    });

    migrateLocalStorageData().catch((error) => {
        console.error("Storage migration error:", error);
    });

    // ===== Broadcast: popup/content → background → 모든 탭 =====
    onMessage("broadcast", async ({data}) => {
        const {type, data: payload} = data;

        try {
            const tabs = await browser.tabs.query({});
            const targets = tabs.filter((tab) => tab.id && isDcContentScriptUrl(tab.url));
            const delivered = await Promise.all(targets.map(async (tab) => {
                try {
                    await sendToContentTab(type, payload, tab.id!);
                    return true;
                } catch {
                    return false;
                }
            }));

            return {success: true, sentTo: delivered.filter(Boolean).length};
        } catch (e) {
            return {success: false, error: e};
        }
    });

    // 콘텐츠 스크립트가 없는 탭이면 팝업이 여기로 물어본다. 마지막에 저장해 둔 목록을 돌려준다.
    onMessage("getSchema", async () => {
        return await moduleSchemaStorage.getValue();
    });

    // ===== Context Menus =====
    const contextMenuItems: Browser.contextMenus.CreateProperties[] = [
        {
            id: "blockSelected",
            title: "오른쪽 클릭한 유저 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "memoSelected",
            title: "오른쪽 클릭한 유저 메모",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconSelected",
            title: "오른쪽 클릭한 디시콘 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "dcconAllSelected",
            title: "오른쪽 클릭한 디시콘 전체 차단",
            contexts: ["all"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        },
        {
            id: "searchSauceNao",
            title: "SauceNao 검색",
            contexts: ["image"],
            documentUrlPatterns: ["*://gall.dcinside.com/*"]
        }
    ];

    let contextMenuSetup: Promise<void> | null = null;

    const createContextMenus = (): Promise<void> => {
        if (contextMenuSetup) return contextMenuSetup;

        contextMenuSetup = (async () => {
            await browser.contextMenus.removeAll();

            for (const item of contextMenuItems) {
                if (item.id) {
                    await browser.contextMenus.remove(item.id).catch(() => {});
                }

                await browser.contextMenus.create(item);
            }

            // 번역 모듈 메뉴 (removeAll 뒤에 같이 만든다)
            try {
                createTransMenus();
            } catch (error) {
                console.warn("번역 메뉴를 만들지 못했습니다.", error);
            }
        })();

        return contextMenuSetup;
    };

    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (!tab?.id) return;
        // 타입 안전 메시징: 활성 탭에 전달
        switch (info.menuItemId) {
            case "blockSelected":
                sendMessage("blockSelected", undefined, tab.id).catch(() => {});
                break;
            case "memoSelected":
                sendMessage("memoSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconSelected":
                sendMessage("dcconSelected", undefined, tab.id).catch(() => {});
                break;
            case "dcconAllSelected":
                sendMessage("dcconAllSelected", undefined, tab.id).catch(() => {});
                break;
            case "searchSauceNao":
                sendMessage("searchSauceNao", undefined, tab.id).catch(() => {});
                break;
        }
    });

    void createContextMenus();

    scheduleUpdateChecks();

    onMessage("getUpdateStatus", () => getExtensionUpdateStatus());
    onMessage("checkForUpdate", ({data}) => checkExtensionUpdate(Boolean(data?.force)));
    onMessage("applyUpdate", () => applyExtensionUpdate());
    onMessage("setUpdateAutoCheck", ({data}) => setUpdateAutoCheck(data.enabled));

    // <a href="chrome://..."> 는 브라우저가 막는다. tabs.create 만 chrome://extensions 와 about:addons 를 연다.
    onMessage("openExtensionsPage", async () => {
        const url = import.meta.env.FIREFOX
            ? "about:addons"
            : `chrome://extensions/?id=${browser.runtime.id}`;

        try {
            await browser.tabs.create({url});
            return {ok: true};
        } catch (error) {
            console.error("확장 프로그램 관리 페이지를 열지 못했습니다.", error);

            if (import.meta.env.FIREFOX) {
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했습니다."};
            }

            try {
                await browser.tabs.create({url: "chrome://extensions"});
                return {ok: true};
            } catch (fallbackError) {
                console.error("확장 프로그램 관리 페이지를 열지 못했습니다.", fallbackError);
                return {ok: false, error: "확장 프로그램 관리 페이지를 열지 못했습니다."};
            }
        }
    });

    browser.runtime.onStartup.addListener(() => {
        void createContextMenus();
    });

    // BongExtend: 단축키(commands)는 사용자 요청으로 모두 뺐다.

    // dcrefresher.green1052.com/data 는 404다. 차단 목록을 받던 요청은 서비스 워커 오류만 남기므로 하지 않는다.
    // 이미 저장한 차단 목록은 storage에 그대로 둔다. 통신사 표만 GitHub develop에서 따로 확인한다.
    const IP_UPDATE_INTERVAL = 604800000;

    const refreshIpDatabase = async (): Promise<void> => {
        try {
            const remoteIp = await fetchRemoteIpIsp();
            if (remoteIp) {
                const current: unknown = await databaseStorage.ip.getValue();
                const currentGenerated = isIpIspDatabase(current) ? current.generated : "";
                if (remoteIp.generated > currentGenerated) {
                    await databaseStorage.ip.setValue(remoteIp);
                }
            }
            await databaseStorage.ipCheckedAt.setValue(Date.now());
        } catch {
            // 네트워크가 끊기면 다음 시작에 다시 시도한다. 콘솔에는 남기지 않는다.
        }
    };

    // ===== Lifecycle =====
    browser.runtime.onInstalled.addListener(async () => {
        await createContextMenus();
        if (import.meta.env.PROD) {
            await refreshIpDatabase();
        }
    });

    if (import.meta.env.PROD) {
        void (async () => {
            const checkedAt = await databaseStorage.ipCheckedAt.getValue();
            if (!checkedAt || Date.now() - checkedAt > IP_UPDATE_INTERVAL) {
                await refreshIpDatabase();
            }
        })();
    }
});
