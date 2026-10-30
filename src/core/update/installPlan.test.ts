import {describe, expect, test} from "bun:test";
import {
    bytesEqual,
    collectPriorityKeys,
    cssUrlRefs,
    htmlAssetRefs,
    inBatches,
    installSession,
    jsModuleRefs,
    missingReachable,
    orderFiles,
    pendingDecision,
    versionLine,
    writeChangedFiles
} from "@/core/update/installPlan";
import {fileKey, type ZipFile} from "@/core/update/types";

const textFile = (path: string, text: string): ZipFile => ({
    path: path.split("/"),
    data: new TextEncoder().encode(text)
});

const sampleFiles = (): ZipFile[] => [
    textFile("manifest.json", '{"name":"BongExtend","version":"5.2.21"}'),
    textFile("content.js", "console.log(1)"),
    textFile("popup.html", '<script type="module" src="/chunks/popup.js"></script>'),
    textFile("chunks/popup.js", "console.log('popup')"),
    textFile("update.html", '<script type="module" src="/chunks/update-a.js"></script><link rel="stylesheet" href="assets/update.css">'),
    textFile("chunks/update-a.js", 'import "./vue.js";\nconsole.log("up")'),
    textFile("chunks/vue.js", "export const v = 1"),
    textFile("assets/update.css", "body{background:url(/assets/font.woff2)}"),
    textFile("assets/font.woff2", "font")
];

describe("asset refs", () => {
    test("reads html, js, and css links", () => {
        expect(htmlAssetRefs("update.html", '<script src="/chunks/update-a.js"></script><link href="./assets/update.css">')).toEqual([
            "chunks/update-a.js",
            "assets/update.css"
        ]);
        expect(jsModuleRefs("chunks/update-a.js", 'import { o as browser } from "./vue.js"; import("./x.js");')).toEqual([
            "chunks/vue.js",
            "chunks/x.js"
        ]);
        expect(jsModuleRefs("chunks/update-a.js", 'import"./vue.js"')).toEqual(["chunks/vue.js"]);
        expect(cssUrlRefs("assets/update.css", 'body{background:url("/assets/font.woff2")}')).toEqual(["assets/font.woff2"]);
    });
});

describe("orderFiles", () => {
    test("writes the update page first and manifest.json last", () => {
        const files = sampleFiles();
        const ordered = orderFiles(files).map(fileKey);
        const priority = [...collectPriorityKeys(files)].sort();
        expect(priority).toEqual([
            "assets/font.woff2",
            "assets/update.css",
            "chunks/update-a.js",
            "chunks/vue.js",
            "update.html"
        ]);
        expect(ordered.at(-1)).toBe("manifest.json");
        expect(ordered.slice(0, priority.length).sort()).toEqual(priority);
        expect(ordered.includes("popup.html")).toBe(true);
    });
});

describe("bytesEqual / pending / version", () => {
    test("compares bytes and ignores length mismatches", () => {
        expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
        expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
        expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
        expect(bytesEqual(null, new Uint8Array())).toBe(false);
    });

    test("resumes only when the pending version is newer", () => {
        const pending = {version: "5.2.21", files: [textFile("a.js", "a")]};
        expect(pendingDecision(null, "5.2.20")).toBe("none");
        expect(pendingDecision(pending, "5.2.20")).toBe("resume");
        expect(pendingDecision(pending, "5.2.21")).toBe("clear");
        expect(pendingDecision(pending, "5.2.22")).toBe("clear");
        expect(pendingDecision({version: "9.0.0", files: []}, "1.0.0")).toBe("clear");
        expect(pendingDecision({version: "nope", files: [textFile("a.js", "a")]}, "1.0.0")).toBe("clear");
    });

    test("formats the version line", () => {
        expect(versionLine("5.2.20", "5.2.21")).toBe("5.2.20 → 5.2.21");
    });
});

describe("inBatches", () => {
    test("limits parallelism and stops the next batch after an error", async () => {
        const seen: number[] = [];
        let active = 0;
        let max = 0;
        await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (_item, index) => {
            active += 1;
            max = Math.max(max, active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            seen.push(index);
            active -= 1;
        });
        expect(seen).toHaveLength(7);
        expect(max).toBeLessThanOrEqual(3);

        const started: number[] = [];
        await expect(inBatches([1, 2, 3], 2, async (item) => {
            started.push(item);
            await new Promise((resolve) => setTimeout(resolve, 2));
            if (item === 2) throw new Error("boom");
        })).rejects.toThrow(/boom/);
        expect(started).toEqual([1, 2]);
    });
});

