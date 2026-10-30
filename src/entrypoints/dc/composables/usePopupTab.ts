import {ref, watch} from "vue";
import {popupLastTabStorage} from "@/storage/wxtStorage";

export const POPUP_TABS = [
    {id: 0, label: "일반"},
    {id: 1, label: "고급"},
    {id: 2, label: "차단"},
    {id: 3, label: "메모"},
    {id: 4, label: "모듈"},
    {id: 6, label: "데이터"}
] as const;

export type PopupTabId = (typeof POPUP_TABS)[number]["id"];

const isValidPopupTab = (value: number): value is PopupTabId =>
    Number.isInteger(value) && value >= 0 && value < POPUP_TABS.length;

export const usePopupTab = () => {
    const tab = ref<PopupTabId>(0);

    void popupLastTabStorage.getValue().then((saved) => {
        if (isValidPopupTab(saved)) {
            tab.value = saved;
        }
    });

    watch(tab, (value) => {
        void popupLastTabStorage.setValue(value);
    });

    return {tab, tabs: POPUP_TABS};
};
