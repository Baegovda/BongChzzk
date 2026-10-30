import type {Nullable} from "./types";

import bundledJson from "@/data/ip-isp.json";
import {databaseStorage} from "@/storage/wxtStorage";
import {isIpIspDatabase, lookupPrefix, presentEntry, type IpIspDatabase} from "@/utils/ipIsp";

const COLOR = "#6495ed";

const emptyDatabase = (): IpIspDatabase => ({v: 1, generated: "", entries: {}});

// 모듈이 평가되는 동안 다른 파일의 함수를 부르지 않는다.
// 순환 import가 있으면 그 함수가 아직 값이 없어 서비스 워커가 시작 즉시 죽는다.
let ipDatabase: IpIspDatabase | null = null;
let ipDataReady: Promise<void> | null = null;

const readBundledDatabase = (): IpIspDatabase => (isIpIspDatabase(bundledJson) ? bundledJson : emptyDatabase());

const getIpDatabase = (): IpIspDatabase => {
    if (!ipDatabase) ipDatabase = readBundledDatabase();
    return ipDatabase;
};

const initIpData = (): Promise<void> => {
    if (!ipDataReady) {
        ipDataReady = (async () => {
            try {
                const stored: unknown = await databaseStorage.ip.getValue();
                if (
                    isIpIspDatabase(stored) &&
                    stored.generated > getIpDatabase().generated &&
                    Object.keys(stored.entries).length > 0
                ) {
                    ipDatabase = stored;
                }
            } catch (error) {
                console.error("IP 데이터베이스를 읽지 못했습니다.", error);
            }
        })();
    }
    return ipDataReady;
};

void initIpData();

export const ISPData = (ip: string): ISPInfo => {
    const entry = lookupPrefix(getIpDatabase(), ip);
    if (!entry) return {name: undefined, color: COLOR};

    const shown = presentEntry(entry);
    if (!shown) return {name: undefined, color: COLOR};

    return {
        name: shown.name,
        color: COLOR,
        detail: shown.detail
    };
};

export const format = (data: ISPInfo): Nullable<string> => data.name ?? null;

export const ensureIpDataReady = (): Promise<void> => initIpData();

export default {
    ISPData,
    format,
    ensureIpDataReady
};
