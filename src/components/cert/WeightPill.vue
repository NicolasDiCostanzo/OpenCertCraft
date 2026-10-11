<script setup lang="ts">
import Badge from '../ui/BaseBadge.vue';

withDefaults(defineProps<{ topic: string; weight: number; showWeight?: boolean }>(), {
  showWeight: true,
})
</script>

<template>
  <Badge as="li" variant="weight" class="weight-pill">
    <template v-if="showWeight"><strong>{{ weight }}%</strong> {{ topic }}</template>
    <template v-else>{{ topic }}</template>
  </Badge>
</template>

<style scoped>
.weight-pill {
  overflow: hidden;
  min-width: 0;
}

.weight-pill strong {
  color: var(--accent);
}
</style>
