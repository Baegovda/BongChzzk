<template>
  <div class="tab tab0">
    <div class="settings">
      <div v-if="loadState === 'loading'">
        <p class="be-empty">모듈 설정을 불러오는 중…</p>
      </div>
      <div v-else-if="loadState !== 'ready'">
        <p class="be-empty">디시 페이지를 새로고침한 뒤 설정을 다시 열어 주세요.</p>
      </div>
      <div v-else>
        <settings-module
            v-for="moduleName in modulesWithBasicSettings"
            :key="moduleName"
            :module-enabled="modules[moduleName]?.enable ?? false"
            :module-name="moduleName"
            :module-settings="settings[moduleName]"
            :show-advanced="false"
        />
      </div>
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
  modulesWithBasicSettings
} = inject("settings")!;
</script>
