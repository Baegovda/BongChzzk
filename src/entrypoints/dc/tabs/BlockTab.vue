<template>
  <div class="tab tab2 block-tab">
    <header class="block-tab__toolbar">
      <div class="block-tab__toolbar-text">
        <h2>차단 목록</h2>
        <p>총 {{ totalCount }}개 · {{ nonEmptyCategoryCount }}개 유형 사용 중</p>
      </div>

      <div class="block-tab__toolbar-actions">
        <button
            type="button"
            @click="importBlock"
        >
          가져오기
        </button>
        <button
            type="button"
            @click="exportBlock"
        >
          보내기
        </button>
      </div>
    </header>

    <div class="block-tab__layout">
      <aside class="block-tab__sidebar">
        <section
            v-for="group in blockGroups"
            :key="group.label"
            class="block-tab__nav-group"
        >
          <p class="block-tab__nav-label">{{ group.label }}</p>

          <button
              v-for="type in group.types"
              :key="type"
              :class="{ active: activeType === type }"
              class="block-tab__nav-item"
              type="button"
              @click="activeType = type"
          >
            <span class="block-tab__nav-name">{{ blockKeyNames[type] }}</span>
            <span
                :class="{ empty: blocks[type].length === 0 }"
                class="block-tab__nav-count"
            >
              {{ blocks[type].length }}
            </span>
          </button>
        </section>
      </aside>

      <section class="block-tab__panel">
        <header class="block-tab__panel-header">
          <div class="block-tab__panel-title">
            <h3>{{ blockKeyNames[activeType] }}</h3>
            <p>{{ blockHints[activeType] }}</p>
          </div>

          <button
              class="block-tab__add-btn"
              type="button"
              @click="openBlockDialog(activeType)"
          >
            <PlusIcon/>
            <span>추가</span>
          </button>
        </header>

        <div class="block-tab__controls">
          <label class="block-tab__mode">
            <span>매칭 모드</span>
            <select
                :value="blockModes[activeType] ?? DEFAULT_BLOCK_DETECT_MODE"
                @change="onModeChange"
            >
              <option
                  v-for="[modeKey, modeLabel] in Object.entries(blockDetectModeTypeNames)"
                  :key="modeKey"
                  :value="modeKey"
              >
                {{ modeLabel }}
              </option>
            </select>
          </label>

          <label class="block-tab__search">
            <span>검색</span>
            <div class="block-tab__search-field">
              <span
                  aria-hidden="true"
                  class="block-tab__search-icon"
              >⌕</span>
              <input
                  v-model="searchQuery"
                  placeholder="목록에서 검색"
                  type="search"
              />
            </div>
          </label>
        </div>

        <div class="block-tab__panel-actions">
          <span class="block-tab__result-count">
            {{ filteredItems.length }}개 표시
          </span>

          <button
              v-if="blocks[activeType].length > 0"
              class="danger"
              type="button"
              @click="removeAllBlockedUser(activeType)"
          >
            전체 삭제
          </button>
        </div>

        <div
            v-if="filteredItems.length === 0"
            class="block-tab__empty"
        >
          <p class="block-tab__empty-title">
            {{ searchQuery ? "검색 결과가 없습니다" : `차단된 ${blockKeyNames[activeType]}이 없습니다` }}
          </p>
          <p class="block-tab__empty-desc">
            {{
              searchQuery
                  ? "다른 검색어를 입력하거나 검색을 초기화해 보세요."
                  : "추가 버튼으로 새 차단 규칙을 등록할 수 있습니다."
            }}
          </p>
          <button
              v-if="!searchQuery"
              type="button"
              @click="openBlockDialog(activeType)"
          >
            {{ blockKeyNames[activeType] }} 추가
          </button>
        </div>

        <div
            v-else
            class="block-tab__list"
        >
          <BlockListItem
              v-for="{item, index} in filteredItems"
              :key="`${activeType}:${index}:${item.content}`"
              :gallery="item.gallery"
              :image="getDcconImage(activeType, item)"
              :is-regex="item.isRegex"
              :extra="item.mode ? blockDetectModeTypeNames[item.mode] : undefined"
              :remove="() => removeBlockedUser(activeType, index)"
              :text="item.content"
              :textclick="() => editBlockedUser(activeType, index)"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {computed, inject, ref, watch} from "vue";
import {DEFAULT_BLOCK_DETECT_MODE} from "@/storage/wxtStorage";
import BlockListItem from "../components/BlockListItem.vue";
import {PlusIcon} from "../components/icons";

const {
  blocks,
  blockModes,
  blockKeyNames,
  blockDetectModeTypeNames,
  openBlockDialog,
  removeBlockedUser,
  removeAllBlockedUser,
  editBlockedUser,
  setBlockMode,
  exportBlock,
  importBlock
} = inject("blocks")!;

const blockGroups = [
  {label: "유저", types: ["NICK", "ID", "IP"] as const},
  {label: "콘텐츠", types: ["TITLE", "TEXT", "COMMENT", "TAB"] as const},
  {label: "기타", types: ["DCCON"] as const}
] satisfies Array<{ label: string; types: readonly RefresherBlockType[] }>;

const blockHints: Record<RefresherBlockType, string> = {
  NICK: "작성자 닉네임을 기준으로 차단합니다.",
  ID: "유저 고유번호를 기준으로 차단합니다.",
  IP: "작성자 IP를 기준으로 차단합니다.",
  TITLE: "게시글 제목을 기준으로 차단합니다.",
  TEXT: "게시글 본문을 기준으로 차단합니다.",
  COMMENT: "댓글 내용을 기준으로 차단합니다.",
  DCCON: "디시콘 코드를 기준으로 차단합니다.",
  TAB: "말머리를 기준으로 차단합니다."
};

