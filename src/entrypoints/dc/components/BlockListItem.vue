<template>
  <div class="block-list-item">
    <button
        class="block-list-item__main"
        type="button"
        @click="textclick?.()"
    >
      <img
          v-if="image"
          :src="image"
          alt=""
          class="block-list-item__thumb"
          loading="lazy"
      />

      <div class="block-list-item__body">
        <p class="block-list-item__content">{{ text }}</p>
        <div
            v-if="badges.length"
            class="block-list-item__meta"
        >
          <span
              v-for="badge in badges"
              :key="badge"
              class="block-list-item__badge"
          >
            {{ badge }}
          </span>
        </div>
      </div>
    </button>

    <button
        v-if="remove"
        aria-label="삭제"
        class="block-list-item__remove"
        type="button"
        @click="remove()"
    >
      <RemoveIcon/>
    </button>
  </div>
</template>

<script lang="ts" setup>
import {computed} from "vue";
import {RemoveIcon} from "./icons";

const props = defineProps<{
  text: string;
  image?: string;
  isRegex?: boolean;
  gallery?: string;
  extra?: string;
  remove?: () => void;
  textclick?: () => void;
}>();

const badges = computed(() => {
  const items: string[] = [];

  if (props.isRegex) items.push("정규식");
  if (props.gallery) items.push(`갤러리 ${props.gallery}`);
  if (props.extra) items.push(props.extra);

  return items;
});
</script>

<style lang="scss" scoped>
@use "../../../assets/styles/variables" as *;

.block-list-item {
  align-items: stretch;
  background: var(--refresher-bg-blur);
  border: 1px solid var(--refresher-border-light);
  border-radius: $radius-sm;
  display: flex;
  gap: 8px;
  overflow: hidden;
  transition: border-color $duration-fast $ease-out-expo, box-shadow $duration-fast $ease-out-expo;

  &:hover {
    border-color: color-mix(in srgb, var(--refresher-primary) 35%, var(--refresher-border-light));
    box-shadow: $shadow-1dp;
  }
}

.block-list-item__main {
  align-items: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 1;
  font: inherit;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  text-align: left;

  &:hover {
    color: inherit;
  }
}

.block-list-item__thumb {
  border-radius: 6px;
  flex-shrink: 0;
  height: 40px;
  object-fit: contain;
  width: 40px;
}

.block-list-item__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.block-list-item__content {
  font-size: 14px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-list-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.block-list-item__badge {
  background: color-mix(in srgb, var(--refresher-primary) 12%, transparent);
  border-radius: 999px;
  color: var(--refresher-text-secondary);
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
}

.block-list-item__remove {
  align-items: center;
  align-self: stretch;
  background: transparent;
  border: none;
  border-left: 1px solid var(--refresher-border-light);
  color: var(--refresher-text-tertiary);
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  padding: 0 12px;
  transition: background $duration-fast $ease-out-expo, color $duration-fast $ease-out-expo;
  width: 42px;

  &:hover {
    background: color-mix(in srgb, var(--refresher-danger) 10%, transparent);
    color: var(--refresher-danger);
  }
}
</style>
