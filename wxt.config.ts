import {defineConfig} from "wxt";
import {readdirSync, statSync} from "node:fs";
import {join, relative, resolve} from "node:path";

// BongExtend: 치지직(옛 BongChzzk)·번역(옛 BongTrans) 모듈은 빌드 없이 쓰는 순수 JS라서
// src/modules/{chzzk,trans} 파일을 그대로 결과물 chzzk/, trans/ 폴더에 복사한다. (테스트·배경 스크립트 제외)
const MODULE_ROOT = resolve(__dirname, "src/modules");
const STATIC_MODULES: Record<string, (rel: string) => boolean> = {
    chzzk: (rel) => !rel.startsWith("test/"),
    trans: (rel) => !rel.startsWith("test/") && rel !== "background.js"
};
const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
});
export const staticModuleFiles = () => Object.entries(STATIC_MODULES).flatMap(([name, keep]) => {
    const base = join(MODULE_ROOT, name);
    return listFiles(base)
        .map((full) => ({full, rel: relative(base, full).split("\\").join("/")}))
        .filter(({rel}) => keep(rel))
        .map(({full, rel}) => ({absoluteSrc: full, relativeDest: `${name}/${rel}`}));
});

export default defineConfig({
    srcDir: "src",
    // 기본 정규식 스캐너는 `(ip) =>` 같은 화살표 함수 매개변수를 utils/ip.ts 자동 import로 본다.
    // ipIsp.ts → ip.ts → ipIsp.ts 순환이 생기고, 배경 스크립트는 검증 함수가 생기기 전에 표를 읽어 바로 죽는다.
    imports: {
        parser: "oxc"
    },
    webExt: {
        startUrls: ["https://chzzk.naver.com", "https://gall.dcinside.com"]
    },
    hooks: {
        "build:publicAssets": (_wxt, files) => {
            files.push(...staticModuleFiles());
        }
    },
    modules: [
        "@wxt-dev/auto-icons",
        "@wxt-dev/webextension-polyfill",
        "@wxt-dev/module-vue"
    ],
    manifest: {
        name: "BongExtend",
        description: "치지직·디시인사이드 개선과 Gemini 페이지 번역을 하나로 합친 확장 프로그램 (BongChzzk + BongTrans + BongDC)",
        minimum_chrome_version: "109",
        action: {
            default_title: "BongExtend"
        },
        permissions: [
            "activeTab",
            "alarms",
            "contextMenus",
            "downloads",
            "notifications",
            "storage",
            "scripting",
            "tabs",
            "unlimitedStorage",
            "clipboardWrite"
        ],
        host_permissions: [
            "https://*.dcinside.com/*",
            "https://chzzk.naver.com/*",
            "https://api.chzzk.naver.com/*",
            "https://generativelanguage.googleapis.com/*",
            "https://api.github.com/*",
            "https://github.com/*",
            "https://objects.githubusercontent.com/*",
            "https://release-assets.githubusercontent.com/*"
        ],
        web_accessible_resources: [
            {
                resources: ["assets/*.webp"],
                matches: ["<all_urls>"]
            }
        ],
        browser_specific_settings: {
            gecko: {
                data_collection_permissions: {
                    required: ["none"]
                }
            }
        }
    }
});