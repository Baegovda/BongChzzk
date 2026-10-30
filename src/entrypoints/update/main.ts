import {canApplyVersion, checkLatestRelease, isBongChromeManifest, type LatestRelease} from "@/core/update/release";
import {installSession, pendingDecision, versionLine, type WriteProgress} from "@/core/update/installPlan";
import {fileKey, type PendingUpdate, type ZipFile} from "@/core/update/types";
import {extractAll} from "@/core/update/zip";

const $ = (id: string) => document.getElementById(id);
const statusEl = $("status");
const errorEl = $("error");
const versionEl = $("ver");
const startButton = $("start") as HTMLButtonElement | null;
const resumeButton = $("resume") as HTMLButtonElement | null;

const setStatus = (text: string) => {
    if (statusEl) statusEl.textContent = text;
};

const setError = (text: string) => {
    if (errorEl) errorEl.textContent = text || "";
};

const showFirefox = () => {
    if (versionEl) versionEl.textContent = browser.runtime.getManifest().version;
    setStatus("파이어폭스는 폴더에 바로 쓰는 업데이트를 지원하지 않습니다. 설정에서 zip을 받아 기존 폴더에 덮어쓰세요.");
    if (startButton) startButton.hidden = true;
    if (resumeButton) resumeButton.hidden = true;
};

