<script setup lang="ts">
import { texts } from '../../texts/en'
import IconHeart from '../icons/IconHeart.vue'

defineProps<{ active: boolean; certName: string }>()

const emit = defineEmits<{ (e: 'toggle'): void }>()

function onClick(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  emit('toggle')
}
</script>

<template>
  <button
    type="button"
    class="favorite-btn"
    :class="{ 'favorite-btn--active': active }"
    :aria-label="active ? `${texts.favoriteRemove}: ${certName}` : `${texts.favoriteAdd}: ${certName}`"
    @click="onClick"
  >
    <IconHeart :filled="active" />
  </button>
</template>

<style scoped>
.favorite-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  cursor: pointer;
  color: var(--text);
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.15s ease;
}

.favorite-btn:hover {
  color: var(--accent);
  background: var(--accent-bg);
  transform: scale(1.08);
}

.favorite-btn--active {
  color: var(--accent);
}

.favorite-btn :deep(svg) {
  width: 22px;
  height: 22px;
}
</style>
