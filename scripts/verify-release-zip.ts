import {readFileSync} from "node:fs";
import {missingReachable} from "../src/core/update/installPlan";
import {manifestReferencedFiles} from "../src/core/update/manifestRefs";
import {EXTENSION_NAME, isBongChromeManifest} from "../src/core/update/release";
import {fileKey} from "../src/core/update/types";
import {extractAll} from "../src/core/update/zip";
import {CHZZK_SCRIPT_FILES} from "../src/modules/chzzk-register";

// BongChrome: manifest에 안 적혔지만 코드가 여는 페이지(팝업 iframe, 번역 설정)와 치지직 동적 콘텐츠 스크립트
const MODULE_PAGES = ["popup.html", "chzzk/popup.html", "trans/popup/popup.html", "trans/options/options.html", "dc.html", "options.html"];
const MODULE_FILES = [...CHZZK_SCRIPT_FILES, "trans/content/content.js"];

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
const expected = process.argv[2] || pkg.version;
const failures: string[] = [];

const fail = (message: string) => {
    failures.push(message);
};

if (process.argv[2] && process.argv[2] !== pkg.version) {
    fail(`tag ${process.argv[2]} does not match package.json ${pkg.version}`);
}

const htmlPages = (paths: Set<string>, manifest: Record<string, unknown>): string[] => {
    const pages = new Set<string>(["update.html", ...MODULE_PAGES]);
    for (const path of manifestReferencedFiles(manifest, [...paths])) {
        if (path.endsWith(".html")) pages.add(path);
    }
    return [...pages];
};

const checkZip = async (name: string) => {
    const path = `.output/${name}`;
    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(readFileSync(path));
    } catch {
        fail(`missing zip: ${path}`);
        return;
    }

    let files;
    try {
        files = await extractAll(bytes);
    } catch (error) {
        fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }

    const paths = new Set(files.map(fileKey));
    const manifestFile = files.find((file) => fileKey(file) === "manifest.json");
    const manifestText = manifestFile ? new TextDecoder().decode(manifestFile.data) : "";
    if (!isBongChromeManifest(manifestText)) {
        fail(`${name}: manifest name is not ${EXTENSION_NAME}`);
        return;
    }

    const manifest = JSON.parse(manifestText) as Record<string, unknown> & { version?: string };
    if (manifest.version !== expected) {
        fail(`${name}: manifest version ${manifest.version} !== ${expected}`);
    }

    for (const required of manifestReferencedFiles(manifest, [...paths])) {
        if (!paths.has(required)) fail(`${name}: missing in zip: ${required}`);
    }

    if (!paths.has("update.html")) fail(`${name}: missing in zip: update.html`);
    for (const required of [...MODULE_PAGES, ...MODULE_FILES]) {
        if (!paths.has(required)) fail(`${name}: missing module file: ${required}`);
    }
    if ("commands" in manifest) fail(`${name}: manifest still has commands (단축키는 모두 빼기로 함)`);
    if ("key" in manifest) fail(`${name}: manifest has a fixed key (새 확장 ID로 시작하기로 함)`);

    for (const missing of missingReachable(files, htmlPages(paths, manifest))) {
        fail(`${name}: missing referenced file: ${missing}`);
    }
};

await checkZip(`bongchrome-${expected}-chrome.zip`);

if (failures.length) {
    for (const message of failures) console.error(message);
    process.exit(1);
}

console.log(`release zip ok for ${expected}`);
