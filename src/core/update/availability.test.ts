import {describe, expect, test} from "bun:test";
import {deriveUpdateAvailable, isNewerVersion} from "./availability";

describe("deriveUpdateAvailable", () => {
    test("stale flag: latest older than current", () => expect(deriveUpdateAvailable(true, "1.0.2", "1.0.4")).toBe(false));
    test("same version", () => expect(deriveUpdateAvailable(true, "1.0.4", "1.0.4")).toBe(false));
    test("newer latest", () => expect(deriveUpdateAvailable(true, "1.0.5", "1.0.4")).toBe(true));
    test("v prefix", () => expect(deriveUpdateAvailable(true, "v1.0.5", "1.0.4")).toBe(true));
    test("stored false", () => expect(deriveUpdateAvailable(false, "1.0.5", "1.0.4")).toBe(false));
    test("unparsable", () => {
        expect(deriveUpdateAvailable(true, "abc", "1.0.4")).toBe(false);
        expect(deriveUpdateAvailable(true, "", "1.0.4")).toBe(false);
        expect(deriveUpdateAvailable(true, "1.0.5", "")).toBe(false);
    });
    test("isNewerVersion", () => {
        expect(isNewerVersion("1.0.5", "1.0.4")).toBe(true);
        expect(isNewerVersion("1.0.2", "1.0.4")).toBe(false);
    });
});
