<template>
  <div class="tab tab0">
    <div class="info">
      <div class="text">
        <h3>BongExtend</h3>
        <p>
          <span class="version">v{{ displayVersion }}</span>
          <a
              v-for="link in links"
              :key="link.url"
              @click="open(link.url)"
          >
            {{ link.text }}
          </a>
        </p>
      </div>
    </div>

    <section class="update-panel">
      <div class="update-panel__header">
        <h4>업데이트</h4>
        <span
            :class="{
              available: status.updateAvailable,
              latest: !status.updateAvailable && !status.error && Boolean(status.latestVersion),
              error: Boolean(status.error) && !status.updateAvailable
            }"
            class="update-panel__badge"
        >
          {{ statusLabel }}
        </span>
      </div>

      <p
          v-if="versionStatusText"
          class="update-panel__desc"
      >
        {{ versionStatusText }}
      </p>
      <p
          v-else
          class="update-panel__desc"
      >
        GitHub 최신 릴리즈와 지금 설치된 버전을 비교합니다.
      </p>

      <p
          v-if="status.error"
          class="update-panel__error"
      >
        {{ status.error }}
      </p>

      <div
          v-if="status.updateAvailable && status.releaseNotes"
          class="update-panel__notes"
      >
        <div class="update-panel__notes-label">
          <span>릴리즈 노트</span>
          <a
              v-if="status.releaseUrl"
              @click="open(status.releaseUrl)"
          >
            전체 보기
          </a>
        </div>
        <p class="update-panel__notes-body">{{ status.releaseNotes }}</p>
      </div>

      <div class="update-panel__actions">
        <button
            :disabled="checking || applying"
            type="button"
            @click="checkUpdate(true)"
        >
          {{ checking ? "확인 중..." : "업데이트 확인" }}
        </button>

        <button
            type="button"
            @click="openExtensionsPage"
        >
          확장 프로그램 관리
        </button>

        <button
            v-if="canInPlaceUpdate && status.updateAvailable && status.downloadUrl"
            :disabled="checking || applying"
            class="update-panel__apply"
            type="button"
            @click="openInPlaceUpdate"
        >
          지금 업데이트
        </button>

        <button
            v-if="status.updateAvailable && status.downloadUrl"
            :disabled="checking || applying"
            :class="{'update-panel__apply': !canInPlaceUpdate}"
            type="button"
            @click="applyUpdate"
        >
          {{ applying ? "다운로드 중..." : "업데이트 받기" }}
        </button>

        <button
            v-else-if="status.updateAvailable && status.releaseUrl"
            :disabled="checking || applying"
            type="button"
            @click="open(status.releaseUrl)"
        >
          릴리즈 페이지
        </button>
      </div>

      <p
          v-if="extensionsPageError"
          class="update-panel__error"
      >
        {{ extensionsPageError }}
      </p>

      <p
          v-if="status.updateAvailable && canInPlaceUpdate"
          class="update-panel__hint"
      >
        지금 업데이트는 새 탭에서 진행됩니다. 처음 한 번은 압축을 푼 BongExtend 폴더(manifest.json이 있는 곳)를 고르세요. 그 다음부터는 바뀐 파일만 넣고 확장을 다시 켭니다. zip만 받으려면 업데이트 받기를 쓰세요.
      </p>
      <p
          v-else-if="status.updateAvailable"
          class="update-panel__hint"
      >
        압축을 기존 폴더에 덮어쓴 뒤
        <a @click="open(installGuide.url)">{{ installGuide.label }}</a>{{ installGuide.after }}
      </p>

      <p
          v-if="downloadNote"
          class="update-panel__meta"
      >
        {{ downloadNote }}
      </p>

      <div class="update-panel__auto">
        <RefresherCheckbox
            :disabled="checking"
            :model-value="status.autoCheck"
            @change="setAutoCheck"
        />
        <div>
          <p class="update-panel__auto-title">하루에 한 번 자동 확인</p>
          <p class="update-panel__meta">
            켜 두면 하루 한 번 확인하고, 새 버전이 있으면 아이콘과 알림으로 알려 줍니다.
          </p>
        </div>
      </div>

      <p class="update-panel__meta">
        마지막 확인: {{ lastCheckedLabel() }}
      </p>
    </section>

    <div class="settings">
      <div v-if="loadState === 'loading'">
        <h3 class="need-refresh">모듈 설정을 불러오는 중…</h3>
      </div>
      <div v-else-if="loadState !== 'ready'">
        <h3 class="need-refresh">디시 페이지를 새로고침한 뒤 설정을 다시 열어주세요.</h3>
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
import {computed, inject, ref} from "vue";
import {describeUpdate} from "@/core/update/release";
import {sendMessage} from "@/http/messaging";
import SettingsModule from "../components/settingsModule.vue";
import RefresherCheckbox from "../components/checkbox.vue";
import {useUpdate} from "../composables/useUpdate";

