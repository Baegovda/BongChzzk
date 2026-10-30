import {onMounted, reactive, ref} from "vue";
import {sendMessage} from "@/http/messaging";
import type {ExtensionUpdateStatus} from "@/core/updateCheck";

const emptyStatus = (): ExtensionUpdateStatus => ({
    currentVersion: browser.runtime.getManifest().version,
    latestVersion: "",
    updateAvailable: false,
    downloadUrl: "",
    downloadFilename: "",
    releaseNotes: "",
    releaseUrl: "",
    lastCheckedAt: 0,
    error: "",
    autoCheck: true,
    browser: import.meta.env.FIREFOX ? "firefox" : "chrome"
});

export const useUpdate = () => {
    const status = reactive<ExtensionUpdateStatus>(emptyStatus());
    const checking = ref(false);
    const applying = ref(false);
    const downloadNote = ref("");

    const syncStatus = async () => {
        const next = await sendMessage("getUpdateStatus");
        Object.assign(status, next);
    };

    const checkUpdate = async (force = true) => {
        if (force) {
            checking.value = true;
            downloadNote.value = "";
        }

        try {
            const next = await sendMessage("checkForUpdate", {force});
            Object.assign(status, next);
        } catch {
            if (force) {
                status.error = "업데이트 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
            }
        } finally {
            if (force) checking.value = false;
        }
    };

    const canInPlaceUpdate = !import.meta.env.FIREFOX
        && typeof window.showDirectoryPicker === "function";

    const openInPlaceUpdate = async () => {
        downloadNote.value = "";

        try {
            await browser.tabs.create({url: browser.runtime.getURL("/update.html")});
        } catch {
            status.error = "업데이트 탭을 열지 못했습니다.";
        }
    };

    const applyUpdate = async () => {
        applying.value = true;
        downloadNote.value = "";

        try {
            const result = await sendMessage("applyUpdate");
            if (!result.ok) {
                status.error = result.error ?? "zip 다운로드에 실패했습니다.";
                return;
            }

            downloadNote.value = result.via === "tab"
                ? "브라우저에서 파일을 열었습니다. 저장한 뒤 아래 순서대로 설치하세요."
                : "zip 다운로드를 시작했습니다. 아래 순서대로 설치하세요.";
        } catch {
            status.error = "zip 다운로드에 실패했습니다.";
        } finally {
            applying.value = false;
        }
    };

    const setAutoCheck = async (enabled: boolean) => {
        const previous = status.autoCheck;
        status.autoCheck = enabled;

        try {
            const next = await sendMessage("setUpdateAutoCheck", {enabled});
            Object.assign(status, next);
        } catch {
            status.autoCheck = previous;
            status.error = "자동 확인 설정을 저장하지 못했습니다.";
        }
    };

    const lastCheckedLabel = () => {
        if (!status.lastCheckedAt) return "아직 확인하지 않음";
        return new Date(status.lastCheckedAt).toLocaleString("ko-KR");
    };

    onMounted(async () => {
        try {
            await syncStatus();
            if (status.autoCheck) {
                await checkUpdate(false);
            }
        } catch {
            status.error = "업데이트 상태를 불러오지 못했습니다.";
        }
    });

    return {
        status,
        checking,
        applying,
        downloadNote,
        canInPlaceUpdate,
        checkUpdate,
        applyUpdate,
        openInPlaceUpdate,
        setAutoCheck,
        lastCheckedLabel
    };
};
