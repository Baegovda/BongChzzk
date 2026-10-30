const DC_EXCLUDED_HOSTS = new Set([
    "event.dcinside.com",
    "h5.dcinside.com",
    "m.dcinside.com",
    "mall.dcinside.com",
    "wiki.dcinside.com",
    "gallog.dcinside.com"
]);

/** content script가 주입되는 디시 탭 URL인지 (manifest matches/exclude_matches와 동일) */
export const isDcContentScriptUrl = (url?: string | null): url is string => {
    if (!url) return false;

    try {
        const {protocol, hostname} = new URL(url);
        if (protocol !== "https:") return false;
        if (!hostname.endsWith(".dcinside.com") && hostname !== "dcinside.com") return false;
        return !DC_EXCLUDED_HOSTS.has(hostname);
    } catch {
        return false;
    }
};

/** popup/options에서 getSchema 등을 보낼 디시 탭 (활성 탭 우선) */
export const findDcContentTab = async (): Promise<Browser.tabs.Tab | undefined> => {
    const [activeTab] = await browser.tabs.query({active: true, currentWindow: true});
    if (activeTab?.id && isDcContentScriptUrl(activeTab.url)) {
        return activeTab;
    }

    const windowTabs = await browser.tabs.query({currentWindow: true});
    const inWindow = windowTabs.find((tab) => tab.id && isDcContentScriptUrl(tab.url));
    if (inWindow) return inWindow;

    const allTabs = await browser.tabs.query({});
    return allTabs.find((tab) => tab.id && isDcContentScriptUrl(tab.url));
};
