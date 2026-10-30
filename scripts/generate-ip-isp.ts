/**
 * 한국 IPv4 /16 → 통신사 표를 만든다.
 *
 * 디시는 비로그인 글에 IP의 앞 두 옥텟(a.b)만 보여 준다.
 * 이 스크립트는 그 /16 안에서 주소 수로 가중해, 가장 큰 기관과 비중을 적는다.
 *
 * 출처 (재배포 가능한 것만):
 * - APNIC delegated-apnic-latest
 *   https://ftp.apnic.net/stats/apnic/delegated-apnic-latest
 *   조건: 자유롭게 받아 쓸 수 있다. APNIC은 정확성을 보장하지 않으며,
 *   이 파일은 자원이 처음 할당된 곳을 나타낼 뿐 현재 사용 위치의 공식 기록이 아니다.
 *   https://ftp.apnic.net/stats/apnic/README.TXT
 * - IPtoASN ip2asn-v4.tsv.gz (Public Domain Dedication and License 1.0)
 *   https://iptoasn.com/data/ip2asn-v4.tsv.gz
 *   접두사 → ASN, 국가, AS 설명. 원천 라우팅은 RouteViews BGP (CC BY 4.0).
 *   https://www.routeviews.org/routeviews/licenses/
 *
 * 쓰지 않는 출처:
 * - KISA/KRNIC WHOIS: 대량 조회를 막고, 결과물을 재배포해도 된다는 허락이 없다.
 * - RIPEstat 등 ripe.net 자료: 서면 허락 없이 제3자에게 제공할 수 없다.
 * - CAIDA pfx2as: Acceptable Use Agreement가 재배포를 분명히 허용하지 않는다.
 *
 * 한계: /16은 한 사람을 가리키지 못한다. VPN, CGNAT, KT 유·무선(같은 AS4766)은
 * 이 표만으로 가르지 못한다.
 *
 * 실행: bun scripts/generate-ip-isp.ts [--legacy path/to/old-ip.json]
 */

import {gunzipSync} from "node:zlib";
import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";

import {presentEntry} from "../src/utils/ipIsp";

const APNIC_URL = "https://ftp.apnic.net/stats/apnic/delegated-apnic-latest";
const IPTOASN_URL = "https://iptoasn.com/data/ip2asn-v4.tsv.gz";
const SLASH16 = 65536;
const USER_AGENT = "DCRefresher-ip-isp-generator/1.0 (+https://github.com/Baegovda/BongDC)";

const NOTICE =
    "Derived from APNIC delegated stats (ftp.apnic.net/stats/apnic/README.TXT; not a guarantee of current use) " +
    "and IPtoASN PDDL-1.0 (iptoasn.com), built from RouteViews BGP data (CC BY 4.0, www.routeviews.org). " +
    "A /16 label is not a person. VPN and CGNAT are not identified.";

type Kind = "m" | "w" | "u";

interface Org {
    label: string;
    kind: Kind;
    major: boolean;
}

interface OrgAcc {
    count: number;
    kind: Kind;
    major: boolean;
}

interface Bucket {
    delegated: number;
    ccKr: number;
    orgs: Map<string, OrgAcc>;
}

const major = (label: string, kind: Kind): Org => ({label, kind, major: true});
const minor = (label: string, kind: Kind): Org => ({label, kind, major: false});

/** 패턴으로 놓치거나 잘못 붙기 쉬운 ASN만 고정한다. 나머지는 설명 문자열로 맞춘다. */
const ASN_OVERRIDE: Record<number, Org> = {
    4766: major("KT", "u"),
    45400: major("KT", "u"),
    9318: major("SK브로드밴드", "w"),
    9644: major("SKT 모바일", "m"),
    3786: major("LG U+", "w"),
    17858: major("LG U+", "w"),
    9316: major("LG U+", "w"),
    17853: major("LG U+ 모바일", "m"),
    10036: major("딜라이브", "w"),
    9848: major("세종텔레콤", "u"),
    9457: major("드림라인", "w"),
    10171: major("SK텔링크", "u"),
    7557: minor("한국무역정보통신", "u"),
    152232: minor("KT클라우드", "u"),
    9947: minor("KT클라우드", "u")
};

