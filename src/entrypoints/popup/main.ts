// BongExtend 팝업: 탭 하나에 모듈 화면 하나. 각 모듈 화면은 옛 확장 팝업을 그대로 iframe으로 띄운다.
import "@/modules/theme/theme.css";
import {sendMessage} from "@/http/messaging";
import {isNewerVersion} from "@/core/update/availability";
// @ts-ignore 순수 JS
import {getModules, setModuleEnabled} from "@/modules/core-modules.js";
import {moveItem, normalizeTabOrder} from "@/core/popup/tabOrder";
import {exportAllSettings, importSettingsText} from "@/modules/settings-io";

type TabId = "chzzk" | "trans" | "dc" | "update";

const FRAMES: Record<Exclude<TabId, "update">, string> = {
    chzzk: "/chzzk/popup.html",
    trans: "/trans/popup/popup.html",
    dc: "/dc.html"
};
const NAMES: Record<Exclude<TabId, "update">, string> = {chzzk: "치지직", trans: "번역", dc: "디시"};
const TAB_KEY = "core.popupTab";
// 탭 순서. core.* 이라 전체 백업·복원에 포함되고, 디시 초기화(refresher:*)와는 무관.
const ORDER_KEY = "core.popupTabOrder";
const DEFAULT_ORDER: TabId[] = ["chzzk", "trans", "dc", "update"];

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
        moduleNote.textContent = moduleSwitch.checked ? "" : "꺼져 있어요. 켜면 새로 열거나 새로고침한 페이지부터 적용돼요.";
    }
    void chrome.storage.local.set({[TAB_KEY]: tab});
};

// ===== 탭 끌어서 순서 바꾸기 (포인터 이벤트, 의존성 없음) =====
const tabsNav = document.querySelector<HTMLElement>(".tabs")!;
const tabButtons = () => [...tabsNav.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
const currentOrder = () => tabButtons().map((b) => b.dataset.tab as TabId);
const applyOrder = (order: TabId[]) => {
    for (const id of order) {
        const b = tabsNav.querySelector(`button[data-tab="${id}"]`);
        if (b) tabsNav.appendChild(b);
    }
};
const saveOrder = () => void chrome.storage.local.set({[ORDER_KEY]: currentOrder()});

let suppressClick = false;
tabButtons().forEach((b) => {
    b.addEventListener("click", (e) => {
        if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; return; }
        void showTab(b.dataset.tab as TabId);
    });
    b.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        e.preventDefault();
        const order = currentOrder();
        const from = order.indexOf(b.dataset.tab as TabId);
        applyOrder(moveItem(order, from, from + (e.key === "ArrowLeft" ? -1 : 1)));
        b.focus();
        saveOrder();
    });
    b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const startX = e.clientX;
        let dragging = false;
        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - startX;
            if (!dragging) {
                if (Math.abs(dx) < 5) return;
                dragging = true;
                b.setPointerCapture(ev.pointerId);
                b.classList.add("dragging");
                tabsNav.classList.add("reordering");
            }
            // 위치가 바뀌면 끌던 탭이 손가락을 따라오도록 transform 기준점을 다시 잡는다.
            b.style.transform = "";
            const others = tabButtons().filter((x) => x !== b);
            const before = others.find((x) => { const r = x.getBoundingClientRect(); return ev.clientX < r.left + r.width / 2; });
            const prevLeft = b.getBoundingClientRect().left;
            const first = new Map(others.map((x) => [x, x.getBoundingClientRect().left]));
            if (before) { if (b.nextElementSibling !== before) tabsNav.insertBefore(b, before); }
            else if (tabsNav.lastElementChild !== b) tabsNav.appendChild(b);
            // 이웃 탭이 부드럽게 밀려나는 애니메이션 (FLIP)
            for (const [x, left] of first) {
                const d = left - x.getBoundingClientRect().left;
                if (d) x.animate([{transform: `translateX(${d}px)`}, {transform: "none"}], {duration: 150, easing: "ease-out"});
            }
            const shift = b.getBoundingClientRect().left - prevLeft;
            (b as any)._base = ((b as any)._base ?? startX) + shift;
            b.style.transform = `translateX(${ev.clientX - (b as any)._base}px)`;
        };
        const onUp = () => {
            b.removeEventListener("pointermove", onMove);
            b.removeEventListener("pointerup", onUp);
            b.removeEventListener("pointercancel", onUp);
            delete (b as any)._base;
            if (!dragging) return;
            b.classList.remove("dragging");
            tabsNav.classList.remove("reordering");
            b.style.transform = "";
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            saveOrder();
        };
        b.addEventListener("pointermove", onMove);
        b.addEventListener("pointerup", onUp);
        b.addEventListener("pointercancel", onUp);
    });
});
// 로고 더블클릭 = 기본 순서로 되돌리기
document.querySelector(".brand")?.addEventListener("dblclick", () => { applyOrder(DEFAULT_ORDER); saveOrder(); });

moduleSwitch.addEventListener("change", async () => {
    if (current === "update") return;
    await setModuleEnabled(current, moduleSwitch.checked);
    moduleNote.textContent = moduleSwitch.checked
        ? "켰어요. 열려 있는 페이지는 새로고침(F5)하면 적용돼요."
        : "껐어요. 열려 있는 페이지는 새로고침(F5)하면 꺼져요.";
});

