// 업데이트 진행률 계산. 다운로드 0-60, 압축 해제 60-70, 파일 쓰기 70-100.
export type ProgressStage = "download" | "unzip" | "write" | "done";

export type ProgressView = {
    percent: number | null; // 전체 막대(0-100). null이면 진행 정도를 모름(움직이는 막대).
    label: string;
};

const RANGES: Record<ProgressStage, [number, number]> = {
    download: [0, 60],
    unzip: [60, 70],
    write: [70, 100],
    done: [100, 100]
};

export const formatBytes = (bytes: number): string => {
    const value = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)}KB`;
    return `${(value / (1024 * 1024)).toFixed(1)}MB`;
};

const ratioOf = (done: number, total: number | null | undefined): number | null => {
    if (!total || !Number.isFinite(total) || total <= 0) return null;
    return Math.min(1, Math.max(0, done / total));
};

/** 단계와 진행 수치로 전체 막대 퍼센트와 표시 문구를 만든다. */
export const computeProgress = (stage: ProgressStage, done = 0, total: number | null = null): ProgressView => {
    const [start, end] = RANGES[stage];
    const ratio = ratioOf(done, total);
    if (stage === "download") {
        if (ratio === null) return {percent: null, label: `다운로드 중… ${formatBytes(done)}`};
        const own = Math.floor(ratio * 100);
        return {
            percent: start + (end - start) * ratio,
            label: `다운로드 중… ${own}% (${formatBytes(done)} / ${formatBytes(total!)})`
        };
    }
    if (stage === "unzip") return {percent: start, label: "압축 푸는 중…"};
    if (stage === "write") {
        const r = ratio ?? 1; // 바뀐 파일이 0개면 쓰기 단계는 끝난 것
        const count = total ?? 0;
        return {
            percent: start + (end - start) * r,
            label: `파일 쓰는 중… ${done}/${count} (${Math.floor(r * 100)}%)`
        };
    }
    return {percent: 100, label: "업데이트 완료"};
};

/** 퍼센트가 뒤로 가지 않게 잡아 주는 추적기. */
export const createMonotonic = () => {
    let last = 0;
    return (percent: number | null): number | null => {
        if (percent === null) return null;
        last = Math.max(last, Math.min(100, percent));
        return last;
    };
};

/** Content-Length가 없거나 잘못됐으면 릴리스 API의 asset size를 쓴다. */
export const pickTotalBytes = (contentLength: string | null | undefined, assetSize: number | null | undefined): number | null => {
    const header = Number(contentLength);
    if (contentLength && Number.isFinite(header) && header > 0) return header;
    if (typeof assetSize === "number" && Number.isFinite(assetSize) && assetSize > 0) return assetSize;
    return null;
};

type ChunkReader = { read: () => Promise<{ done: boolean; value?: Uint8Array }> };

/** 스트림을 끝까지 읽어 하나의 ArrayBuffer로 합치며 진행 콜백을 부른다. */
export const readAllWithProgress = async (
    reader: ChunkReader,
    onChunk: (received: number) => void
): Promise<ArrayBuffer> => {
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.byteLength;
        onChunk(received);
    }
    const out = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return out.buffer;
};
