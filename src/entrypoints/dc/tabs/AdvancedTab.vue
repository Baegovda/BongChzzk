<template>
  <div class="tab tab1">
    <div v-if="loadState === 'loading'">
      <h3 class="need-refresh">모듈 설정을 불러오는 중…</h3>
    </div>
    <div v-else-if="loadState !== 'ready'">
      <h3 class="need-refresh">디시 페이지를 새로고침한 뒤 설정을 다시 열어주세요.</h3>
    </div>
    <div v-else-if="!modulesWithAdvancedSettings.length">
      <h3 class="need-refresh">표시할 고급 설정이 없습니다.</h3>
      <p class="advanced-tab__hint">
        미리보기·레이아웃·관리 등 모듈의 세부 옵션이 여기에 표시됩니다.
        자주 쓰는 설정은 <strong>일반</strong> 탭을 확인하세요.
      </p>
    </div>
    <div v-else>
      <settings-module
          v-for="moduleName in modulesWithAdvancedSettings"
          :key="moduleName"
          :module-enabled="modules[moduleName]?.enable ?? false"
          :module-name="moduleName"
          :module-settings="settings[moduleName]"
          :show-advanced="true"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import SettingsModule from "../components/settingsModule.vue";

const {
  modules,
  settings,
  loadState,
  modulesWithAdvancedSettings
} = inject("settings")!;
</script>

<style lang="scss" scoped>
.advanced-tab__hint {
  color: var(--refresher-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-top: 8px;
}
</style>
