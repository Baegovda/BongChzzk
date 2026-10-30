import {describe, expect, test} from "bun:test";
import {computeProgress, createMonotonic, formatBytes, pickTotalBytes, readAllWithProgress} from "./progress";

describe("formatBytes", () => {
    test("KB/MB", () => {
        expect(formatBytes(512)).toBe("0.5KB");
        expect(formatBytes(3.1 * 1024 * 1024)).toBe("3.1MB");
        expect(formatBytes(-5)).toBe("0.0KB");
    });
});

describe("computeProgress", () => {
    test("download with total", () => {
        const view = computeProgress("download", 3.1 * 1048576, 7.4 * 1048576);
        expect(view.label).toBe("다운로드 중… 41% (3.1 / 7.4MB)".replace("3.1 /", "3.1MB /"));
        expect(view.percent!).toBeCloseTo(60 * 3.1 / 7.4);
    });
    test("download unknown total is indeterminate", () => {
        const view = computeProgress("download", 2 * 1048576, null);
        expect(view.percent).toBeNull();
        expect(view.label).toBe("다운로드 중… 2.0MB");
    });
    test("download clamps overshoot", () => expect(computeProgress("download", 20, 10).percent).toBe(60));
    test("unzip", () => expect(computeProgress("unzip")).toEqual({percent: 60, label: "압축 푸는 중…"}));
    test("write", () => {
        expect(computeProgress("write", 5, 10)).toEqual({percent: 85, label: "파일 쓰는 중… 5/10 (50%)"});
        expect(computeProgress("write", 0, 0).percent).toBe(100);
    });
    test("done", () => expect(computeProgress("done").percent).toBe(100));
});

describe("createMonotonic", () => {
    test("never goes back", () => {
        const m = createMonotonic();
        expect(m(30)).toBe(30);
        expect(m(10)).toBe(30);
        expect(m(null)).toBeNull();
        expect(m(150)).toBe(100);
    });
});

describe("pickTotalBytes", () => {
    test("header first, then asset size", () => {
        expect(pickTotalBytes("100", 50)).toBe(100);
        expect(pickTotalBytes(null, 50)).toBe(50);
        expect(pickTotalBytes("0", 50)).toBe(50);
        expect(pickTotalBytes("x", 0)).toBeNull();
    });
});

describe("readAllWithProgress", () => {
    test("concatenates and reports", async () => {
        const parts = [new Uint8Array([1, 2]), new Uint8Array([3])];
        const seen: number[] = [];
        const buf = await readAllWithProgress({
            read: async () => parts.length ? {done: false, value: parts.shift()} : {done: true}
        }, (n) => seen.push(n));
        expect([...new Uint8Array(buf)]).toEqual([1, 2, 3]);
        expect(seen).toEqual([2, 3]);
    });
});