const cleanOrg = (desc: string): string => {
    let text = desc.trim().replace(/\s+/g, " ");
    const parts = text.split(" ");
    if (parts.length > 1 && parts[0].includes("-") && /as/i.test(parts[0])) {
        text = parts.slice(1).join(" ");
    }

    text = text
        .replace(/\b(co\.?,?\s*ltd\.?|inc\.?|corp\.?|corporation|limited|ltd\.?|llc|pte\.?\s*ltd\.?)\b/gi, "")
        .replace(/[.,]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (text.length <= 16) return text || desc.slice(0, 16).trim();

    const words = text.split(" ");
    let shortened = words[0]?.slice(0, 16) ?? "";
    for (let index = 1; index < words.length; index++) {
        const next = `${shortened} ${words[index]}`;
        if (next.length > 16) break;
        shortened = next;
    }
    return shortened || desc.slice(0, 16).trim();
};

const classify = (asn: number, desc: string): Org => {
    const fixed = ASN_OVERRIDE[asn];
    if (fixed) return fixed;

    const blob = desc.toLowerCase();

    if (/kt[\s-]?cloud|\bktc-as\b|\bktcc-as\b/.test(blob)) return minor("KT클라우드", "u");
    if (/ktnet|korea trade network/.test(blob)) return minor("한국무역정보통신", "u");
    if (/sk broadband|\bskb-/.test(blob)) return major("SK브로드밴드", "w");
    if (/sk telecom|sktelecom/.test(blob)) return major("SKT 모바일", "m");
    if (/sktelink/.test(blob)) return major("SK텔링크", "u");
    if (/lgtelecom|lg telecom/.test(blob)) return major("LG U+ 모바일", "m");
    if (/hello ?vision|hellonet/.test(blob)) return major("LG헬로비전", "w");
    if (/powercomm|powervis|lg dacom|\bdacom-|lg uplus/.test(blob)) return major("LG U+", "w");
    if (/korea telecom|\bkornet\b|\bkixs-/.test(blob)) return major("KT", "u");
    if (/\bdlive\b|\bcnm-as\b/.test(blob)) return major("딜라이브", "w");
    if (/sejong/.test(blob)) return major("세종텔레콤", "u");
    if (/dreamline|\bdreamx-/.test(blob)) return major("드림라인", "w");
    if (/kakaobank/.test(blob)) return minor("카카오뱅크", "u");
    if (/kakaopay/.test(blob)) return minor("카카오페이", "u");
    if (/kakao/.test(blob)) return minor("카카오", "u");
    if (/naver/.test(blob)) return minor("네이버클라우드", "u");
    if (/samsungsds|samsung sds|samsungcloud/.test(blob)) return minor("삼성SDS", "u");
    if (/dreammark|\bmark1-/.test(blob)) return minor("드림마크원", "u");
    if (/smile ?serv/.test(blob)) return minor("스마일서브", "u");
    if (/\bkinx\b/.test(blob)) return minor("KINX", "u");
    if (/elimnet/.test(blob)) return minor("엘림넷", "u");
    if (/shinbiro/.test(blob)) return minor("신비로", "u");
    if (/\bdaou\b/.test(blob)) return minor("다우기술", "u");
    if (/lg cns|\blgnet-as\b|\blgcns\b/.test(blob)) return minor("LG CNS", "u");
    if (/national information resources|\bncia-/.test(blob)) return minor("국가정보자원관리원", "u");
    if (/kisti|kreonet/.test(blob)) return minor("KISTI", "u");

    // 한 /16을 실제로 가진 학교·연구소·케이블만 짧은 한글 이름으로 맞춘다.
    const named: Array<[RegExp, Org]> = [
        [/korea advanced institute|\bkaist\b/, minor("KAIST", "u")],
        [/seoul national university of education/, minor("서울교대", "u")],
        [/seoul national university bundang|\bsnubh\b/, minor("분당서울대병원", "u")],
        [/seoul national university/, minor("서울대", "u")],
        [/sungkyunkwan|\bskku\b/, minor("성균관대", "u")],
        [/pohang university|\bpostech\b/, minor("POSTECH", "u")],
        [/korea university of technology/, minor("한국기술교육대", "u")],
        [/korea university of media/, minor("한국영상대", "u")],
        [/kyung hee/, minor("경희대", "u")],
        [/sogang/, minor("서강대", "u")],
        [/pusan national/, minor("부산대", "u")],
        [/yonsei university health|\byonsei01\b/, minor("연세의료원", "u")],
        [/wonju severance/, minor("원주세브란스", "u")],
        [/yonsei/, minor("연세대", "u")],
        [/chung-ang/, minor("중앙대", "u")],
        [/yeungnam college/, minor("영남이공대", "u")],
        [/yeungnam/, minor("영남대", "u")],
        [/inha university/, minor("인하대", "u")],
        [/hanyang/, minor("한양대", "u")],
        [/dong-a univer/, minor("동아대", "u")],
        [/chonnam/, minor("전남대", "u")],
        [/chungnam national university hospital/, minor("충남대병원", "u")],
        [/chungnam national/, minor("충남대", "u")],
        [/kyungpook/, minor("경북대", "u")],
        [/kwangwoon/, minor("광운대", "u")],
        [/korea aerospace university/, minor("한국항공대", "u")],
        [/korea aerospace research/, minor("항우연", "u")],
        [/korea atomic energy/, minor("한국원자력연구원", "u")],
        [/electronics and telecommunications|\betri-as\b/, minor("ETRI", "u")],
        [/\bkepco\b|\bkepri\b/, minor("한전", "u")],
        [/kangnam cable|\bknctv\b/, minor("강남케이블", "u")],
        [/seokyung cable/, minor("서경방송", "u")],
        [/ulsan jung-ang|\bjcn-as\b/, minor("JCN울산", "u")],
        [/ulsan national institute/, minor("UNIST", "u")],
        [/university of ulsan/, minor("울산대", "u")],
        [/asianaidt|\basiana-as\b/, minor("아시아나IDT", "u")],
        [/connectwave|\bkoreacenter\b/, minor("커넥트웨이브", "u")],
        [/\biiac\b/, minor("인천공항공사", "u")],
        [/kx nexg|\bnexg-as\b/, minor("KX넥스지", "u")],
        [/itcenentec|\bsicc-as\b/, minor("아이티센엔텍", "u")],
        [/busan education/, minor("부산교육연구정보원", "u")],
        [/daewoo information|\bwoorifcapital\b|\bdisc-as\b/, minor("대우정보시스템", "u")],
        [/hanwha ocean|\bdsme\b/, minor("한화오션", "u")],
        [/korea institute of science and technology evaluation/, minor("KISTEP", "u")],
        [/korea institute of science and technology/, minor("KIST", "u")],
        [/korea institute for curriculum/, minor("한국교육과정평가원", "u")],
        [/korea institute of nuclear safety/, minor("원자력안전기술원", "u")],
        [/institute of fusion energy/, minor("핵융합에너지연구원", "u")],
        [/institute of machinery/, minor("기계연구원", "u")],
        [/institute of energy research/, minor("에너지기술연구원", "u")],
        [/radiological medical/, minor("원자력의학원", "u")],
        [/institute of industrial technology/, minor("생산기술연구원", "u")],
        [/institute of oriental medicine/, minor("한의학연구원", "u")],
        [/\bsk co\.?\b/, minor("SK주식회사", "u")],
        [/korea university/, minor("고려대", "u")]
    ];
    for (const [pattern, org] of named) {
        if (pattern.test(blob)) return org;
    }

    return minor(cleanOrg(desc), "u");
};

const ipToNum = (ip: string): number => {
    const parts = ip.split(".");
    if (parts.length !== 4) throw new Error(`잘못된 IPv4: ${ip}`);
    let value = 0;
    for (const part of parts) {
        const octet = Number(part);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) throw new Error(`잘못된 IPv4: ${ip}`);
        value = value * 256 + octet;
    }
    return value;
};

