/**
 * 한국 /16 통신사 표.
 * 생성기(scripts/generate-ip-isp.ts)가 만든 JSON을 읽고, 화면에 보일 짧은 이름을 만든다.
 * 비중 80% 미만이면 이름 뒤에 ?, 라벨이 "혼합"이면 그대로 둔다.
 */

export const IP_ISP_REPO = "Baegovda/BongExtend";
export const IP_ISP_REF = "main";
export const IP_ISP_PATH = "src/data/ip-isp.json";

/** 이 퍼센트 이상이면 물음표 없이 통신사 이름만 보여 준다. */
export const HIGH_CONFIDENCE_PERCENT = 80;

export interface IpIspDatabase {
    v: 1;
    generated: string;
    notice?: string;
    entries: Record<string, IpIspEntry>;
}

/** [라벨, 비중(0–100), 종류(m/w/u/x), ...그 외 "이름|비중"] */
export type IpIspEntry = [string, number, string, ...string[]];

const KIND_TEXT: Record<string, string> = {
    m: "모바일",
    w: "유선",
    u: "유·무선 구분 어려움",
    x: "여러 기관이 섞여 있음"
};

// function 선언이라 번들이 모듈을 한 스코프로 합쳐도 호출보다 먼저 준비된다.
export function isIpIspDatabase(value: unknown): value is IpIspDatabase {
    if (!value || typeof value !== "object") return false;
    const row = value as Partial<IpIspDatabase>;
    return row.v === 1 && typeof row.generated === "string" && !!row.entries && typeof row.entries === "object";
}

export const prefixKey = (ip: string): string | null => {
    const match = ip.trim().match(/^(\d{1,3})\.(\d{1,3})(?:\.|$)/);
    if (!match) return null;

    const a = Number(match[1]);
    const b = Number(match[2]);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a > 255 || b > 255) return null;

    return `${a}.${b}`;
};

export const lookupPrefix = (db: IpIspDatabase, ip: string): IpIspEntry | null => {
    const key = prefixKey(ip);
    if (!key) return null;
    const entry = db.entries[key];
    return entry ?? null;
};

const formatHolder = (token: string): string => {
    const pipe = token.lastIndexOf("|");
    if (pipe <= 0) return token;
    const name = token.slice(0, pipe);
    const share = token.slice(pipe + 1);
    return share ? `${name} ${share}%` : name;
};

export const presentEntry = (entry: readonly unknown[]): {name: string; detail: string} | null => {
    if (entry.length < 3) return null;

    const label = entry[0];
    const share = entry[1];
    const kind = entry[2];
    if (typeof label !== "string" || label.length === 0) return null;
    if (typeof share !== "number" || !Number.isFinite(share)) return null;

    const others = entry.slice(3).filter((value): value is string => typeof value === "string" && value.length > 0);
    const mixed = label === "혼합";
    const name = mixed || share >= HIGH_CONFIDENCE_PERCENT ? label : `${label}?`;
    const parts: string[] = [];

    if (mixed) {
        parts.push(others.length > 0 ? `혼합 · ${others.map(formatHolder).join(" · ")}` : `혼합 · 최대 ${share}%`);
    } else {
        parts.push(`${label} ${share}%`);
        if (others.length > 0) parts.push(`그 외 ${others.map(formatHolder).join(" · ")}`);
    }

    const kindText = KIND_TEXT[typeof kind === "string" ? kind : ""] ?? "";
    if (kindText) parts.push(kindText);

    return {name, detail: parts.join(" · ")};
};

export const fetchRemoteIpIsp = async (): Promise<IpIspDatabase | null> => {
    const url = `https://api.github.com/repos/${IP_ISP_REPO}/contents/${IP_ISP_PATH}?ref=${IP_ISP_REF}`;
    const response = await fetch(url, {
        headers: {
            Accept: "application/vnd.github.raw+json",
            "User-Agent": "BongExtend-ip-isp"
        }
    });
    // 404·요청 한도 같은 HTTP 실패는 호출하는 쪽이 조용히 넘긴다.
    if (!response.ok) return null;

    const data: unknown = await response.json();
    return isIpIspDatabase(data) ? data : null;
};
