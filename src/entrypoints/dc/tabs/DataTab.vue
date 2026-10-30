<template>
  <div class="tab tab6">
    <div class="be-grid">
      <section class="be-card be-sec">
        <h4>클라우드 백업</h4>
        <p class="be-hint">디시 설정·차단·메모를 브라우저 계정(동기화 저장소)에 보관해요.</p>
        <div class="be-actions">
          <button :disabled="loading" @click="backupCloud">클라우드 백업</button>
          <button :disabled="loading" @click="recoverCloud">클라우드 복원</button>
        </div>
        <p class="be-hint">
          마지막 백업: {{ lastUpdate > 0 ? new Date(lastUpdate).toLocaleString("ko-KR") : "없음" }}
        </p>
      </section>
      <section class="be-card be-sec">
        <h4>파일 백업·초기화</h4>
        <p class="be-hint">파일로 내보내기·가져오기는 <b>업데이트·설정</b> 탭의 백업·복원에서 모든 모듈을 한 번에 해요.</p>
        <div class="be-actions">
          <button :disabled="loading" class="danger" @click="clearData">디시 데이터 초기화</button>
        </div>
        <p class="be-hint">디시 설정·차단·메모만 지워요. 다른 모듈 설정은 그대로예요.</p>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject, onMounted} from "vue";

const {
  lastUpdate,
  loading,
  refreshLastUpdate,
  backupCloud,
  recoverCloud,
  clearData
} = inject("data")!;

onMounted(refreshLastUpdate);
</script>
