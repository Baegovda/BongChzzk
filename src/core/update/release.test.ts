import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {extractChangelog} from "../../../scripts/extract-changelog";
import {manifestReferencedFiles} from "@/core/update/manifestRefs";
import {
    canApplyVersion,
    checkLatestRelease,
    describeUpdate,
    isBongExtendManifest,
    pickReleaseZip
} from "@/core/update/release";

describe("describeUpdate", () => {
    test("shows the current version, the latest version, and that an update is available", () => {
        expect(describeUpdate("5.2.20", "5.2.21")).toBe("5.2.20 → 5.2.21 업데이트 가능");
        expect(describeUpdate("5.2.20", "5.2.20")).toBe("최신 버전이에요. (5.2.20)");
        expect(describeUpdate("5.2.20", "v5.2.19")).toBe("최신 버전이에요. (5.2.20)");
        expect(describeUpdate("5.2.20", "")).toBe("최신 릴리스 버전을 읽지 못했어요.");
        expect(describeUpdate("5.2.20", "nope")).toBe("최신 릴리스 버전을 읽지 못했어요.");
    });

    test("canApplyVersion only allows a newer semver", () => {
        expect(canApplyVersion("5.2.20", "5.2.21")).toBe(true);
        expect(canApplyVersion("5.2.20", "5.2.20")).toBe(false);
        expect(canApplyVersion("5.2.21", "5.2.20")).toBe(false);
    });
});

describe("pickReleaseZip", () => {
    test("picks the browser zip and ignores the other one", () => {
        const assets = [
            {name: "bongextend-5.2.21-firefox.zip", browser_download_url: "ff"},
            {name: "bongextend-5.2.21-chrome.zip", browser_download_url: "cr"},
            {name: "bongextend-5.2.21-sources.zip", browser_download_url: "src"}
        ];
        expect(pickReleaseZip(assets, "chrome")?.browser_download_url).toBe("cr");
        expect(pickReleaseZip(assets, "firefox")?.browser_download_url).toBe("ff");
        expect(pickReleaseZip([{name: "notes.txt"}], "chrome")).toBeNull();
    });
});

describe("checkLatestRelease", () => {
    test("does not send a token and returns the chrome zip", async () => {
        let headers: Record<string, string> | undefined;
        const result = await checkLatestRelease("5.2.20", "chrome", {
            fetchImpl: async (_url, init) => {
                headers = init?.headers;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        tag_name: "v5.2.21",
                        html_url: "https://github.com/Baegovda/BongExtend/releases/tag/5.2.21",
                        assets: [{name: "bongextend-5.2.21-chrome.zip", browser_download_url: "https://example.invalid/chrome.zip", size: 7340032}]
                    })
                };
            }
        });

        expect(headers?.Authorization).toBeUndefined();
        expect(headers?.["User-Agent"]).toBe("BongExtend");
        expect(result.upToDate).toBe(false);
        expect(result.latest).toBe("5.2.21");
        expect(result.assetUrl).toBe("https://example.invalid/chrome.zip");
        expect(result.assetSize).toBe(7340032);
        expect(result.message).toBe("5.2.20 → 5.2.21 업데이트 가능");
    });

    test("404 is an error", async () => {
        await expect(checkLatestRelease("5.2.20", "chrome", {
            fetchImpl: async () => ({ok: false, status: 404, json: async () => ({})})
        })).rejects.toThrow(/HTTP 404/);
    });
});

describe("isBongExtendManifest", () => {
    test("accepts only the BongExtend manifest name", () => {
        expect(isBongExtendManifest('{"name":"BongExtend"}')).toBe(true);
        expect(isBongExtendManifest('{"name":"BongDC"}')).toBe(false);
        expect(isBongExtendManifest('{"name":"Other"}')).toBe(false);
        expect(isBongExtendManifest("nope")).toBe(false);
    });
});

describe("manifestReferencedFiles", () => {
    test("lists manifest files and fails a glob that matches nothing", () => {
        const manifest = {
            background: {service_worker: "background.js"},
            action: {default_popup: "popup.html", default_icon: {"16": "icons/16.png"}},
            icons: {"128": "icons/128.png"},
            options_ui: {page: "options.html"},
            content_scripts: [{js: ["content-scripts/content.js"], css: ["content-scripts/content.css"]}],
            web_accessible_resources: [{resources: ["assets/*.webp", "assets/icon.webp"], matches: ["<all_urls>"]}]
        };
        const zip = [
            "background.js",
            "popup.html",
            "icons/16.png",
            "icons/128.png",
            "options.html",
            "content-scripts/content.js",
            "content-scripts/content.css",
            "assets/icon.webp",
            "assets/logo.webp"
        ];
        expect(manifestReferencedFiles(manifest, zip).sort()).toEqual([
            "assets/icon.webp",
            "background.js",
            "content-scripts/content.css",
            "content-scripts/content.js",
            "icons/128.png",
            "icons/16.png",
            "options.html",
            "popup.html"
        ]);
        expect(manifestReferencedFiles(manifest, zip.filter((path) => !path.endsWith(".webp")))).toContain("assets/*.webp");
    });
});

describe("changelog", () => {
    test("the package version has a section", () => {
        const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
        const notes = extractChangelog(readFileSync("CHANGELOG.md", "utf8"), version);
        expect(notes.startsWith(`## [${version}]`)).toBe(true);
    });

    test("stops at the next version heading", () => {
        const notes = extractChangelog([
            "## [Unreleased]",
            "- 아직",
            "",
            "## [1.2.0] — 2026-01-01",
            "### Added",
            "- 하나",
            "",
            "## [1.1.0] — 2025-01-01",
            "- 이전"
        ].join("\n"), "1.2.0");
        expect(notes).toBe("## [1.2.0] — 2026-01-01\n### Added\n- 하나\n");
    });
});