const activeType = ref<RefresherBlockType>("COMMENT");
const searchQuery = ref("");

watch(activeType, () => {
  searchQuery.value = "";
});

const totalCount = computed(() =>
  Object.values(blocks).reduce((sum, list) => sum + list.length, 0)
);

const nonEmptyCategoryCount = computed(() =>
  Object.values(blocks).filter((list) => list.length > 0).length
);

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const items = blocks[activeType.value].map((item, index) => ({item, index}));

  if (!query) return items;

  return items.filter(({item}) => {
    const haystack = [item.content, item.gallery, item.extra]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

const onModeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as RefresherBlockDetectMode;
  void setBlockMode(activeType.value, value);
};

const getDcconImage = (type: RefresherBlockType, item: RefresherBlockValue) => {
  if (type !== "DCCON") return undefined;

  const code = item.isRegex
    ? item.content.match(/^\^\((\w*)\|/)?.at(1) ?? item.content
    : item.content;

  return `https://image.dcinside.com/dccon.php?no=${code}`;
};
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/variables" as *;

.block-tab {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  overflow: hidden;
  padding-bottom: 16px;
}

.block-tab__toolbar {
  align-items: flex-end;
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  justify-content: space-between;
}

.block-tab__toolbar-text {
  h2 {
    font-size: 20px;
    margin-bottom: 4px;
  }

  p {
    color: var(--refresher-text-secondary);
    font-size: 12px;
  }
}

.block-tab__toolbar-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.block-tab__layout {
  display: grid;
  flex: 1;
  gap: 12px;
  grid-template-columns: 168px minmax(0, 1fr);
  min-height: 0;
}

.block-tab__sidebar {
  background: var(--refresher-bg-blur);
  border: 1px solid var(--refresher-border-light);
  border-radius: $radius-md;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding: 10px;
}

.block-tab__nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.block-tab__nav-label {
  color: var(--refresher-text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  text-transform: uppercase;
}

.block-tab__nav-item {
  align-items: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  color: var(--refresher-text);
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 8px;
  justify-content: space-between;
  padding: 8px 10px;
  text-align: left;
  transition: background $duration-fast $ease-out-expo, border-color $duration-fast $ease-out-expo;

  &:hover {
    background: var(--refresher-bg-overlay);
    border-color: var(--refresher-border-light);
    color: var(--refresher-text);
  }

  &.active {
    background: color-mix(in srgb, var(--refresher-primary) 12%, transparent);
    border-color: color-mix(in srgb, var(--refresher-primary) 28%, var(--refresher-border-light));
  }
}

.block-tab__nav-name {
  font-size: 13px;
  font-weight: 600;
}

.block-tab__nav-count {
  background: var(--refresher-bg);
  border: 1px solid var(--refresher-border-light);
  border-radius: 999px;
  color: var(--refresher-text-secondary);
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  padding: 2px 7px;
  text-align: center;

  &.empty {
    opacity: 0.55;
  }
}

.block-tab__panel {
  background: var(--refresher-bg-blur);
  border: 1px solid var(--refresher-border-light);
  border-radius: $radius-md;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  min-width: 0;
  padding: 14px;
}

.block-tab__panel-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.block-tab__panel-title {
  h3 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  p {
    color: var(--refresher-text-secondary);
    font-size: 12px;
    line-height: 1.5;
  }
}

.block-tab__add-btn {
  align-items: center;
  background: var(--refresher-primary);
  border-color: var(--refresher-primary);
  color: #fff;
  display: inline-flex;
  flex-shrink: 0;
  gap: 6px;
  padding-inline: 14px;

  &:hover {
    background: color-mix(in srgb, var(--refresher-primary) 88%, #000);
    border-color: color-mix(in srgb, var(--refresher-primary) 88%, #000);
    color: #fff;
  }
}

.block-tab__controls {
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
}

.block-tab__mode,
.block-tab__search {
  display: flex;
  flex-direction: column;
  gap: 6px;

  > span {
    color: var(--refresher-text-secondary);
    font-size: 11px;
    font-weight: 600;
  }
}

.block-tab__search-field {
  position: relative;
}

.block-tab__search-icon {
  color: var(--refresher-text-tertiary);
  font-size: 14px;
  left: 10px;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.block-tab__search input {
  background: var(--refresher-bg);
  border: 1px solid var(--refresher-border-light);
  border-radius: $radius-sm;
  color: var(--refresher-text);
  font: inherit;
  font-size: 13px;
  padding: 7px 10px 7px 30px;
  transition: border-color $duration-fast $ease-out-expo;
  width: 100%;

  &:focus {
    border-color: var(--refresher-primary);
    outline: none;
  }
}

.block-tab__panel-actions {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.block-tab__result-count {
  color: var(--refresher-text-tertiary);
  font-size: 12px;
}

.block-tab__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.block-tab__empty {
  align-items: center;
  border: 1px dashed var(--refresher-border-light);
  border-radius: $radius-md;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-height: 180px;
  padding: 24px;
  text-align: center;
}

.block-tab__empty-title {
  font-size: 15px;
  font-weight: 700;
}

.block-tab__empty-desc {
  color: var(--refresher-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  max-width: 280px;
}
</style>
