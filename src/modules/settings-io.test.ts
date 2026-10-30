import {describe, expect, test} from "bun:test";
// WXT 자동 import(storage)가 테스트에는 없어서 가짜를 먼저 둔다.
(globalThis as Record<string, unknown>).storage ??= {defineItem: () => ({})};
const {applyImport, buildExport, planImport} = await import("./settings-io");

const memArea = (init: Record<string, unknown> = {}) => {
    const data: Record<string, unknown> = {...init};
    return {
        data,
        get: async () => ({...data}),
        set: async (o: Record<string, unknown>) => { Object.assign(data, o); },
        remove: async (keys: string[]) => { for (const k of keys) delete data[k]; }
    };
};

describe("settings import", () => {
    test("old BongTrans file goes to trans.settings", () => {
        const plan = planImport(JSON.stringify({type: "page-translator-settings", version: 1, settings: {apiKey: "k", targetLanguage: "ja"}}));
        expect((plan.local["trans.settings"] as {apiKey: string}).apiKey).toBe("k");
        expect(plan.dcReplace).toBeNull();
    });

    test("old BongDC data replaces only dc keys", async () => {
        const local = memArea({"trans.settings": {apiKey: "keep"}, "chzzk.recoverCount": 3, "refresher:block:NICK": ["old"], "refresher:database:ip": {x: 1}});
        const sync = memArea();
        const plan = planImport(JSON.stringify({"refresher:block:NICK": ["new"]}));
        await applyImport(plan, local, sync);
        expect(local.data["refresher:block:NICK"]).toEqual(["new"]);
        expect(local.data["trans.settings"]).toEqual({apiKey: "keep"});
        expect(local.data["chzzk.recoverCount"]).toBe(3);
        expect(local.data["refresher:database:ip"]).toEqual({x: 1});
    });

    test("BongChzzk-style object goes to chzzk.* sync", () => {
        const plan = planImport(JSON.stringify({watchList: [{id: "a"}], enabled: false}));
        expect(plan.sync["chzzk.watchList"]).toEqual([{id: "a"}]);
        expect(plan.sync["chzzk.enabled"]).toBe(false);
    });

    test("BongExtend export round-trips", async () => {
        const local = {"trans.settings": {apiKey: "k"}, "chzzk.recoverCount": 2, "refresher:memo:UID": {a: 1}, "core.modules": {chzzk: true, trans: false, dc: true}};
        const sync = {"chzzk.vivid": false};
        const out = buildExport(local, sync);
        const l2 = memArea(), s2 = memArea();
        const labels = await applyImport(planImport(JSON.stringify(out)), l2, s2);
        expect(labels).toEqual(["치지직", "번역", "디시"]);
        expect(s2.data["chzzk.vivid"]).toBe(false);
        expect(l2.data["chzzk.recoverCount"]).toBe(2);
        expect(l2.data["refresher:memo:UID"]).toEqual({a: 1});
        expect(l2.data["core.modules"]).toEqual({chzzk: true, trans: false, dc: true});
    });

    test("unknown data is rejected", () => {
        expect(() => planImport("nope")).toThrow();
        expect(() => planImport(JSON.stringify({foo: 1}))).toThrow();
    });
});
