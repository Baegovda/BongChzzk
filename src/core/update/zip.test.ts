import {describe, expect, test} from "bun:test";
import {deflateRawSync} from "node:zlib";
import {extractAll, listEntries, safePath} from "@/core/update/zip";

const crc32 = (bytes: Uint8Array): number => {
    let crc = ~0;
    for (const value of bytes) {
        let code = (crc ^ value) & 0xff;
        for (let bit = 0; bit < 8; bit++) {
            code = code & 1 ? (code >>> 1) ^ 0xedb88320 : code >>> 1;
        }
        crc = (crc >>> 8) ^ code;
    }
    return ~crc >>> 0;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

const makeZip = (entries: Array<{ name: string; data?: Uint8Array; deflate?: boolean }>): Uint8Array => {
    const locals: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const name = new TextEncoder().encode(entry.name);
        const data = entry.data ?? new Uint8Array();
        const compressed = entry.deflate ? deflateRawSync(data) : data;
        const method = entry.deflate ? 8 : 0;
        const local = new Uint8Array(30);
        const localView = new DataView(local.buffer);
        localView.setUint32(0, 0x04034b50, true);
        localView.setUint16(4, 20, true);
        localView.setUint16(8, method, true);
        localView.setUint32(14, crc32(data), true);
        localView.setUint32(18, compressed.length, true);
        localView.setUint32(22, data.length, true);
        localView.setUint16(26, name.length, true);

        const cen = new Uint8Array(46);
        const cenView = new DataView(cen.buffer);
        cenView.setUint32(0, 0x02014b50, true);
        cenView.setUint16(4, 20, true);
        cenView.setUint16(6, 20, true);
        cenView.setUint16(10, method, true);
        cenView.setUint32(16, crc32(data), true);
        cenView.setUint32(20, compressed.length, true);
        cenView.setUint32(24, data.length, true);
        cenView.setUint16(28, name.length, true);
        cenView.setUint32(42, offset, true);

        locals.push(local, name, compressed);
        central.push(cen, name);
        offset += 30 + name.length + compressed.length;
    }

    const directory = concat(central);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, directory.length, true);
    endView.setUint32(16, offset, true);
    return concat([...locals, directory, end]);
};

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe("safePath", () => {
    test("keeps a normal relative path", () => {
        expect(safePath("lib/zip.js")).toEqual(["lib", "zip.js"]);
        expect(safePath("./a//b")).toEqual(["a", "b"]);
    });

    test("rejects zip-slip and absolute paths", () => {
        expect(safePath("../evil.js")).toBeNull();
        expect(safePath("lib/../../x")).toBeNull();
        expect(safePath("/etc/passwd")).toBeNull();
        expect(safePath("C:/x")).toBeNull();
        expect(safePath("..\\x")).toBeNull();
        expect(safePath("")).toBeNull();
        expect(safePath("a/\0b")).toBeNull();
    });
});

describe("extractAll", () => {
    test("reads stored and deflate entries and skips directories", async () => {
        const big = new TextEncoder().encode("console.log(1);\n".repeat(200));
        const zip = makeZip([
            {name: "manifest.json", data: new TextEncoder().encode('{"name":"BongChrome"}')},
            {name: "lib/"},
            {name: "lib/a.js", data: big, deflate: true}
        ]);

        expect(listEntries(zip)).toHaveLength(3);
        const files = await extractAll(zip);
        expect(files.map((file) => file.path.join("/"))).toEqual(["manifest.json", "lib/a.js"]);
        expect(decode(files[1]!.data)).toBe(decode(big));
    });

    test("strips a single top folder when manifest.json is inside it", async () => {
        const files = await extractAll(makeZip([
            {name: "bongdc/manifest.json", data: new TextEncoder().encode("{}")},
            {name: "bongdc/icons/i.png", data: new TextEncoder().encode("x"), deflate: true}
        ]));
        expect(files.map((file) => file.path.join("/"))).toEqual(["manifest.json", "icons/i.png"]);
    });

    test("reads a zip copied into a non-zero byte offset", async () => {
        const zip = makeZip([{name: "manifest.json", data: new TextEncoder().encode('{"name":"BongChrome"}')}]);
        const padded = new Uint8Array(zip.length + 8);
        padded.set(zip, 8);
        const files = await extractAll(padded.subarray(8));
        expect(files.map((file) => file.path.join("/"))).toEqual(["manifest.json"]);
    });

    test("rejects zip-slip, a missing manifest, and a truncated buffer", async () => {
        await expect(extractAll(makeZip([
            {name: "manifest.json", data: new TextEncoder().encode("{}")},
            {name: "../x.js", data: new TextEncoder().encode("x")}
        ]))).rejects.toThrow(/안전하지 않은/);
        await expect(extractAll(makeZip([
            {name: "a.js", data: new TextEncoder().encode("x")}
        ]))).rejects.toThrow(/manifest/);
        expect(() => listEntries(new Uint8Array(10))).toThrow(/zip/);
    });
});
