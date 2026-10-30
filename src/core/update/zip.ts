// 브라우저와 bun 테스트에서 같이 쓰는 zip 리더. stored(0)와 deflate(8)만 푼다.
import type {ZipFile} from "@/core/update/types";

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;
const ZIP64_MAGIC = 0xffffffff;

export type ZipEntry = {
    name: string;
    method: number;
    compSize: number;
    size: number;
    offset: number;
    isDir: boolean;
};

const asBytes = (buf: Uint8Array | ArrayBuffer): Uint8Array =>
    buf instanceof Uint8Array ? buf : new Uint8Array(buf);

const viewOf = (bytes: Uint8Array): DataView =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const need = (bytes: Uint8Array, offset: number, size: number) => {
    if (offset < 0 || size < 0 || offset + size > bytes.length) {
        throw new Error("zip이 잘렸습니다.");
    }
};

// zip-slip 방지. 안전한 상대 경로면 정규화된 조각, 아니면 null.
export const safePath = (name: string): string[] | null => {
    const normalized = String(name || "").replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized) || normalized.includes("\0")) {
        return null;
    }

    const parts = normalized.split("/").filter((part) => part !== "" && part !== ".");
    if (!parts.length || parts.some((part) => part === "..")) return null;
    return parts;
};

export const listEntries = (buf: Uint8Array | ArrayBuffer): ZipEntry[] => {
    const bytes = asBytes(buf);
    const view = viewOf(bytes);
    let eocd = -1;
    const min = Math.max(0, bytes.length - 22 - 65535);

    for (let index = bytes.length - 22; index >= min; index--) {
        need(bytes, index, 22);
        if (view.getUint32(index, true) === SIG_EOCD) {
            eocd = index;
            break;
        }
    }

    if (eocd < 0) throw new Error("zip 형식이 아닙니다.");

    const count = view.getUint16(eocd + 10, true);
    let cursor = view.getUint32(eocd + 16, true);
    if (view.getUint32(eocd + 12, true) === ZIP64_MAGIC || cursor === ZIP64_MAGIC) {
        throw new Error("zip64는 지원하지 않습니다.");
    }

    const decoder = new TextDecoder();
    const entries: ZipEntry[] = [];

    for (let index = 0; index < count; index++) {
        need(bytes, cursor, 46);
        if (view.getUint32(cursor, true) !== SIG_CEN) {
            throw new Error("zip 중앙 디렉터리가 손상되었습니다.");
        }

        const method = view.getUint16(cursor + 10, true);
        const compSize = view.getUint32(cursor + 20, true);
        const size = view.getUint32(cursor + 24, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const offset = view.getUint32(cursor + 42, true);
        if (compSize === ZIP64_MAGIC || size === ZIP64_MAGIC || offset === ZIP64_MAGIC) {
            throw new Error("zip64는 지원하지 않습니다.");
        }

        need(bytes, cursor + 46, nameLength);
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        entries.push({
            name,
            method,
            compSize,
            size,
            offset,
            isDir: name.endsWith("/")
        });
        cursor += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
};

const blobPart = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return copy;
};

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
    const stream = new Blob([blobPart(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

// 하나라도 실패하면 예외. 호출부는 그때 디스크에 아무것도 쓰지 않는다.
// 공통 최상위 폴더만 있고 루트에 manifest.json이 없으면 그 폴더를 벗긴다.
export const extractAll = async (buf: Uint8Array | ArrayBuffer): Promise<ZipFile[]> => {
    const bytes = asBytes(buf);
    const view = viewOf(bytes);
    const files: ZipFile[] = [];

    for (const entry of listEntries(bytes)) {
        const parts = safePath(entry.name);
        if (!parts) throw new Error(`안전하지 않은 경로가 zip에 있습니다: ${entry.name}`);
        if (entry.isDir) continue;

        need(bytes, entry.offset, 30);
        if (view.getUint32(entry.offset, true) !== SIG_LOC) {
            throw new Error(`zip 항목 헤더 손상: ${entry.name}`);
        }

        const nameLength = view.getUint16(entry.offset + 26, true);
        const extraLength = view.getUint16(entry.offset + 28, true);
        const start = entry.offset + 30 + nameLength + extraLength;
        need(bytes, start, entry.compSize);
        const raw = bytes.subarray(start, start + entry.compSize);
        let data: Uint8Array;

        if (entry.method === 0) data = raw.slice();
        else if (entry.method === 8) data = await inflateRaw(raw);
        else throw new Error(`지원하지 않는 압축 방식: ${entry.method}`);

        if (data.length !== entry.size) throw new Error(`압축 해제 크기 불일치: ${entry.name}`);
        files.push({path: parts, data});
    }

    if (!files.length) throw new Error("zip이 비어 있습니다.");

    const root = files[0].path[0];
    const hasRootManifest = files.some((file) => file.path.length === 1 && file.path[0] === "manifest.json");
    const wrapped = files.every((file) => file.path.length > 1 && file.path[0] === root);

    if (!hasRootManifest && wrapped) {
        files.forEach((file) => file.path.shift());
    }

    if (!files.some((file) => file.path.join("/") === "manifest.json")) {
        throw new Error("zip에 manifest.json이 없습니다.");
    }

    return files;
};
