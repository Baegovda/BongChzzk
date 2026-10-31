<template>
  <div class="tab tab4">
    <div
        v-if="loadState === 'loading'"
        class="refresher-no-modules"
    >
      <h3>모듈을 불러오는 중…</h3>
      <p>디시 페이지와 연결하고 있어요.</p>
    </div>

    <div
        v-else-if="loadState === 'no-tab'"
        class="refresher-no-modules"
    >
      <h3>디시 탭을 찾지 못했어요</h3>
      <p>갤러리·마이너 갤러리·게시글 페이지를 연 뒤 다시 열어 주세요.</p>
      <button
          type="button"
          @click="reload"
      >
        다시 시도
      </button>
    </div>

    <div
        v-else-if="loadState === 'no-response'"
        class="refresher-no-modules"
    >
      <h3>모듈에 연결하지 못했어요</h3>
      <p>디시 페이지를 새로고침(F5)한 뒤 다시 시도해 주세요.</p>
      <button
          type="button"
          @click="reload"
      >
        다시 시도
      </button>
    </div>

    <div v-else>
      <refresher-module
          v-for="module in modules"
          :key="module.name"
          :desc="module.description ?? ''"
          :enabled="module.enable"
          :name="module.name"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import RefresherModule from "../components/module.vue";
import {injectSettings} from "../inject";

const {modules, loadState, reload} = injectSettings();
</script>

<style lang="scss" scoped>
.refresher-no-modules button {
  background: var(--refresher-primary);
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  margin-top: 12px;
  padding: 8px 14px;
}
</style>