const forEachSlash = (start: number, end: number, fn: (key: string, count: number) => void): void => {
    let cursor = start;
    while (cursor < end) {
        const block = Math.floor(cursor / SLASH16);
        const boundary = (block + 1) * SLASH16;
        const next = end < boundary ? end : boundary;
        fn(`${Math.floor(block / 256)}.${block % 256}`, next - cursor);
        cursor = next;
    }
};

const download = async (url: string): Promise<{body: Uint8Array; lastModified: string}> => {
    const response = await fetch(url, {headers: {"User-Agent": USER_AGENT}});
    if (!response.ok) throw new Error(`${url} 다운로드 실패 (${response.status})`);
    return {
        body: new Uint8Array(await response.arrayBuffer()),
        lastModified: response.headers.get("last-modified") ?? ""
    };
};

interface AsnRange {
    start: number;
    end: number;
    asn: number;
    cc: string;
    desc: string;
}

const parseApnic = (text: string): {ranges: Array<[number, number]>; serial: string; krAddresses: number} => {
    const ranges: Array<[number, number]> = [];
    let serial = "";
    let krAddresses = 0;

    for (const line of text.split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("|");
        if (parts.length >= 3 && parts[0] === "2" && /^\d{8}$/.test(parts[2] ?? "")) {
            serial = parts[2];
        }
        if (parts.length < 7) continue;
        if (parts[1] !== "KR" || parts[2] !== "ipv4") continue;
        if (parts[6] !== "allocated" && parts[6] !== "assigned") continue;

        const start = ipToNum(parts[3]);
        const count = Number(parts[4]);
        if (!Number.isInteger(count) || count <= 0) continue;
        ranges.push([start, start + count]);
        krAddresses += count;
    }

    ranges.sort((a, b) => a[0] - b[0]);
    return {ranges, serial, krAddresses};
};

