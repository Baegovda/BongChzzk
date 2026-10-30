<template>
  <div id="refresher-app" class="options-page refresher-app-shell">
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
      <div class="be-title">
        <h3>디시 설정</h3>
        <span class="be-sub">BongExtend · 디시인사이드 리프레셔</span>
      </div>
      <div class="be-subnav float-right">
        <p
            v-for="tabItem in tabs"
            :key="tabItem.id"
            :class="{ active: tab === tabItem.id }"
            @click="() => (tab = tabItem.id)"
        >
          {{ tabItem.label }}
        </p>
      </div>
    </div>

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
</template>

<script lang="ts" setup>
import {provide} from "vue";

import BlockDialog from "../dc/components/BlockDialog.vue";
import GeneralTab from "../dc/tabs/GeneralTab.vue";
import AdvancedTab from "../dc/tabs/AdvancedTab.vue";
import BlockTab from "../dc/tabs/BlockTab.vue";
import MemoTab from "../dc/tabs/MemoTab.vue";
import ModuleTab from "../dc/tabs/ModuleTab.vue";
import DataTab from "../dc/tabs/DataTab.vue";

import {useBlocks} from "../dc/composables/useBlocks";
import {useMemos} from "../dc/composables/useMemos";
import {useSettings} from "../dc/composables/useSettings";
import {useData} from "../dc/composables/useData";
import {usePopupTab} from "../dc/composables/usePopupTab";

const {tab, tabs} = usePopupTab();

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
</script>

<style lang="scss" src="../dc/popup.scss"></style>

<style lang="scss">
/* options 페이지 전용 - popup 고정 크기/위치 제거 */
html, body {
  height: auto;
  min-height: 100vh;
  overflow-y: auto;
  margin: 0;
  padding: 0;
}

#refresher-app.options-page {
  width: 100% !important;
  height: auto !important;
  min-height: 100vh;
  max-width: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: visible;
  display: block;

  .refresher-title-zone {
    position: relative !important;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 18px 24px 0 !important;
    box-sizing: border-box;
    z-index: auto;
  }

  .tab {
    position: relative !important;
    width: 100% !important;
    max-width: 1200px;
    margin: 0 auto;
    padding: 6px 24px 40px !important;
    height: auto !important;
    box-sizing: border-box;
    overflow-y: visible;
  }
}
</style>