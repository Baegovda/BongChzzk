import {inject} from "vue";
import type {useBlocks} from "./composables/useBlocks";
import type {useData} from "./composables/useData";
import type {useMemos} from "./composables/useMemos";
import type {useSettings} from "./composables/useSettings";

export type BlocksApi = ReturnType<typeof useBlocks>;
export type DataApi = ReturnType<typeof useData>;
export type MemosApi = ReturnType<typeof useMemos>;
export type SettingsApi = ReturnType<typeof useSettings>;

const required = <T>(key: string): T => {
    const value = inject<T>(key);
    if (value == null) throw new Error(`missing provide: ${key}`);
    return value;
};

export const injectBlocks = (): BlocksApi => required("blocks");
export const injectData = (): DataApi => required("data");
export const injectMemos = (): MemosApi => required("memos");
export const injectSettings = (): SettingsApi => required("settings");
