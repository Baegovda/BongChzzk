import {defineExtensionMessaging} from "@webext-core/messaging";
import type {ExtensionUpdateStatus, UpdateApplyResult} from "@/core/updateCheck";

// ===== Content → Background =====

interface BroadcastPayload<TType extends string, TData = unknown> {
    type: TType;
    data?: TData;
}

type BroadcastResult = { success: boolean; sentTo?: number; error?: unknown };

// ===== Background → Content (탭 브로드캐스트 결과는 무시) =====

// 모든 broadcast 메시지 타입을 ProtocolMap에 명시
interface ProtocolMap {
    // Popup/Content → Background: 탭 전체 브로드캐스트 요청
    broadcast(data: BroadcastPayload<string>): BroadcastResult;

    // Popup → Content(활성 탭): 모듈 활성화 토글
    updateModuleStatus(data: { name: string; value: boolean }): void;

    // Popup → Content(활성 탭): 설정값 변경 전파
    updateSettingValue(data: { name: string; key: string; value: string | number | boolean }): void;

    // Background → Content: 단축키 실행 (broadcast로 전달됨)
    executeShortcut(data: string): void;

    // Background → Content: 컨텍스트 메뉴 - 유저 차단
    blockSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 유저 메모
    memoSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 디시콘 차단
    dcconSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - 디시콘 전체 차단
    dcconAllSelected(): void;

    // Background → Content: 컨텍스트 메뉴 - SauceNao 검색
    searchSauceNao(): void;

    // Popup → Content(활성 탭): 모듈 스키마 요청
    getSchema(): ModuleSchemaMap;

    // Popup → Content(활성 탭): 메모 입력 요청
    refresherRequestMemoAsk(data: { type: RefresherMemoType; user: string }): void;

    // Popup/Background: GitHub 릴리스 업데이트
    getUpdateStatus(): ExtensionUpdateStatus;
    checkForUpdate(data?: { force?: boolean }): ExtensionUpdateStatus;
    applyUpdate(): UpdateApplyResult;
    setUpdateAutoCheck(data: { enabled: boolean }): ExtensionUpdateStatus;

    // Popup → Background: 확장 프로그램 관리 페이지 (chrome://, about:)
    openExtensionsPage(): { ok: boolean; error?: string };
}

const {sendMessage: sendExtensionMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();

export {onMessage};

type ExtensionSend = typeof sendExtensionMessage;

type TabReply = { res?: unknown; err?: { message?: string } | null };

interface ChromeMessaging {
    runtime?: { lastError?: { message?: string } };
    tabs?: {
        sendMessage: (
            tabId: number,
            message: unknown,
            options: { frameId: number },
            callback: (response?: TabReply) => void
        ) => void;
    };
}

const chromeMessaging = (): ChromeMessaging => {
    return (globalThis as { chrome?: ChromeMessaging }).chrome ?? {};
};

let messageId = Math.floor(Math.random() * 10000);

const nextMessageId = () => messageId++;

/** 콘텐츠 스크립트가 없는 탭/프레임에 보냈을 때 나는 연결 오류. 콘솔에 남기면 확장 프로그램 오류로 뜬다. */
export const isMissingReceiverError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return (
        message.includes("Receiving end does not exist") ||
        message.includes("Could not establish connection") ||
        message.includes("No response") ||
        message.includes("message port closed")
    );
};

/**
 * 탭으로 보낼 때는 맨 위 프레임만 지정한다.
 * frameId 없이 보내면 광고 iframe마다 수신자가 없어 lastError가 남고, 응답도 undefined가 된다.
 * 콜백에서 lastError를 읽어야 Unchecked runtime.lastError가 안 뜬다.
 */
export const sendToContentTab = (type: string, data: unknown, tabId: number): Promise<unknown> => {
    const message = {
        id: nextMessageId(),
        type,
        data,
        timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
        const chromeApi = chromeMessaging();
        if (!chromeApi.tabs?.sendMessage) {
            reject(new Error("Could not establish connection. Receiving end does not exist."));
            return;
        }

        chromeApi.tabs.sendMessage(tabId, message, {frameId: 0}, (response) => {
            const lastError = chromeApi.runtime?.lastError;
            if (lastError) {
                reject(new Error(lastError.message || "Could not establish connection. Receiving end does not exist."));
                return;
            }

            if (response == null) {
                reject(new Error("No response"));
                return;
            }

            if (response.err != null) {
                reject(new Error(response.err.message || "No response"));
                return;
            }

            resolve(response.res);
        });
    });
};

export const sendMessage: ExtensionSend = ((type: string, ...args: unknown[]) => {
    const data = args.length > 0 ? args[0] : undefined;
    const tabId = args.length > 1 ? args[1] : undefined;

    if (typeof tabId === "number") {
        return sendToContentTab(type, data, tabId);
    }

    if (args.length === 0) {
        return sendExtensionMessage(type as never);
    }

    return sendExtensionMessage(type as never, data as never);
}) as ExtensionSend;

export type {BroadcastPayload, BroadcastResult};