// ===== 업데이트 (BongExtend 전체에서 업데이트 UI는 이 탭 하나뿐) =====
type UpdateStatus = {
    currentVersion?: string; latestVersion?: string; updateAvailable?: boolean;
    releaseUrl?: string; downloadUrl?: string; releaseNotes?: string; error?: string;
    lastCheckedAt?: number; autoCheck?: boolean;
};
const updateStatus = $("updateStatus");
const doUpdate = $<HTMLButtonElement>("doUpdate");
const downloadZip = $<HTMLButtonElement>("downloadZip");
const openRelease = $<HTMLButtonElement>("openRelease");
const checkBtn = $<HTMLButtonElement>("checkUpdate");
const autoCheck = $<HTMLInputElement>("autoCheck");
const lastChecked = $("lastChecked");
const notesBox = $("releaseNotesBox");
const notes = $("releaseNotes");
const updateHint = $("updateHint");
let releaseUrl = "";
$("ver").textContent = chrome.runtime.getManifest().version;

const setStatus = (text: string, kind = "") => { updateStatus.textContent = text; updateStatus.className = kind; };

const renderUpdate = (s: UpdateStatus | null | undefined) => {
    if (!s) return;
    const cur = chrome.runtime.getManifest().version;
    releaseUrl = s.releaseUrl || "";
    const available = Boolean(s.updateAvailable && s.latestVersion && isNewerVersion(s.latestVersion, cur));
    if (s.error) setStatus(s.error, "error");
    else if (available) setStatus(`${cur} → ${s.latestVersion} 업데이트할 수 있어요`, "ok");
    else if (s.latestVersion) setStatus("최신 버전이에요.");
    if (typeof s.autoCheck === "boolean") autoCheck.checked = s.autoCheck;
    lastChecked.textContent = s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString("ko-KR") : "아직 확인하지 않음";
    doUpdate.hidden = !available || !s.downloadUrl;
    downloadZip.hidden = !available || !s.downloadUrl;
    openRelease.hidden = !available || !releaseUrl;
    updateHint.hidden = doUpdate.hidden;
    notesBox.hidden = !(available && s.releaseNotes);
    notes.textContent = available ? s.releaseNotes || "" : "";
};

const check = async (force: boolean) => {
    if (force) { checkBtn.disabled = true; setStatus("확인 중…"); }
    try {
        renderUpdate(await sendMessage("checkForUpdate", {force}) as UpdateStatus);
    } catch (error) {
        if (force) setStatus((error as Error)?.message || "업데이트 정보를 가져오지 못했어요.", "error");
    } finally {
        checkBtn.disabled = false;
    }
};

checkBtn.addEventListener("click", () => void check(true));
doUpdate.addEventListener("click", () => void chrome.tabs.create({url: chrome.runtime.getURL("/update.html")}));
downloadZip.addEventListener("click", async () => {
    try {
        const r = await sendMessage("applyUpdate", undefined) as {ok: boolean; error?: string};
        if (!r?.ok) setStatus(r?.error || "zip 파일을 받지 못했어요.", "error");
        else setStatus("zip 파일을 받기 시작했어요. 기존 폴더에 압축을 풀어 덮어쓴 뒤 확장 프로그램을 새로고침해 주세요.", "ok");
    } catch {
        setStatus("zip 파일을 받지 못했어요.", "error");
    }
});
openRelease.addEventListener("click", () => { if (releaseUrl) void chrome.tabs.create({url: releaseUrl}); });
$("manage").addEventListener("click", () => void chrome.tabs.create({url: `chrome://extensions/?id=${chrome.runtime.id}`}));
autoCheck.addEventListener("change", async () => {
    const want = autoCheck.checked;
    try {
        renderUpdate(await sendMessage("setUpdateAutoCheck", {enabled: want}) as UpdateStatus);
    } catch {
        autoCheck.checked = !want;
        setStatus("자동 확인 설정을 저장하지 못했어요.", "error");
    }
});
sendMessage("getUpdateStatus", undefined).then((s) => {
    renderUpdate(s as UpdateStatus);
    if ((s as UpdateStatus)?.autoCheck) void check(false);
}).catch(() => {});

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
        setIo(`저장하지 못했어요: ${(error as Error)?.message || error}`, "error");
    }
});

const runImport = async (text: string) => {
    try {
        const result = await importSettingsText(text);
        setIo(`${result.join(", ")} 설정을 불러왔어요. 열려 있는 페이지는 새로고침(F5)해 주세요.`, "ok");
        document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((f) => { if (f.src) f.src = f.src; });
    } catch (error) {
        setIo((error as Error)?.message || "불러오지 못했어요.", "error");
    }
};

$("importAll").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    importFile.value = "";
    if (file) await runImport(await file.text());
});
$("importPaste").addEventListener("click", async () => {
    const text = prompt("불러올 설정(JSON)을 붙여넣어 주세요.");
    if (text) await runImport(text);
});

chrome.storage.local.get([TAB_KEY, ORDER_KEY]).then((v) => {
    applyOrder(normalizeTabOrder(v[ORDER_KEY], DEFAULT_ORDER));
    tabsNav.classList.remove("order-pending");
    const saved = v[TAB_KEY] as TabId | undefined;
    void showTab(saved && ["chzzk", "trans", "dc", "update"].includes(saved) ? saved : "chzzk");
});