const {
  modules,
  settings,
  loadState,
  modulesWithBasicSettings
} = inject("settings")!;

const {
  status,
  checking,
  applying,
  downloadNote,
  canInPlaceUpdate,
  checkUpdate,
  applyUpdate,
  openInPlaceUpdate,
  setAutoCheck,
  lastCheckedLabel
} = useUpdate();

const versionStatusText = computed(() => {
  if (!status.latestVersion) return "";
  return describeUpdate(status.currentVersion, status.latestVersion);
});

const displayVersion = computed(() =>
    import.meta.env.DEV ? `${status.currentVersion}-dev` : status.currentVersion
);

const statusLabel = computed(() => {
  if (checking.value) return "확인 중";
  if (status.updateAvailable) return "업데이트 가능";
  if (status.error) return "확인 실패";
  if (status.latestVersion) return "최신";
  return "대기";
});

const installGuide = computed(() => {
  if (status.browser === "firefox") {
    return {
      url: "about:debugging#/runtime/this-firefox",
      label: "about:debugging",
      after: "에서 이 확장을 새로고침하세요."
    };
  }

  return {
    url: "chrome://extensions",
    label: "chrome://extensions",
    after: "에서 새로고침하세요."
  };
});

const links = [
  {text: "GitHub", url: "https://github.com/Baegovda/BongExtend"},
  {text: "도움말", url: "https://dcrefresher.green1052.com"}
];

const open = (url: string) => {
  browser.tabs.create({url});
};

const extensionsPageError = ref("");

const openExtensionsPage = async () => {
  extensionsPageError.value = "";

  try {
    const result = await sendMessage("openExtensionsPage");
    if (!result.ok) {
      extensionsPageError.value = result.error || "확장 프로그램 관리 페이지를 열지 못했습니다.";
    }
  } catch (error) {
    console.error("확장 프로그램 관리 페이지를 열지 못했습니다.", error);
    extensionsPageError.value = "확장 프로그램 관리 페이지를 열지 못했습니다.";
  }
};
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/variables" as *;

.update-panel {
  background: var(--refresher-bg-blur);
  border: 1px solid var(--refresher-border-light);
  border-radius: $radius-md;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.update-panel__header {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 8px;

  h4 {
    font-size: 16px;
  }
}

.update-panel__badge {
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;

  &.latest {
    background: color-mix(in srgb, var(--refresher-success) 14%, transparent);
    color: var(--refresher-success);
  }

  &.available {
    background: color-mix(in srgb, var(--refresher-primary) 14%, transparent);
    color: var(--refresher-primary);
  }

  &.error {
    background: color-mix(in srgb, var(--refresher-danger) 14%, transparent);
    color: var(--refresher-danger);
  }
}

.update-panel__desc,
.update-panel__meta {
  color: var(--refresher-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.update-panel__desc strong {
  color: var(--refresher-text);
}

.update-panel__error {
  color: var(--refresher-danger);
  font-size: 12px;
  margin-top: 6px;
}

.update-panel__meta {
  margin-top: 8px;
}

.update-panel__notes {
  background: var(--refresher-bg);
  border-radius: $radius-sm;
  margin-top: 8px;
  padding: 8px 10px;
}

.update-panel__notes-label {
  align-items: center;
  color: var(--refresher-text-secondary);
  display: flex;
  font-size: 11px;
  font-weight: 700;
  justify-content: space-between;
  margin-bottom: 4px;

  a {
    color: var(--refresher-primary);
    cursor: pointer;
    font-weight: 600;
    margin-right: 0;

    &::after {
      content: none;
      margin: 0;
    }
  }
}

.update-panel__notes-body {
  color: var(--refresher-text);
  font-size: 12px;
  line-height: 1.5;
  max-height: 96px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.update-panel__hint {
  background: color-mix(in srgb, var(--refresher-primary) 8%, transparent);
  border-radius: $radius-sm;
  color: var(--refresher-text);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 8px;
  padding: 8px 10px;

  a {
    color: var(--refresher-primary);
    cursor: pointer;
    margin-right: 0;
    text-decoration: underline;

    &::after {
      content: none;
      margin: 0;
    }
  }
}

.update-panel__auto {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.update-panel__auto-title {
  font-size: 13px;
  font-weight: 600;
}

.update-panel__auto .update-panel__meta {
  margin-top: 2px;
}

.update-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.update-panel__apply {
  background: var(--refresher-primary);
  border-color: var(--refresher-primary);
  color: #fff;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--refresher-primary) 88%, #000);
    border-color: color-mix(in srgb, var(--refresher-primary) 88%, #000);
    color: #fff;
  }
}
</style>