const parseIpToAsn = (text: string): AsnRange[] => {
    const ranges: AsnRange[] = [];
    let previousEnd = -1;

    for (const line of text.split("\n")) {
        if (!line) continue;
        const parts = line.split("\t");
        if (parts.length < 5) continue;

        const start = ipToNum(parts[0]);
        const end = ipToNum(parts[1]) + 1;
        const asn = Number(parts[2]);
        if (!Number.isInteger(asn) || end <= start) continue;
        if (previousEnd >= 0 && start < previousEnd) {
            throw new Error(`IPtoASN 구간이 겹칩니다: ${parts[0]}`);
        }
        previousEnd = end;

        ranges.push({
            start,
            end,
            asn,
            cc: parts[3],
            desc: parts.slice(4).join(" ").trim()
        });
    }

    return ranges;
};

const bucketOf = (buckets: Map<string, Bucket>, key: string): Bucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = {delegated: 0, ccKr: 0, orgs: new Map()};
        buckets.set(key, bucket);
    }
    return bucket;
};

const addOrg = (bucket: Bucket, org: Org, count: number): void => {
    const current = bucket.orgs.get(org.label);
    if (!current) {
        bucket.orgs.set(org.label, {count, kind: org.kind, major: org.major});
        return;
    }
    current.count += count;
    current.major = current.major || org.major;
    if (current.kind !== org.kind) current.kind = "u";
};

const isRelevant = (bucket: Bucket): boolean => bucket.delegated >= SLASH16 / 2 || bucket.ccKr >= SLASH16 / 2;

interface BuiltEntry {
    tuple: [string, number, string, ...string[]];
    major: boolean;
}

const buildEntry = (bucket: Bucket): BuiltEntry | null => {
    const labels = [...bucket.orgs.entries()].sort((a, b) => b[1].count - a[1].count);
    if (labels.length === 0) return null;

    const [topLabel, top] = labels[0];
    const second = labels[1]?.[1].count ?? 0;
    const topShare = top.count / SLASH16;
    const margin = (top.count - second) / SLASH16;
    const clear =
        topShare >= 0.8 ||
        (top.major && topShare >= 0.5 && margin >= 0.15) ||
        (!top.major && topShare >= 0.7 && margin >= 0.15);

    const percent = Math.floor((top.count * 100) / SLASH16);
    const holders = labels
        .filter(([label, org]) => org.count / SLASH16 >= 0.05 && (!clear || label !== topLabel))
        .slice(0, 3)
        .map(([label, org]) => `${label}|${Math.floor((org.count * 100) / SLASH16)}`);

    if (clear) {
        return {
            tuple: [topLabel, percent, top.kind, ...holders],
            major: top.major
        };
    }

    return {
        tuple: ["혼합", percent, "x", ...holders],
        major: false
    };
};

