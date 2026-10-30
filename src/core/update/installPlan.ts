// 디스크에 쓰기 전에 결정하는 순수 로직.
// 크롬은 압축을 푼 확장 폴더가 바뀌면 확장을 다시 불러온다. manifest.json을 먼저 쓰면
// 나머지 파일이 디스크에 남기 전에 페이지가 죽는다. 그래서 세 단계로 쓴다.
// 1) 업데이트 페이지와 그 페이지가 읽는 파일
// 2) 나머지 파일
// 3) manifest.json 하나만, 맨 마지막
import {compareVersions} from "@/core/semver";
import {fileKey, type PendingDecision, type PendingUpdate, type ZipFile} from "@/core/update/types";

export type WriteProgress = {
    done: number;
    total: number;
    skipped: number;
};

const decoder = new TextDecoder();

const textOf = (file: ZipFile): string => decoder.decode(file.data);

export const bytesEqual = (left: Uint8Array | null | undefined, right: Uint8Array | null | undefined): boolean => {
    if (!left || !right || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) return false;
    }
    return true;
};

export const versionLine = (from: string, to: string): string => `${from} → ${to}`;

export const pendingDecision = (
    pending: PendingUpdate | null | undefined,
    runningVersion: string
): PendingDecision => {
    if (!pending) return "none";
    if (!pending.version || !Array.isArray(pending.files) || pending.files.length === 0) return "clear";

    const compared = compareVersions(pending.version, runningVersion);
    if (compared === null || compared <= 0) return "clear";
    return "resume";
};

// items를 limit개씩 병렬 처리. 한 묶음 안에서 오류가 나면 그 묶음은 끝까지 기다리고 다음 묶음은 시작하지 않는다.
export const inBatches = async <T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<void>
): Promise<void> => {
    if (limit < 1) throw new Error("batch limit");

    for (let index = 0; index < items.length; index += limit) {
        const slice = items.slice(index, index + limit);
        await Promise.all(slice.map((item, offset) => fn(item, index + offset)));
    }
};

const isExternal = (value: string): boolean =>
    value.startsWith("#") || value.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(value);

export const normalizeAssetPath = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || isExternal(trimmed)) return null;

    const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? "";
    const out: string[] = [];

    for (const part of noQuery.replace(/\\/g, "/").split("/")) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            if (!out.length) return null;
            out.pop();
            continue;
        }
        out.push(part);
    }

    return out.length ? out.join("/") : null;
};

export const resolveSpecifier = (fromFile: string, spec: string): string | null => {
    if (!spec.startsWith(".")) return null;

    const base = fromFile.split("/").slice(0, -1);
    const out: string[] = [];

    for (const part of [...base, ...spec.split("/")]) {
        if (part === "" || part === ".") continue;
        if (part === "..") {
            if (!out.length) return null;
            out.pop();
            continue;
        }
        out.push(part);
    }

    return out.length ? out.join("/") : null;
};

const resolveHtmlUrl = (fromHtml: string, raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || isExternal(trimmed)) return null;
    if (trimmed.startsWith("/")) return normalizeAssetPath(trimmed);
    return resolveSpecifier(fromHtml, trimmed.startsWith(".") ? trimmed : `./${trimmed}`);
};

export const htmlAssetRefs = (fromHtml: string, html: string): string[] => {
    const refs: string[] = [];
    const pattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html))) {
        const resolved = resolveHtmlUrl(fromHtml, match[1] ?? "");
        if (resolved) refs.push(resolved);
    }

    return refs;
};

export const jsModuleRefs = (fromFile: string, source: string): string[] => {
    const refs: string[] = [];
    const pattern = /(?:import\s*(?:[^'"\n;]*?\sfrom\s*)?|export\s+[^'"\n;]*?\sfrom\s*|import\s*\(\s*)["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source))) {
        const spec = match[1] ?? "";
        const resolved = resolveSpecifier(fromFile, spec);
        if (resolved) refs.push(resolved);
    }

    return refs;
};

export const cssUrlRefs = (fromFile: string, css: string): string[] => {
    const refs: string[] = [];
    const pattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(css))) {
        const resolved = resolveHtmlUrl(fromFile, match[1] ?? "");
        if (resolved) refs.push(resolved);
    }

    return refs;
};

const refsOf = (key: string, file: ZipFile): string[] => {
    const text = textOf(file);
    if (key.endsWith(".html")) return htmlAssetRefs(key, text);
    if (key.endsWith(".css")) return cssUrlRefs(key, text);
    if (key.endsWith(".js") || key.endsWith(".mjs")) return jsModuleRefs(key, text);
    return [];
};

