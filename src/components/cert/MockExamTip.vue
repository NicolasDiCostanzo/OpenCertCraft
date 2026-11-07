<script setup lang="ts">
import { texts } from '../../texts/en'
</script>

<template>
  <aside class="mock-exam-tip">
    <strong>{{ texts.mockExamTipTitle }}</strong>
    <p>{{ texts.mockExamTipBody }}</p>
  </aside>
</template>

<style scoped>
.mock-exam-tip {
  margin: 24px 0;
  padding: 12px 16px;
  border: 1px solid var(--accent-border);
  border-left-width: 4px;
  border-radius: 8px;
  background: var(--accent-bg);
  color: var(--text-h);
  text-align: left;
}

.mock-exam-tip p {
  margin: 6px 0 0;
  color: var(--text);
}
</style>
