<script setup lang="ts">
import { computed } from 'vue'
import { parseInlineSegments } from '../../utils/markdownImage'

const props = defineProps<{
  text: string
}>()

const segments = computed(() => parseInlineSegments(props.text))
</script>

<template>
  <div class="rich-text">
    <template v-for="(segment, i) in segments" :key="i">
      <pre v-if="segment.type === 'code-block'" class="rich-text__block"><code>{{ segment.value }}</code></pre>
      <img v-else-if="segment.type === 'image'" :src="segment.value" :alt="segment.alt" class="rich-text__image" />
      <code v-else-if="segment.type === 'inline-code'" class="rich-text__inline">{{ segment.value }}</code>
      <span v-else class="rich-text__text">{{ segment.value }}</span>
    </template>
  </div>
</template>

<style scoped>
.rich-text {
  min-width: 0;
}

.rich-text__text {
  white-space: pre-wrap;
}

.rich-text__inline {
  font-family: var(--mono);
  font-size: 0.92em;
  background: var(--code-bg);
  border-radius: 4px;
  padding: 1px 5px;
  overflow-wrap: break-word;
}

.rich-text__block {
  display: block;
  margin: 8px 0;
  padding: 10px 12px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-h);
  white-space: pre-wrap;
  overflow-wrap: break-word;
  overflow-x: auto;
}

.rich-text__image {
  display: block;
  max-width: 100%;
  border-radius: 6px;
}
</style>
