// BongExtend 팝업: 탭 하나에 모듈 화면 하나. 각 모듈 화면은 옛 확장 팝업을 그대로 iframe으로 띄운다.
import {sendMessage} from "@/http/messaging";
// @ts-ignore 순수 JS
import {getModules, setModuleEnabled} from "@/modules/core-modules.js";
import {exportAllSettings, importSettingsText} from "@/modules/settings-io";

type TabId = "chzzk" | "trans" | "dc" | "update";

const FRAMES: Record<Exclude<TabId, "update">, string> = {
    chzzk: "/chzzk/popup.html",
    trans: "/trans/popup/popup.html",
    dc: "/dc.html"
};
const NAMES: Record<Exclude<TabId, "update">, string> = {chzzk: "치지직", trans: "번역", dc: "디시"};
const TAB_KEY = "core.popupTab";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const moduleBar = $("moduleBar");
const moduleSwitch = $<HTMLInputElement>("moduleSwitch");
const moduleLabel = $("moduleLabel");
const moduleNote = $("moduleNote");
let current: TabId = "chzzk";

const showTab = async (tab: TabId) => {
    current = tab;
    document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll<HTMLElement>("[data-frame]").forEach((el) => {
        const on = el.dataset.frame === tab;
        if (el instanceof HTMLIFrameElement) {
            if (on && !el.src) el.src = FRAMES[el.dataset.frame as keyof typeof FRAMES];
            el.classList.toggle("active", on);
            if (el.dataset.frame === "chzzk") el.classList.add("chzzk-frame");
        } else {
            el.hidden = !on;
        }
    });
    if (tab === "update") {
        moduleBar.hidden = true;
    } else {
        moduleBar.hidden = false;
        const modules = await getModules();
        moduleSwitch.checked = modules[tab] !== false;
        moduleLabel.textContent = `${NAMES[tab]} 모듈 사용`;
        moduleNote.textContent = moduleSwitch.checked ? "" : "꺼져 있어요. 켜면 새로 연 페이지(또는 새로고침한 페이지)부터 적용돼요.";
    }
    void chrome.storage.local.set({[TAB_KEY]: tab});
};

document.querySelectorAll<HTMLButtonElement>(".tabs button").forEach((b) => {
    b.addEventListener("click", () => void showTab(b.dataset.tab as TabId));
});

moduleSwitch.addEventListener("change", async () => {
    if (current === "update") return;
    await setModuleEnabled(current, moduleSwitch.checked);
    moduleNote.textContent = moduleSwitch.checked
        ? "켰어요. 열려 있던 페이지는 새로고침(F5)하면 적용돼요."
        : "껐어요. 열려 있던 페이지는 새로고침(F5)하면 빠져요.";
});

// ===== 업데이트 (하나로 합친 업데이트: 옛 BongDC 방식) =====
type UpdateStatus = {
    currentVersion?: string; latestVersion?: string; updateAvailable?: boolean;
    releaseUrl?: string; downloadUrl?: string; error?: string; message?: string;
};
const updateStatus = $("updateStatus");
const doUpdate = $<HTMLButtonElement>("doUpdate");
const openRelease = $<HTMLButtonElement>("openRelease");
let releaseUrl = "";
$("ver").textContent = chrome.runtime.getManifest().version;

const renderUpdate = (s: UpdateStatus | null | undefined) => {
    if (!s) return;
    const cur = chrome.runtime.getManifest().version;
    releaseUrl = s.releaseUrl || "";
    openRelease.hidden = !releaseUrl;
    if (s.error) {
        updateStatus.textContent = s.error;
        updateStatus.className = "error";
    } else if (s.updateAvailable && s.latestVersion) {
        updateStatus.textContent = `${cur} → ${s.latestVersion} 업데이트 가능`;
        updateStatus.className = "ok";
    } else if (s.latestVersion) {
        updateStatus.textContent = `최신 버전입니다. (${cur})`;
        updateStatus.className = "";
    }
    doUpdate.hidden = !s.updateAvailable;
};

$("checkUpdate").addEventListener("click", async () => {
    updateStatus.textContent = "확인 중…";
    updateStatus.className = "";
    try {
        renderUpdate(await sendMessage("checkForUpdate", {force: true}) as UpdateStatus);
    } catch (error) {
        updateStatus.textContent = (error as Error)?.message || "업데이트 정보를 가져오지 못했습니다.";
        updateStatus.className = "error";
    }
});
doUpdate.addEventListener("click", () => void chrome.tabs.create({url: chrome.runtime.getURL("/update.html")}));
openRelease.addEventListener("click", () => { if (releaseUrl) void chrome.tabs.create({url: releaseUrl}); });
$("manage").addEventListener("click", () => void chrome.tabs.create({url: `chrome://extensions/?id=${chrome.runtime.id}`}));
sendMessage("getUpdateStatus", undefined).then((s) => renderUpdate(s as UpdateStatus)).catch(() => {});

// ===== 설정 내보내기·가져오기 =====
const ioStatus = $("ioStatus");
const setIo = (text: string, kind = "") => { ioStatus.textContent = text; ioStatus.className = kind; };
const importFile = $<HTMLInputElement>("importFile");

$("exportAll").addEventListener("click", async () => {
    try {
        const data = await exportAllSettings();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `bongextend-settings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setIo("설정 파일을 저장했어요.", "ok");
    } catch (error) {
        setIo(`내보내지 못했어요: ${(error as Error)?.message || error}`, "error");
    }
});

const runImport = async (text: string) => {
    try {
        const result = await importSettingsText(text);
        setIo(`${result.join(", ")} 설정을 가져왔어요. 열려 있던 페이지는 새로고침(F5)해 주세요.`, "ok");
        document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((f) => { if (f.src) f.src = f.src; });
    } catch (error) {
        setIo((error as Error)?.message || "가져오지 못했어요.", "error");
    }
};

$("importAll").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (file) await runImport(await file.text());
});
$("importPaste").addEventListener("click", async () => {
    const text = prompt("가져올 설정(JSON)을 붙여넣어 주세요.");
    if (text) await runImport(text);
});

chrome.storage.local.get(TAB_KEY).then((v) => {
    const saved = v[TAB_KEY] as TabId | undefined;
    void showTab(saved && ["chzzk", "trans", "dc", "update"].includes(saved) ? saved : "chzzk");
});
