// 업데이트 zip을 메모리에서 푼 파일. path는 zip-slip을 거친 상대 경로.
export type ZipFile = {
    path: string[];
    data: Uint8Array;
};

export type PendingUpdate = {
    version: string;
    files: ZipFile[];
};

export type PendingDecision = "resume" | "clear" | "none";

export const fileKey = (file: { path: string[] }): string => file.path.join("/");
