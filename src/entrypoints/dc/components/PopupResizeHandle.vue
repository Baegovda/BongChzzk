<template>
  <div
      aria-label="창 높이 조절"
      class="popup-resize-handle"
      role="separator"
      @pointerdown="onResizeStart"
  >
    <span class="popup-resize-handle__grip"/>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  onResizeStart: (event: PointerEvent) => void;
}>();
</script>

<style lang="scss" scoped>
.popup-resize-handle {
  align-items: center;
  cursor: ns-resize;
  display: flex;
  flex-shrink: 0;
  height: 14px;
  justify-content: center;
  touch-action: none;
  user-select: none;
  width: 100%;

  &:hover .popup-resize-handle__grip,
  &:active .popup-resize-handle__grip {
    background: var(--refresher-primary);
    opacity: 1;
  }
}

.popup-resize-handle__grip {
  background: var(--refresher-border-light);
  border-radius: 999px;
  height: 4px;
  opacity: 0.85;
  transition: background 0.15s ease, opacity 0.15s ease;
  width: 48px;
}
</style>