// entryHtml에서 따라간 파일. zip에 실제로 있는 것만 포함한다.
export const collectReachable = (files: ZipFile[], entryHtml: string[]): Set<string> => {
    const byKey = new Map(files.map((file) => [fileKey(file), file]));
    const seen = new Set<string>();
    const queue = [...entryHtml];

    while (queue.length) {
        const key = queue.pop();
        if (!key || seen.has(key) || !byKey.has(key)) continue;
        seen.add(key);

        for (const ref of refsOf(key, byKey.get(key)!)) {
            if (byKey.has(ref)) queue.push(ref);
        }
    }

    return seen;
};

// HTML/JS/CSS가 가리키는데 zip에 없는 상대 경로.
export const missingReachable = (files: ZipFile[], entryHtml: string[]): string[] => {
    const byKey = new Map(files.map((file) => [fileKey(file), file]));
    const seen = new Set<string>();
    const missing: string[] = [];
    const queue = [...entryHtml];

    while (queue.length) {
        const key = queue.pop();
        if (!key || seen.has(key) || !byKey.has(key)) continue;
        seen.add(key);

        for (const ref of refsOf(key, byKey.get(key)!)) {
            if (byKey.has(ref)) queue.push(ref);
            else missing.push(ref);
        }
    }

    return missing;
};

export const collectPriorityKeys = (files: ZipFile[]): Set<string> =>
    collectReachable(files, ["update.html"]);

export const orderFiles = (files: ZipFile[], priority = collectPriorityKeys(files)): ZipFile[] => {
    const rank = (file: ZipFile): number => {
        const key = fileKey(file);
        if (key === "manifest.json") return 2;
        if (priority.has(key)) return 0;
        return 1;
    };

    return [...files].sort((left, right) => rank(left) - rank(right) || fileKey(left).localeCompare(fileKey(right)));
};

class StopWrite extends Error {
    constructor() {
        super("stop");
        this.name = "StopWrite";
    }
}

export const writeChangedFiles = async (options: {
    files: ZipFile[];
    readExisting: (path: string[]) => Promise<Uint8Array | null>;
    writeOne: (file: ZipFile) => Promise<void>;
    batchSize?: number;
    onProgress?: (progress: WriteProgress) => void;
    // 테스트에서 크롬이 그 파일을 쓰는 순간 리로드하는 것처럼, 쓰기 직전에 멈춘다.
    stopBefore?: (file: ZipFile) => boolean;
}): Promise<{ written: string[]; aborted: boolean; skipped: number }> => {
    const priorityKeys = collectPriorityKeys(options.files);
    const changed: ZipFile[] = [];

    for (const file of orderFiles(options.files, priorityKeys)) {
        const existing = await options.readExisting(file.path);
        if (!bytesEqual(existing, file.data)) changed.push(file);
    }

    const isManifest = (file: ZipFile) => fileKey(file) === "manifest.json";
    const priority = changed.filter((file) => priorityKeys.has(fileKey(file)) && !isManifest(file));
    const rest = changed.filter((file) => !priorityKeys.has(fileKey(file)) && !isManifest(file));
    const manifest = changed.filter(isManifest);
    const total = changed.length;
    const skipped = options.files.length - total;
    const written: string[] = [];
    let done = 0;
    let aborted = false;
    const batchSize = options.batchSize ?? 6;
    const report = () => options.onProgress?.({done, total, skipped});
    report();

    const runPhase = async (phase: ZipFile[]) => {
        if (aborted || phase.length === 0) return;

        try {
            await inBatches(phase, batchSize, async (file) => {
                if (options.stopBefore?.(file)) throw new StopWrite();
                await options.writeOne(file);
                written.push(fileKey(file));
                done += 1;
                report();
            });
        } catch (error) {
            if (error instanceof StopWrite) {
                aborted = true;
                return;
            }
            throw error;
        }
    };

    await runPhase(priority);
    await runPhase(rest);
    await runPhase(manifest);
    return {written, aborted, skipped};
};

// pending 저장이 첫 디스크 쓰기보다 먼저다. 전부 쓴 뒤에만 pending을 지운다.
// 중간에 확장이 다시 로드되면 pending이 남아 이어서 완료할 수 있다.
export const installSession = async (options: {
    files: ZipFile[];
    toVersion: string;
    savePending: (pending: PendingUpdate) => Promise<void>;
    clearPending: () => Promise<void>;
    readExisting: (path: string[]) => Promise<Uint8Array | null>;
    writeOne: (file: ZipFile) => Promise<void>;
    batchSize?: number;
    onProgress?: (progress: WriteProgress) => void;
    stopBefore?: (file: ZipFile) => boolean;
}): Promise<{ written: string[]; aborted: boolean; pendingCleared: boolean }> => {
    await options.savePending({version: options.toVersion, files: options.files});
    const result = await writeChangedFiles(options);
    if (result.aborted) return {...result, pendingCleared: false};

    await options.clearPending();
    return {...result, pendingCleared: true};
};
