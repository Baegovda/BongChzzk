<template>
  <div
      id="refresher-app"
      :style="{height: `${height}px`}"
      class="refresher-app-shell"
  >
    <BlockDialog
        :block-detect-mode-type-names="blockDetectModeTypeNames"
        :block-key-names="blockKeyNames"
        :current-block-type="currentBlockType"
        :form-data="blockFormData"
        :visible="showBlockDialog"
        @close="closeBlockDialog"
        @confirm="confirmAddBlock"
    />

    <div class="refresher-title-zone">
      <h1>설정</h1>
      <div class="float-right">
        <p
            v-for="tabItem in tabs"
            :key="tabItem.id"
            :class="{ active: tab === tabItem.id }"
            @click="() => (tab = tabItem.id)"
        >
          {{ tabItem.label }}
        </p>
      </div>
      <button
          class="open-options-btn"
          title="전체 설정 페이지 열기"
          @click="openOptions"
      >
        <svg fill="none" height="14" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14"
             xmlns="http://www.w3.org/2000/svg">
          <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        </svg>
      </button>
    </div>

    <div class="refresher-app__body">
      <transition-group name="refresher-slide-left">
      <GeneralTab
          v-if="tab === 0"
          key="tab1"
      />
      <AdvancedTab
          v-else-if="tab === 1"
          key="tab2"
      />
      <BlockTab
          v-else-if="tab === 2"
          key="tab3"
      />
      <MemoTab
          v-else-if="tab === 3"
          key="tab4"
      />
      <ModuleTab
          v-else-if="tab === 4"
          key="tab5"
      />
      <DataTab
          v-else-if="tab === 6"
          key="tab7"
      />
      </transition-group>
    </div>

    <PopupResizeHandle :on-resize-start="startResize"/>
  </div>
</template>

<script lang="ts" setup>
import {provide} from "vue";

import BlockDialog from "./components/BlockDialog.vue";
import PopupResizeHandle from "./components/PopupResizeHandle.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import AdvancedTab from "./tabs/AdvancedTab.vue";
import BlockTab from "./tabs/BlockTab.vue";
import MemoTab from "./tabs/MemoTab.vue";
import ModuleTab from "./tabs/ModuleTab.vue";
import DataTab from "./tabs/DataTab.vue";

import {useBlocks} from "./composables/useBlocks";
import {useMemos} from "./composables/useMemos";
import {useSettings} from "./composables/useSettings";
import {useData} from "./composables/useData";
import {usePopupTab} from "./composables/usePopupTab";
import {usePopupResize} from "./composables/usePopupResize";

const {tab, tabs} = usePopupTab();
const {height, startResize} = usePopupResize();

const blocksComposable = useBlocks();
const memosComposable = useMemos();
const settingsComposable = useSettings();
const dataComposable = useData();

const {
  blockKeyNames,
  blockDetectModeTypeNames,
  currentBlockType,
  blockFormData,
  showBlockDialog,
  closeBlockDialog,
  confirmAddBlock
} = blocksComposable;

const {moveToModuleTab: moveToModuleTabRaw} = settingsComposable;

const moveToModuleTab = (moduleName: string) => {
  tab.value = 4;
  moveToModuleTabRaw(moduleName);
};

provide("blocks", blocksComposable);
provide("memos", memosComposable);
provide("settings", settingsComposable);
provide("data", dataComposable);
provide("updateUserSetting", settingsComposable.updateUserSetting);
provide("typeWrap", settingsComposable.typeWrap);
provide("moveToModuleTab", moveToModuleTab);

const openOptions = () => {
  browser.runtime.openOptionsPage();
};
</script>

<style lang="scss" src="./popup.scss"></style>