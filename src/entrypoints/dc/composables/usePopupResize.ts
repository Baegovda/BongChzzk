import {onMounted, ref, watch} from "vue";
import {popupHeightStorage} from "@/storage/wxtStorage";

export const POPUP_HEIGHT_MIN = 360;
export const POPUP_HEIGHT_DEFAULT = 480;

const clampHeight = (value: number) =>
    Math.max(POPUP_HEIGHT_MIN, Math.round(value));

export const usePopupResize = () => {
    const height = ref(POPUP_HEIGHT_DEFAULT);

    onMounted(async () => {
        const saved = await popupHeightStorage.getValue();
        if (saved) {
            height.value = clampHeight(saved);
        }
    });

    watch(height, (value) => {
        void popupHeightStorage.setValue(clampHeight(value));
    });

    const startResize = (event: PointerEvent) => {
        event.preventDefault();

        const startY = event.clientY;
        const startHeight = height.value;

        const onMove = (moveEvent: PointerEvent) => {
            height.value = clampHeight(startHeight + (moveEvent.clientY - startY));
        };

        const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);
        };

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    };

    return {
        height,
        startResize
    };
};
