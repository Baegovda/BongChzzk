import {databaseStorage} from "@/storage/wxtStorage";
import {normalizeStorageData} from "@/storage/migration";
import {ref} from "vue";
import {isOtherModuleKey, onlyDcKeys} from "@/storage/namespace";

// BongExtend: 치지직(chzzk.*)·번역(trans.*)·공통(core.*) 키는 디시 데이터 작업에서 건드리지 않는다.
const dcLocalKeys = async (): Promise<string[]> =>
    Object.keys(await browser.storage.local.get(null)).filter((key) => !isOtherModuleKey(key));

const replaceLocalStorage = async (data: Record<string, unknown>): Promise<void> => {
    const previousData = onlyDcKeys(await browser.storage.local.get(null));
    const next = onlyDcKeys(data);

    try {
        await browser.storage.local.remove(await dcLocalKeys());
        await browser.storage.local.set(next);
    } catch (error) {
        await browser.storage.local.remove(await dcLocalKeys());
        await browser.storage.local.set(previousData);
        throw error;
    }
};

const parseStorageImport = (input: string): Record<string, unknown> => {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("가져오기 데이터는 JSON 객체여야 해요.");
    }

    return parsed as Record<string, unknown>;
};

export function useData() {
    const lastUpdate = ref(-1);
    const loading = ref(false);

    const refreshLastUpdate = async () => {
        lastUpdate.value = await databaseStorage.lastUpdate.getValue();
    };

    const backupCloud = async (): Promise<void> => {
        loading.value = true;
        try {
            const data = onlyDcKeys(await browser.storage.local.get(null));
            const prefix = "refresher:database:";
            for (const key of Object.keys(data)) {
                if (key.startsWith(prefix)) delete data[key];
            }

            const syncKeys = Object.keys(await browser.storage.sync.get(null)).filter((key) => !isOtherModuleKey(key));
            await browser.storage.sync.remove(syncKeys);
            await browser.storage.sync.set(data);

            const now = Date.now();
            lastUpdate.value = now;
            await databaseStorage.lastUpdate.setValue(now);
            alert("데이터를 클라우드에 백업했어요.");
        } catch (error) {
            console.error("Cloud backup failed:", error);
            alert("데이터를 클라우드에 백업하는 데 실패했어요.");
        } finally {
            loading.value = false;
        }
    };

    const recoverCloud = async (): Promise<void> => {
        if (!confirm("클라우드 백업으로 현재 설정을 교체할까요?")) return;

        loading.value = true;
        try {
            const data = onlyDcKeys(await browser.storage.sync.get());
            const preservedIp = await databaseStorage.ip.getValue();
            const preservedBan = await databaseStorage.ban.getValue();

            const preserved: Record<string, unknown> = {};
            if (preservedIp) preserved["refresher:database:ip"] = preservedIp;
            if (preservedBan) preserved["refresher:database:ban"] = preservedBan;

            await replaceLocalStorage(normalizeStorageData({...data, ...preserved}));
            alert("데이터를 복원했어요. 새 탭에서 디시인사이드를 열어 주세요.");
        } catch {
            alert("데이터를 복원하는 데 실패했어요.");
        } finally {
            loading.value = false;
        }
    };

    const exportData = async (): Promise<void> => {
        loading.value = true;
        try {
            const data = onlyDcKeys(await browser.storage.local.get());
            const prefix = "refresher:database:";
            for (const key of Object.keys(data)) {
                if (key.startsWith(prefix)) delete data[key];
            }

            await navigator.clipboard.writeText(JSON.stringify(data));
            alert("데이터를 클립보드로 내보냈어요.");
        } catch {
            alert("데이터를 클립보드로 내보내는 데 실패했어요.");
        } finally {
            loading.value = false;
        }
    };

    const importData = async (): Promise<void> => {
        const input = prompt("데이터를 입력해 주세요.");

        if (!input) return;

        loading.value = true;
        try {
            const data = normalizeStorageData(parseStorageImport(input));
            await replaceLocalStorage(data);
            alert("데이터를 가져왔어요. 새 탭에서 디시인사이드를 열어 주세요.");
        } catch {
            alert("데이터를 가져오는 데 실패했어요.");
        } finally {
            loading.value = false;
        }
    };

    const clearData = async (): Promise<void> => {
        if (!confirm("디시 설정·차단·메모를 초기화할까요? 다른 모듈 설정은 그대로예요.")) return;

        loading.value = true;
        try {
            await browser.storage.local.remove(await dcLocalKeys());
            alert("데이터를 초기화했어요. 새 탭에서 디시인사이드를 열어 주세요.");
        } catch {
            alert("데이터를 초기화하는 데 실패했어요.");
        } finally {
            loading.value = false;
        }
    };

    return {
        lastUpdate,
        loading,
        refreshLastUpdate,
        backupCloud,
        recoverCloud,
        exportData,
        importData,
        clearData
    };
}