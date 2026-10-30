// BongChrome: 치지직 모듈(옛 BongChzzk) 콘텐츠 스크립트를 동적으로 등록한다.
// 파일 순서는 옛 BongChzzk manifest.json content_scripts 순서 그대로이고, 맨 앞에 저장소 구역 shim(lib/ns.js)만 더했다.
export const CHZZK_SCRIPT_ID = "bongchrome-chzzk";

export const CHZZK_SCRIPT_FILES = [
    "chzzk/lib/ns.js",
    "chzzk/lib/guard.js",
    "chzzk/lib/quality.js",
    "chzzk/lib/following.js",
    "chzzk/lib/extras.js",
    "chzzk/lib/watch.js",
    "chzzk/lib/wide.js",
    "chzzk/lib/player.js",
    "chzzk/content.js",
    "chzzk/content-following.js",
    "chzzk/content-extras.js",
    "chzzk/content-watch.js",
    "chzzk/content-wide.js"
];

export const CHZZK_MATCHES = ["https://chzzk.naver.com/*"];

type ModulesGetter = () => Promise<Record<string, boolean>>;

let running: Promise<void> = Promise.resolve();

export const syncChzzkScripts = (getModules: ModulesGetter): Promise<void> => {
    running = running.then(async () => {
        if (!chrome.scripting?.registerContentScripts) return;
        try {
            const modules = await getModules();
            const existing = await chrome.scripting.getRegisteredContentScripts({ids: [CHZZK_SCRIPT_ID]});
            if (modules.chzzk === false) {
                if (existing.length) await chrome.scripting.unregisterContentScripts({ids: [CHZZK_SCRIPT_ID]});
                return;
            }
            const script: chrome.scripting.RegisteredContentScript = {
                id: CHZZK_SCRIPT_ID,
                matches: CHZZK_MATCHES,
                js: CHZZK_SCRIPT_FILES,
                runAt: "document_idle",
                allFrames: true,
                persistAcrossSessions: true
            };
            if (existing.length) await chrome.scripting.updateContentScripts([script]);
            else await chrome.scripting.registerContentScripts([script]);
        } catch (error) {
            console.error("치지직 스크립트를 등록하지 못했습니다.", error);
        }
    });
    return running;
};
