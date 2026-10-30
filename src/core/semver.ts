// GitHub 릴리스 태그(예: 5.2.10, v 접두사 없음)와 manifest 버전을 semver로 비교한다.

export type SemVer = {
    major: number;
    minor: number;
    patch: number;
    prerelease: Array<string | number>;
};

const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const parsePrerelease = (value: string | undefined): Array<string | number> | null => {
    if (!value) return [];

    const parts: Array<string | number> = [];

    for (const part of value.split(".")) {
        if (/^\d+$/.test(part)) {
            if (part.length > 1 && part.startsWith("0")) return null;
            parts.push(Number(part));
            continue;
        }

        if (!/^[0-9A-Za-z-]+$/.test(part)) return null;
        parts.push(part);
    }

    return parts;
};

export const parseSemver = (version: string): SemVer | null => {
    const match = version.trim().replace(/^v/i, "").match(SEMVER_PATTERN);
    if (!match) return null;

    const prerelease = parsePrerelease(match[4]);
    if (!prerelease) return null;

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease
    };
};

const compareIdentifiers = (left: string | number, right: string | number): number => {
    if (left === right) return 0;

    const leftNumber = typeof left === "number";
    const rightNumber = typeof right === "number";

    if (leftNumber && rightNumber) return left > right ? 1 : -1;
    if (leftNumber) return -1;
    if (rightNumber) return 1;
    return left > right ? 1 : -1;
};

const comparePrerelease = (left: Array<string | number>, right: Array<string | number>): number => {
    if (left.length === 0 && right.length === 0) return 0;
    if (left.length === 0) return 1;
    if (right.length === 0) return -1;

    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index++) {
        const a = left[index];
        const b = right[index];
        if (a === undefined) return -1;
        if (b === undefined) return 1;

        const diff = compareIdentifiers(a, b);
        if (diff !== 0) return diff;
    }

    return 0;
};

// 1: left가 더 높음, -1: right가 더 높음, 0: 같음. 형식이 아니면 null.
export const compareVersions = (left: string, right: string): number | null => {
    const a = parseSemver(left);
    const b = parseSemver(right);
    if (!a || !b) return null;

    if (a.major !== b.major) return a.major > b.major ? 1 : -1;
    if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
    if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
    return comparePrerelease(a.prerelease, b.prerelease);
};