if (import.meta.env.FIREFOX) {
    showFirefox();
} else {
    const running = browser.runtime.getManifest().version;
    let release: LatestRelease | null = null;

    const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
        const request = indexedDB.open("bongchrome-install", 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const name of ["kv", "pending"]) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
            }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });

    const idb = async <T>(store: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, mode);
            const request = fn(tx.objectStore(store));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error);
        });
    };

    const loadDir = () => idb<FileSystemDirectoryHandle | undefined>("kv", "readonly", (store) => store.get("installDir")).catch(() => null);
    const saveDir = (handle: FileSystemDirectoryHandle) => idb("kv", "readwrite", (store) => store.put(handle, "installDir"));
    const loadPending = () => idb<PendingUpdate | undefined>("pending", "readonly", (store) => store.get("pending")).catch(() => null);
    const savePending = async (pending: PendingUpdate): Promise<void> => {
        await idb("pending", "readwrite", (store) => store.put(pending, "pending"));
    };
    const clearPending = () => idb("pending", "readwrite", (store) => store.delete("pending")).catch(() => undefined);

    class StepError extends Error {
        constructor(step: string, cause: unknown) {
            const detail = cause instanceof Error ? `${cause.name} - ${cause.message}` : String(cause);
            super(`${step}: ${detail}`);
            this.name = "StepError";
        }
    }

    const manifestText = async (dir: FileSystemDirectoryHandle): Promise<string> => {
        try {
            const handle = await dir.getFileHandle("manifest.json");
            return await (await handle.getFile()).text();
        } catch {
            return "";
        }
    };

    const verifyDir = async (dir: FileSystemDirectoryHandle) => {
        if (!isBongChromeManifest(await manifestText(dir))) {
            throw new Error("선택한 폴더는 BongChrome 확장 프로그램 폴더가 아닙니다. chrome://extensions 에서 불러온 압축을 푼 BongChrome 폴더(manifest.json이 있는 곳)를 선택하세요. 다운로드나 바탕화면 폴더 자체는 크롬이 고르지 못하게 막습니다.");
        }
    };

    const permissionGranted = async (dir: FileSystemDirectoryHandle): Promise<boolean> => {
        const options = {mode: "readwrite" as const};
        let state = await dir.queryPermission(options);
        if (state !== "granted") state = await dir.requestPermission(options);
        return state === "granted";
    };

    const getInstallDir = async (allowPick: boolean): Promise<FileSystemDirectoryHandle> => {
        const saved = await loadDir();
        if (saved && await permissionGranted(saved)) {
            try {
                await verifyDir(saved);
                return saved;
            } catch {
                // 저장된 폴더가 더 이상 BongChrome가 아니면 다시 고른다.
            }
        }

        if (!allowPick) {
            throw new Error("저장된 설치 폴더에 접근할 수 없습니다. 폴더 선택/업데이트 시작으로 다시 진행하세요.");
        }

        if (!window.showDirectoryPicker) {
            throw new Error("이 브라우저는 폴더 선택을 지원하지 않습니다.");
        }

        setStatus("확장 프로그램 설치 폴더(압축을 푼 BongChrome 폴더)를 선택하세요…");
        let dir: FileSystemDirectoryHandle;
        try {
            dir = await window.showDirectoryPicker({mode: "readwrite", id: "bongchrome-install"});
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                const cancel = new Error("폴더 선택이 취소되었습니다.");
                cancel.name = "AbortError";
                throw cancel;
            }
            throw new StepError("폴더 선택 실패", error);
        }

        await verifyDir(dir);
        await saveDir(dir);
        return dir;
    };

    const readExisting = async (dir: FileSystemDirectoryHandle, path: string[]): Promise<Uint8Array | null> => {
        try {
            let current = dir;
            for (const part of path.slice(0, -1)) current = await current.getDirectoryHandle(part);
            const handle = await current.getFileHandle(path.at(-1)!);
            return new Uint8Array(await (await handle.getFile()).arrayBuffer());
        } catch {
            return null;
        }
    };

    const writeOne = async (dir: FileSystemDirectoryHandle, file: ZipFile) => {
        const name = fileKey(file);
        try {
            let current = dir;
            for (const part of file.path.slice(0, -1)) {
                current = await current.getDirectoryHandle(part, {create: true});
            }
            const handle = await current.getFileHandle(file.path.at(-1)!, {create: true});
            const writable = await handle.createWritable();
            try {
                const copy = new ArrayBuffer(file.data.byteLength);
                new Uint8Array(copy).set(file.data);
                await writable.write(copy);
                await writable.close();
            } catch (error) {
                await writable.abort().catch(() => undefined);
                throw error;
            }
        } catch (error) {
            throw new StepError(`쓰기 실패(${name})`, error);
        }
    };

    const reportProgress = (progress: WriteProgress) => {
        setStatus(`파일 쓰는 중… ${progress.done}/${progress.total} (변경 없는 ${progress.skipped}개 건너뜀)`);
    };

    const manifestVersionOf = (files: ZipFile[]): string => {
        const manifest = files.find((file) => fileKey(file) === "manifest.json");
        if (!manifest) return "";
        try {
            const version = JSON.parse(new TextDecoder().decode(manifest.data)).version;
            return typeof version === "string" ? version : "";
        } catch {
            return "";
        }
    };

    const installFiles = async (dir: FileSystemDirectoryHandle, files: ZipFile[], to: string) => {
        const result = await installSession({
            files,
            toVersion: to,
            savePending,
            clearPending,
            readExisting: (path) => readExisting(dir, path),
            writeOne: (file) => writeOne(dir, file),
            onProgress: reportProgress
        });
        if (result.aborted) return;

        setStatus(`${versionLine(running, to)} 업데이트 완료, 다시 로드합니다`);
        setTimeout(() => browser.runtime.reload(), 800);
    };

    const normalizePending = (value: PendingUpdate | null | undefined): PendingUpdate | null => {
        if (!value || !Array.isArray(value.files)) return value ?? null;
        return {
            version: value.version,
            files: value.files.map((file) => ({
                path: file.path,
                data: file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data)
            }))
        };
    };

    const init = async () => {
        const pending = normalizePending(await loadPending());
        const decision = pendingDecision(pending, running);
        if (decision === "clear") await clearPending();
        if (decision === "resume" && pending && resumeButton && versionEl) {
            versionEl.textContent = versionLine(running, pending.version);
            setStatus("이전 업데이트가 중간에 멈췄습니다. 아래 버튼을 눌러 마저 설치하세요.");
            resumeButton.hidden = false;
        }

        try {
            release = await checkLatestRelease(running, "chrome");
            if (decision === "resume") return;
            if (versionEl) versionEl.textContent = release.upToDate ? running : versionLine(running, release.latest);
            if (release.upToDate) {
                setStatus(release.message);
                return;
            }
            if (!release.assetUrl) {
                setStatus(release.message);
                setError("릴리스에 Chrome용 zip(*-chrome.zip)이 없습니다.");
                return;
            }
            setStatus("아래 버튼을 눌러 업데이트하세요.");
            if (startButton) startButton.disabled = false;
        } catch (error) {
            if (decision !== "resume") {
                setStatus("업데이트 정보를 가져오지 못했습니다.");
                setError(error instanceof Error ? error.message : "");
            }
        }
    };

    const showFail = (error: unknown) => {
        const cancel = error instanceof Error && error.name === "AbortError";
        setStatus(cancel ? "폴더 선택이 취소되었습니다." : "업데이트하지 못했습니다.");
        if (!cancel) {
            setError(error instanceof Error ? error.message : String(error));
        }
    };

    startButton?.addEventListener("click", async () => {
        if (!startButton || !release?.assetUrl) return;
        startButton.disabled = true;
        setError("");

        try {
            const dir = await getInstallDir(true);
            setStatus("새 버전 다운로드 중…");
            let bytes: ArrayBuffer;
            try {
                const response = await fetch(release.assetUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                bytes = await response.arrayBuffer();
            } catch (error) {
                throw new StepError("다운로드 실패", error);
            }

            setStatus("압축 해제 중…");
            let files: ZipFile[];
            try {
                files = await extractAll(bytes);
            } catch (error) {
                throw new StepError("압축 해제 실패", error);
            }

            const manifest = files.find((file) => fileKey(file) === "manifest.json");
            const text = manifest ? new TextDecoder().decode(manifest.data) : "";
            if (!isBongChromeManifest(text)) throw new Error("다운로드한 zip이 BongChrome가 아닙니다.");

            const to = manifestVersionOf(files) || release.latest;
            if (!canApplyVersion(running, to)) {
                throw new Error("다운로드한 버전이 지금 버전보다 높지 않습니다.");
            }

            await installFiles(dir, files, to);
        } catch (error) {
            showFail(error);
            startButton.disabled = false;
        }
    });

    resumeButton?.addEventListener("click", async () => {
        if (!resumeButton) return;
        resumeButton.disabled = true;
        setError("");

        try {
            const pending = normalizePending(await loadPending());
            if (pendingDecision(pending, running) !== "resume" || !pending) {
                setStatus("이어서 할 업데이트가 없습니다.");
                await clearPending();
                return;
            }

            const dir = await getInstallDir(true);
            await installFiles(dir, pending.files, pending.version);
        } catch (error) {
            showFail(error);
            resumeButton.disabled = false;
        }
    });

    void init();
}
