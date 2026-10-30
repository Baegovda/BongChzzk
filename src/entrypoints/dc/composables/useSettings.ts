import {moduleEnableStorage, moduleSchemaStorage, moduleSettingStorage} from "@/storage/wxtStorage";
import {isMissingReceiverError, sendMessage} from "@/http/messaging";
import {findDcContentTab, isDcContentScriptUrl} from "@/utils/dcinsideTab";
import {computed, nextTick, onMounted, ref} from "vue";

export type SettingsLoadState = "loading" | "no-tab" | "no-response" | "ready";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const hasSchema = (schema: ModuleSchemaMap | null | undefined): schema is ModuleSchemaMap => {
    return !!schema && Object.keys(schema).length > 0;
};

const readCachedSchema = async (): Promise<ModuleSchemaMap | null> => {
    try {
        const fromBackground = await sendMessage("getSchema");
        if (hasSchema(fromBackground)) return fromBackground;
    } catch (error) {
        if (!isMissingReceiverError(error)) {
            console.error("Failed to load module schema:", error);
        }
    }

    try {
        const stored = await moduleSchemaStorage.getValue();
        if (hasSchema(stored)) return stored;
    } catch (error) {
        if (!isMissingReceiverError(error)) {
            console.error("Failed to load module schema:", error);
        }
    }

    return null;
};

const requestSchema = async (tabId: number, attempts = 5): Promise<ModuleSchemaMap | null> => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const schema = await sendMessage("getSchema", undefined, tabId);
            if (hasSchema(schema)) return schema;
        } catch (error) {
            if (!isMissingReceiverError(error)) {
                console.error("Failed to load module schema:", error);
                break;
            }
        }

        await sleep(250);
    }

    return readCachedSchema();
};

export function useSettings() {
    const modules = ref<ModuleSchemaMap>({});
    const settings = ref<Record<string, Record<string, RefresherSettings>>>({});
    const loadState = ref<SettingsLoadState>("loading");

    const applySchema = async (schema: ModuleSchemaMap) => {
        const enableMap: ModuleSchemaMap = {};
        const settingsMap: Record<string, Record<string, RefresherSettings>> = {};

        for (const [moduleName, moduleSchema] of Object.entries(schema)) {
            settingsMap[moduleName] = moduleSchema.settings ?? {};

            for (const [key, setting] of Object.entries(settingsMap[moduleName])) {
                const stored = await moduleSettingStorage(moduleName, key).getValue();
                if (stored !== null && stored !== undefined) {
                    (setting.value as unknown) = stored;
                }
            }

            const storedEnable = await moduleEnableStorage(moduleName).getValue();
            enableMap[moduleName] = {
                ...moduleSchema,
                enable: storedEnable ?? moduleSchema.default_enable
            };
        }

        settings.value = settingsMap;
        modules.value = enableMap;
        loadState.value = "ready";
    };

    const loadFromDcTab = async () => {
        loadState.value = "loading";

        const dcTab = await findDcContentTab();
        const schema = dcTab?.id ? await requestSchema(dcTab.id) : await readCachedSchema();
        if (!schema) {
            loadState.value = dcTab?.id ? "no-response" : "no-tab";
            return;
        }

        await applySchema(schema);
    };

    onMounted(() => {
        void loadFromDcTab();
    });

    const hasSettings = computed(() => Object.keys(settings.value).length > 0);
    const hasModules = computed(() => Object.keys(modules.value).length > 0);

    const settingsCount = (obj: Record<string, RefresherSettings>) => {
        if (!obj) return 0;
        return Object.values(obj).filter((v) => !v?.advanced).length;
    };

    const advancedSettingsCount = (obj: Record<string, RefresherSettings>) => {
        return Object.values(obj).filter((v) => v?.advanced === true).length;
    };

    const modulesWithBasicSettings = computed(() => {
        return Object.keys(settings.value).filter(
            (module) => settings.value[module] && settingsCount(settings.value[module]) > 0
        );
    });

    const modulesWithAdvancedSettings = computed(() => {
        return Object.keys(settings.value).filter(
            (module) => settings.value[module] && advancedSettingsCount(settings.value[module]) > 0
        );
    });

    const updateUserSetting = async (
        module: string | undefined,
        key: string | undefined,
        value: unknown
    ) => {
        if (!module || !key) return;
        const setting = settings.value[module]?.[key];
        if (!setting) return;

        const previousValue = setting.value;
        (setting.value as unknown) = value;

        try {
            await moduleSettingStorage(module, key).setValue(value as string | number | boolean);

            const tabs = await browser.tabs.query({});
            await Promise.all(
                tabs
                    .filter((tab) => tab.id && isDcContentScriptUrl(tab.url))
                    .map((tab) =>
                        sendMessage("updateSettingValue", {
                            name: module,
                            key,
                            value: value as string | number | boolean
                        }, tab.id!).catch((e) => {
                            if (!isMissingReceiverError(e)) {
                                console.error(`Failed to send to tab ${tab.id}:`, e);
                            }
                        })
                    )
            );
        } catch (e) {
            (setting.value as unknown) = previousValue;

            try {
                await moduleSettingStorage(module, key).setValue(previousValue as string | number | boolean);
            } catch (rollbackError) {
                console.error("Failed to rollback user setting:", rollbackError);
            }

            console.error("Failed to update user setting:", e);
        }
    };

    const typeWrap = (value: unknown) => {
        if (typeof value === "boolean") {
            return value ? "On" : "Off";
        }

        if (typeof value === "string" && value === "") {
            return "없음";
        }

        return value;
    };

    const moveToModuleTab = (moduleName: string) => {
        nextTick(() => {
            const app = document.querySelector<HTMLElement>("#refresher-app");
            if (!app) return;

            for (const element of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
                element.classList.remove("highlight");
            }

            for (const element of app.querySelectorAll<HTMLElement>(".tab .refresher-module .title")) {
                if (element.textContent !== moduleName) continue;

                element.parentElement?.parentElement?.classList.add("highlight");

                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

                setTimeout(() => {
                    for (const el of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
                        el.classList.remove("highlight");
                    }
                }, 1000);
            }
        });
    };

    const updateModuleStatus = async (name: string, value: boolean) => {
        if (modules.value[name]) {
            modules.value[name].enable = value;
        }
        await moduleEnableStorage(name).setValue(value);

        const tabs = await browser.tabs.query({});
        await Promise.all(
            tabs
                .filter((tab) => tab.id && isDcContentScriptUrl(tab.url))
                .map((tab) =>
                    sendMessage("updateModuleStatus", {name, value}, tab.id!).catch((e) => {
                        if (!isMissingReceiverError(e)) {
                            console.error(`Failed to send to tab ${tab.id}:`, e);
                        }
                    })
                )
        );
    };

    return {
        modules,
        settings,
        loadState,
        reload: loadFromDcTab,
        hasSettings,
        hasModules,
        modulesWithBasicSettings,
        modulesWithAdvancedSettings,
        updateUserSetting,
        updateModuleStatus,
        typeWrap,
        moveToModuleTab
    };
}
