// BongExtend 설정 내보내기·가져오기
// 받는 형식
//  1) BongExtend 파일: {type:"bongextend-settings", chzzk:{sync,local}, trans:{settings}, dc:{...}, core:{...}}
//  2) 옛 BongTrans 파일: {type:"page-translator-settings", settings:{...}}
//  3) 옛 BongDC 데이터: 디시 탭 → 데이터 → 내보내기로 복사한 JSON (refresher:* 키)
//  4) 옛 BongChzzk 설정 객체: {enabled, watchList, ...} (옛 확장에는 내보내기 버튼이 없어서 직접 만든 경우만)
// @ts-ignore 순수 JS
import {normalizeSettings, SETTINGS_FILE_TYPE, STORAGE_KEY as TRANS_KEY} from "@/modules/trans/lib/settings.js";
import {normalizeStorageData} from "@/storage/migration";
import {isOtherModuleKey, onlyDcKeys} from "@/storage/namespace";

export const BONGEXTEND_FILE_TYPE = "bongextend-settings";

export const CHZZK_KEYS = [
    "enabled", "threshold", "cooldown", "toast", "retryTimer", "lockQuality", "targetQuality", "followRefresh", "followInterval",
    "vivid", "hideRanking", "chatFontSize", "viewerChat", "viewerOverlay", "arrowSeek", "seekSeconds", "autoWide", "autoPlay",
    "blurRankNames", "hideTimeGuide", "adSkip", "watchEnabled", "watchList"
];

type Rec = Record<string, unknown>;

export type ImportPlan = {
    labels: string[];
    sync: Rec;          // chrome.storage.sync 에 쓸 값 (chzzk.*)
    local: Rec;         // chrome.storage.local 에 더할 값 (chzzk.*, trans.*, core.*)
    dcReplace: Rec | null; // 디시 데이터: 기존 디시 키를 지우고 이것으로 바꾼다
};

const isObj = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);

const prefixed = (prefix: string, obj: Rec | undefined): Rec => {
    const out: Rec = {};
    if (!isObj(obj)) return out;
    for (const [k, v] of Object.entries(obj)) out[k.startsWith(prefix) ? k : prefix + k] = v;
    return out;
};

export const planImport = (text: string): ImportPlan => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(String(text || "").trim());
    } catch {
        throw new Error("설정 파일을 읽지 못했어요. JSON 형식인지 확인해 주세요.");
    }
    if (!isObj(parsed)) throw new Error("설정 파일에 설정이 없어요.");

    const plan: ImportPlan = {labels: [], sync: {}, local: {}, dcReplace: null};

    if (parsed.type === BONGEXTEND_FILE_TYPE) {
        const chzzk = isObj(parsed.chzzk) ? parsed.chzzk : {};
        if (isObj(chzzk.sync) || isObj(chzzk.local)) {
            Object.assign(plan.sync, prefixed("chzzk.", chzzk.sync as Rec));
            Object.assign(plan.local, prefixed("chzzk.", chzzk.local as Rec));
            plan.labels.push("치지직");
        }
        if (isObj(parsed.trans) && isObj(parsed.trans.settings)) {
            plan.local[TRANS_KEY] = normalizeSettings(parsed.trans.settings);
            plan.labels.push("번역");
        }
        if (isObj(parsed.dc)) {
            plan.dcReplace = normalizeStorageData(onlyDcKeys(parsed.dc));
            plan.labels.push("디시");
        }
        if (isObj(parsed.core)) Object.assign(plan.local, prefixed("core.", parsed.core));
        if (!plan.labels.length) throw new Error("설정 파일에 불러올 내용이 없어요.");
        return plan;
    }

    if (parsed.type === SETTINGS_FILE_TYPE) {
        if (!isObj(parsed.settings)) throw new Error("번역 설정 파일에 설정이 없어요.");
        plan.local[TRANS_KEY] = normalizeSettings(parsed.settings);
        plan.labels.push("번역");
        return plan;
    }

    if (parsed.type != null) throw new Error("알 수 없는 설정 파일이에요.");

    const keys = Object.keys(parsed);
    const chzzkHits = keys.filter((k) => CHZZK_KEYS.includes(k));
    if (chzzkHits.length && chzzkHits.length === keys.length) {
        Object.assign(plan.sync, prefixed("chzzk.", parsed));
        plan.labels.push("치지직(이전 버전)");
        return plan;
    }

    const looksDc = keys.some((k) => k.startsWith("refresher") || k.startsWith("__REFRESHER") || k.endsWith(".enable"));
    if (looksDc) {
        plan.dcReplace = normalizeStorageData(onlyDcKeys(parsed));
        plan.labels.push("디시");
        return plan;
    }

    throw new Error("어떤 설정 파일인지 알 수 없어요. 올바른 파일인지 확인해 주세요.");
};

type Area = {
    get: (keys?: null) => Promise<Rec>;
    set: (items: Rec) => Promise<void>;
    remove: (keys: string[]) => Promise<void>;
};

export const applyImport = async (plan: ImportPlan, local: Area, sync: Area): Promise<string[]> => {
    if (Object.keys(plan.sync).length) await sync.set(plan.sync);
    if (Object.keys(plan.local).length) await local.set(plan.local);
    if (plan.dcReplace) {
        const dcKeys = Object.keys(await local.get(null)).filter((k) => !isOtherModuleKey(k));
        // 통신사 표 같은 큰 데이터베이스는 그대로 둔다 (옛 BongDC 가져오기와 같은 동작)
        const keep = dcKeys.filter((k) => !k.startsWith("refresher:database:"));
        await local.remove(keep);
        await local.set(plan.dcReplace);
    }
    return plan.labels;
};

export const buildExport = (local: Rec, sync: Rec): Rec => {
    const pick = (src: Rec, prefix: string) => {
        const out: Rec = {};
        for (const [k, v] of Object.entries(src)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
        return out;
    };
    const dc = onlyDcKeys(local);
    for (const k of Object.keys(dc)) if (k.startsWith("refresher:database:")) delete dc[k];
    return {
        type: BONGEXTEND_FILE_TYPE,
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "BongExtend",
        chzzk: {sync: pick(sync, "chzzk."), local: pick(local, "chzzk.")},
        trans: {settings: local[TRANS_KEY] ?? null},
        dc,
        core: pick(local, "core.")
    };
};

const area = (a: chrome.storage.StorageArea): Area => ({
    get: (keys) => a.get(keys ?? null) as Promise<Rec>,
    set: (items) => a.set(items),
    remove: (keys) => a.remove(keys)
});

export const exportAllSettings = async (): Promise<Rec> =>
    buildExport(await chrome.storage.local.get(null), await chrome.storage.sync.get(null));

export const importSettingsText = async (text: string): Promise<string[]> =>
    applyImport(planImport(text), area(chrome.storage.local), area(chrome.storage.sync));
