import "@/assets/styles/index.scss";
import "@/core/memo";
import "@/core/block";

import filter from "@/core/filtering";
import modules, {markModulesReady} from "@/core/modules";
import {migrateLocalStorageData} from "@/storage/migration";
import {ensureIpDataReady} from "@/utils/ip";

const moduleLoaders = import.meta.glob<{ default: RefresherModule }>([
    "./modules/*/index.ts",
    "./modules/*.ts"
]);

export default defineContentScript({
    matches: ["https://*.dcinside.com/*"],
    excludeMatches: [
        "https://event.dcinside.com/*",
        "https://h5.dcinside.com/*",
        "https://m.dcinside.com/*",
        "https://mall.dcinside.com/*",
        "https://wiki.dcinside.com/*",
        "https://gallog.dcinside.com/*"
    ],
    runAt: "document_start",
    async main() {
        // BongExtend: 디시 모듈 스위치가 꺼져 있으면 아무것도 하지 않는다.
        try {
            const stored = await browser.storage.local.get("core.modules");
            if ((stored["core.modules"] as Record<string, boolean> | undefined)?.dc === false) return;
        } catch {
            // 읽지 못하면 켠 것으로 본다.
        }

        try {
            await migrateLocalStorageData();
            await ensureIpDataReady();

            const loadedModules = await Promise.all(
                Object.values(moduleLoaders).map((loader) => loader().then((m) => m.default))
            );

            const allModules = loadedModules.filter((m): m is RefresherModule => m !== undefined);

            const results = await Promise.allSettled(allModules.map((module) => modules.load(module)));

            results.forEach((result, index) => {
                if (result.status === "rejected") {
                    console.error(`Failed to load module: ${allModules[index].name}`, result.reason);
                }
            });

            await filter.run();
        } finally {
            markModulesReady();
        }
    }
});