const legacyHeadline = (value: string): {headline: string; vpnOnly: boolean; multi: boolean} => {
    const parts = value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    const vpn = /vpn|미꾸라지|홀라|cloudflare|icloud|젠메이트|브라우섹/i;
    const real = parts.filter((part) => !vpn.test(part));
    const canon: Record<string, string> = {
        KT: "KT",
        "LGU+": "LG U+",
        "LG U+": "LG U+",
        SKT: "SKT 모바일",
        SKB: "SK브로드밴드",
        LG헬로비전: "LG헬로비전",
        네이버클라우드: "네이버클라우드",
        "삼성에스디에스(주)": "삼성SDS",
        "삼성SDS": "삼성SDS",
        "(주) 엘지씨엔에스": "LG CNS",
        딜라이브: "딜라이브",
        세종텔레콤: "세종텔레콤",
        한국인터넷진흥원: "KISA",
        주식회사케이아이엔엑스: "KINX",
        "주식회사 케이아이엔엑스": "KINX",
        "주식회사 카카오": "카카오",
        "(주)카카오": "카카오"
    };
    const headline = real[0] ?? parts[0] ?? "";
    return {
        headline: canon[headline] ?? headline,
        vpnOnly: parts.length > 0 && real.length === 0,
        multi: parts.length > 1
    };
};