describe("write order when chrome reloads", () => {
    const priorityOf = (files: ZipFile[]) => collectPriorityKeys(files);

    test("finishes the update page before other files, and manifest.json is the last write", async () => {
        const files = sampleFiles();
        const priority = priorityOf(files);
        const events: string[] = [];
        let inFlight = 0;
        let max = 0;

        const result = await writeChangedFiles({
            files,
            batchSize: 6,
            readExisting: async () => null,
            writeOne: async (file) => {
                inFlight += 1;
                max = Math.max(max, inFlight);
                await new Promise((resolve) => setTimeout(resolve, 4));
                events.push(fileKey(file));
                inFlight -= 1;
            }
        });

        expect(result.aborted).toBe(false);
        expect(events.at(-1)).toBe("manifest.json");
        expect(max).toBeLessThanOrEqual(6);

        const priorityEvents = events.filter((key) => priority.has(key));
        const restEvents = events.filter((key) => !priority.has(key) && key !== "manifest.json");
        const lastPriority = Math.max(...priorityEvents.map((key) => events.indexOf(key)));
        const firstRest = Math.min(...restEvents.map((key) => events.indexOf(key)));
        expect(lastPriority).toBeLessThan(firstRest);
        expect(events.indexOf("manifest.json")).toBe(events.length - 1);
    });

    test("a reload before manifest.json leaves the update page written and pending intact", async () => {
        const files = sampleFiles();
        const disk = new Map<string, Uint8Array>();
        const stored: { pending: { version: string; files: ZipFile[] } | null } = {pending: null};
        const log: string[] = [];

        const first = await installSession({
            files,
            toVersion: "5.2.21",
            savePending: async (value) => {
                stored.pending = value;
            },
            clearPending: async () => {
                stored.pending = null;
            },
            readExisting: async (path) => disk.get(path.join("/")) ?? null,
            writeOne: async (file) => {
                const key = fileKey(file);
                log.push(key);
                disk.set(key, file.data);
            },
            stopBefore: (file) => fileKey(file) === "content.js"
        });

        expect(first.aborted).toBe(true);
        expect(first.pendingCleared).toBe(false);
        expect(stored.pending?.version).toBe("5.2.21");
        expect(disk.has("update.html")).toBe(true);
        expect(disk.has("chunks/update-a.js")).toBe(true);
        expect(disk.has("manifest.json")).toBe(false);
        expect(log.includes("manifest.json")).toBe(false);
        expect(pendingDecision(stored.pending, "5.2.20")).toBe("resume");

        const secondLog: string[] = [];
        const second = await installSession({
            files: stored.pending!.files,
            toVersion: stored.pending!.version,
            savePending: async (value) => {
                stored.pending = value;
            },
            clearPending: async () => {
                stored.pending = null;
            },
            readExisting: async (path) => disk.get(path.join("/")) ?? null,
            writeOne: async (file) => {
                const key = fileKey(file);
                secondLog.push(key);
                disk.set(key, file.data);
            }
        });

        expect(second.aborted).toBe(false);
        expect(second.pendingCleared).toBe(true);
        expect(stored.pending).toBeNull();
        expect(secondLog.at(-1)).toBe("manifest.json");
        expect(secondLog.includes("update.html")).toBe(false);
        expect(disk.get("manifest.json")).toEqual(files[0]!.data);
        expect(pendingDecision({version: "5.2.21", files}, "5.2.21")).toBe("clear");
    });

    test("a write error does not clear pending and does not write manifest.json", async () => {
        const files = sampleFiles();
        let pending: unknown = null;
        let cleared = false;

        await expect(installSession({
            files,
            toVersion: "5.2.21",
            savePending: async (value) => {
                pending = value;
            },
            clearPending: async () => {
                cleared = true;
            },
            readExisting: async () => null,
            writeOne: async (file) => {
                if (fileKey(file) === "content.js") throw new Error("disk full");
            }
        })).rejects.toThrow(/disk full/);

        expect(pending).not.toBeNull();
        expect(cleared).toBe(false);
    });

    test("savePending runs before the first write", async () => {
        const order: string[] = [];
        await installSession({
            files: [textFile("update.html", "<p></p>"), textFile("manifest.json", "{}")],
            toVersion: "5.2.21",
            savePending: async () => {
                order.push("pending");
            },
            clearPending: async () => {
                order.push("clear");
            },
            readExisting: async () => null,
            writeOne: async () => {
                order.push("write");
            }
        });
        expect(order[0]).toBe("pending");
        expect(order.at(-1)).toBe("clear");
        expect(order.at(-2)).toBe("write");
    });
});

describe("missingReachable", () => {
    test("reports a chunk the html asks for when the zip does not have it", () => {
        const files = [textFile("update.html", '<script type="module" src="/chunks/missing.js"></script>')];
        expect(missingReachable(files, ["update.html"])).toEqual(["chunks/missing.js"]);
    });
});
