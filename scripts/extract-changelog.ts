import {readFileSync} from "node:fs";

export const extractChangelog = (markdown: string, version: string): string => {
    const lines = String(markdown).split(/\r?\n/);
    const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
    if (start < 0) {
        throw new Error(`CHANGELOG.md has no section for ${version}`);
    }

    let end = lines.length;
    for (let index = start + 1; index < lines.length; index++) {
        if (lines[index]?.startsWith("## [")) {
            end = index;
            break;
        }
    }

    return `${lines.slice(start, end).join("\n").trim()}\n`;
};

const invoked = process.argv[1]?.endsWith("extract-changelog.ts");
if (invoked) {
    const version = process.argv[2];
    const file = process.argv[3] || "CHANGELOG.md";
    if (!version) {
        console.error("usage: extract-changelog.ts <version> [changelog]");
        process.exit(1);
    }
    process.stdout.write(extractChangelog(readFileSync(file, "utf8"), version));
}