const compareLegacy = async (
    entries: Record<string, [string, number, string, ...string[]]>
): Promise<void> => {
    const arg = process.argv.indexOf("--legacy");
    const path = arg >= 0 ? process.argv[arg + 1] : "";
    if (!path) return;

    const {readFile} = await import("node:fs/promises");
    const old = JSON.parse(await readFile(path, "utf8")) as Record<string, string>;
    const oldKeys = Object.keys(old);
    let same = 0;
    let changed = 0;
    let becameMixed = 0;
    let dropped = 0;
    let vpnDropped = 0;
    let added = 0;
    let overlap = 0;
    let multiNowSingle = 0;
    const transitions = new Map<string, number>();

    for (const key of oldKeys) {
        const legacy = legacyHeadline(old[key] ?? "");
        const next = entries[key];
        if (!next) {
            dropped++;
            if (legacy.vpnOnly) vpnDropped++;
            continue;
        }
        overlap++;
        const label = next[0];
        if (legacy.multi && label !== "혼합") multiNowSingle++;
        if (legacy.headline === label) {
            same++;
            continue;
        }
        if (label === "혼합") becameMixed++;
        else changed++;
        const transition = `${legacy.headline} → ${label}`;
        transitions.set(transition, (transitions.get(transition) ?? 0) + 1);
    }

    for (const key of Object.keys(entries)) {
        if (!(key in old)) added++;
    }

    const top = [...transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log("\n=== legacy comparison ===");
    console.log(
        JSON.stringify(
            {
                oldKeys: oldKeys.length,
                newKeys: Object.keys(entries).length,
                overlap,
                sameCanonical: same,
                changedSpecific: changed,
                becameMixed,
                dropped,
                vpnOnlyDropped: vpnDropped,
                added,
                multiOrgOldNowSingleIsp: multiNowSingle,
                topTransitions: top
            },
            null,
            2
        )
    );
};

const assertSanity = (entries: Record<string, [string, number, string, ...string[]]>): void => {
    const expect = (key: string, label: string, minShare: number): void => {
        const entry = entries[key];
        const shown = entry ? presentEntry(entry) : null;
        if (!entry || entry[0] !== label || entry[1] < minShare || !shown) {
            throw new Error(`검증 실패 ${key}: ${JSON.stringify(entry)} (기대 ${label} >= ${minShare})`);
        }
    };

    expect("39.7", "KT", 95);
    expect("175.223", "KT", 95);
    expect("221.146", "KT", 90);
    expect("223.38", "SKT 모바일", 95);
    expect("223.62", "SKT 모바일", 95);
    expect("27.160", "SKT 모바일", 95);
    expect("1.208", "LG U+", 95);
    expect("211.234", "혼합", 40);
    expect("211.36", "혼합", 20);

    const count = Object.keys(entries).length;
    if (count < 800 || count > 8000) throw new Error(`항목 수가 예상 밖입니다: ${count}`);

    for (const [key, entry] of Object.entries(entries)) {
        const shown = presentEntry(entry);
        if (!shown) throw new Error(`표시할 수 없는 항목: ${key}`);
        if (entry[0] !== "혼합" && entry[1] < 50) {
            throw new Error(`${key}의 ${entry[0]} 비중이 과반 미만인데 이름으로 적혔습니다.`);
        }
    }

    const kt = presentEntry(entries["39.7"]);
    if (kt?.name !== "KT") throw new Error(`39.7 표시가 KT가 아닙니다: ${kt?.name}`);
    const mixed = presentEntry(entries["211.234"]);
    if (mixed?.name !== "혼합") throw new Error("211.234는 혼합으로 보여야 합니다.");
};

const main = async (): Promise<void> => {
    console.log("APNIC, IPtoASN 받는 중");
    const [apnicFile, asnFile] = await Promise.all([download(APNIC_URL), download(IPTOASN_URL)]);
    const apnicText = new TextDecoder().decode(apnicFile.body);
    const asnText = new TextDecoder().decode(gunzipSync(asnFile.body));
    const apnic = parseApnic(apnicText);
    const asns = parseIpToAsn(asnText);
    console.log(`APNIC ${apnic.serial} KR ranges ${apnic.ranges.length} addresses ${apnic.krAddresses}`);
    console.log(`IPtoASN ranges ${asns.length} last-modified ${asnFile.lastModified}`);

    const buckets = new Map<string, Bucket>();
    for (const [start, end] of apnic.ranges) {
        forEachSlash(start, end, (key, count) => {
            bucketOf(buckets, key).delegated += count;
        });
    }

    for (const range of asns) {
        if (range.cc !== "KR" || range.asn === 0) continue;
        forEachSlash(range.start, range.end, (key, count) => {
            bucketOf(buckets, key).ccKr += count;
        });
    }

    const relevant = new Set<string>();
    for (const [key, bucket] of buckets) {
        if (isRelevant(bucket)) relevant.add(key);
    }

    for (const range of asns) {
        if (range.asn === 0) continue;
        const org = classify(range.asn, range.desc);
        forEachSlash(range.start, range.end, (key, count) => {
            if (!relevant.has(key)) return;
            addOrg(bucketOf(buckets, key), org, count);
        });
    }

    const entries: Record<string, [string, number, string, ...string[]]> = {};
    let high = 0;
    let low = 0;
    let mixed = 0;
    let labeledDelegated = 0;
    let highDelegated = 0;
    let lowDelegated = 0;
    let mixedDelegated = 0;
    const labelCounts = new Map<string, number>();

    for (const key of [...relevant].sort()) {
        const bucket = buckets.get(key);
        if (!bucket) continue;
        const built = buildEntry(bucket);
        if (!built) continue;
        entries[key] = built.tuple;
        const shown = presentEntry(built.tuple);
        const name = shown?.name ?? built.tuple[0];
        if (name === "혼합") mixed++;
        else if (name.endsWith("?")) low++;
        else high++;

        labeledDelegated += bucket.delegated;
        if (name === "혼합") mixedDelegated += bucket.delegated;
        else if (name.endsWith("?")) lowDelegated += bucket.delegated;
        else highDelegated += bucket.delegated;

        labelCounts.set(built.tuple[0], (labelCounts.get(built.tuple[0]) ?? 0) + 1);

        if (!built.major && built.tuple[0] !== "혼합" && built.tuple[1] < 70) {
            throw new Error(`${key} 작은 기관 ${built.tuple[0]} 비중이 ${built.tuple[1]}%입니다.`);
        }
    }

    assertSanity(entries);

    const generated = new Date().toISOString().slice(0, 10);
    const database = {
        v: 1 as const,
        generated,
        notice: NOTICE,
        entries
    };
    const total = high + low + mixed;
    const meta = {
        generated,
        apnicSerial: apnic.serial,
        iptoasnLastModified: asnFile.lastModified,
        krDelegatedAddresses: apnic.krAddresses,
        entries: total,
        high,
        low,
        mixed,
        highConfidenceEntryShare: total === 0 ? 0 : Math.round((high / total) * 1000) / 1000,
        krDelegatedAddressShareInLabeled16: Math.round((labeledDelegated / apnic.krAddresses) * 1000) / 1000,
        krDelegatedAddressShareInHigh16: Math.round((highDelegated / apnic.krAddresses) * 1000) / 1000,
        krDelegatedAddressShareInLow16: Math.round((lowDelegated / apnic.krAddresses) * 1000) / 1000,
        krDelegatedAddressShareInMixed16: Math.round((mixedDelegated / apnic.krAddresses) * 1000) / 1000,
        labels: Object.fromEntries([...labelCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)),
        sources: [
            {
                name: "APNIC delegated statistics",
                url: APNIC_URL,
                license: "APNIC conditions of use: free to download and use. No accuracy guarantee. Not an authoritative statement of where resources are currently used."
            },
            {
                name: "IPtoASN ip2asn-v4",
                url: IPTOASN_URL,
                license: "Public Domain Dedication and License (PDDL) 1.0"
            },
            {
                name: "RouteViews BGP (upstream of IPtoASN)",
                url: "https://www.routeviews.org/",
                license: "CC BY 4.0. Attribute RouteViews (www.routeviews.org)."
            }
        ],
        notUsed: [
            "KISA/KRNIC WHOIS: bulk queries are blocked and redistribution is not granted.",
            "RIPEstat and other ripe.net materials: reproduction for third parties needs written permission.",
            "CAIDA RouteViews pfx2as: CAIDA Acceptable Use Agreement does not clearly allow redistribution."
        ],
        method: {
            population: "Each Korea-relevant /16 (at least half of its addresses are in an APNIC KR allocation/assignment, or announced with IPtoASN country KR).",
            weight: "Organization share is announced addresses in that /16 divided by 65536, not by the Korean slice alone.",
            clearWin:
                "Name the top organization when its share is at least 80%, or it is a major ISP with share at least 50% and a 15 point lead, or any other organization with share at least 70% and a 15 point lead. Otherwise label 혼합.",
            majorIsps: ["KT", "SK브로드밴드", "LG U+", "LG U+ 모바일", "SKT 모바일", "LG헬로비전", "딜라이브", "세종텔레콤", "드림라인", "SK텔링크"],
            display: "Extension shows the name, adds ? when share is under 80, and shows 혼합 for mixed prefixes. Tooltip lists share and other holders at 5% or more (up to 3)."
        },
        limits: [
            "A /16 cannot identify a person or a single subscriber.",
            "VPN exit nodes and CGNAT are not labeled as VPN. Many customers share one prefix.",
            "KT wired and KT mobile are both often originated by AS4766, so they stay 'KT' with kind unknown.",
            "Some LG U+ mobile space is originated by the wired/backbone ASNs and is labeled LG U+, not LG U+ 모바일.",
            "Prefixes that are less than half Korean are omitted, so a thin Korean assignment inside a foreign /16 is not applied to everyone showing that a.b."
        ]
    };

    const root = join(import.meta.dir, "..");
    const dataDir = join(root, "src/data");
    await mkdir(dataDir, {recursive: true});
    const dataPath = join(dataDir, "ip-isp.json");
    const metaPath = join(dataDir, "ip-isp.meta.json");
    const body = `${JSON.stringify(database, null, 2)}\n`;
    if (body.length > 400_000) throw new Error(`데이터 파일이 너무 큽니다: ${body.length} bytes`);

    await writeFile(dataPath, body);
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`wrote ${dataPath} (${body.length} bytes)`);
    console.log(JSON.stringify({entries: total, high, low, mixed, highConfidenceEntryShare: meta.highConfidenceEntryShare}, null, 2));
    console.log("labels", meta.labels);
    await compareLegacy(entries);
};

await main();
