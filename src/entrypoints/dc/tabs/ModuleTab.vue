<template>
  <div class="tab tab4">
    <div
        v-if="loadState === 'loading'"
        class="refresher-no-modules"
    >
      <h3>모듈 불러오는 중…</h3>
      <p>디시 페이지와 연결하고 있습니다.</p>
    </div>

    <div
        v-else-if="loadState === 'no-tab'"
        class="refresher-no-modules"
    >
      <h3>디시 탭을 찾을 수 없음</h3>
      <p>갤러리·마이너 갤러리·게시글 페이지를 연 뒤 다시 열어주세요.</p>
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
      <h3>모듈에 연결하지 못함</h3>
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
import {inject} from "vue";
import RefresherModule from "../components/module.vue";

const {modules, loadState, reload} = inject("settings")!;
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
