<script setup lang="ts">
import { texts } from '../../texts/en'
import type { Question } from '../../types'
import Badge from '../ui/BaseBadge.vue'
import RichText from '../ui/RichText.vue'

defineProps<{ questions: Question[] }>()

const letterFor = (index: number): string => String.fromCharCode(65 + index)
const themeEntries = (question: Question): [string, string[]][] =>
  Object.entries(question.themes ?? {}).filter(([, values]) => values.length > 0)
const answerLetters = (question: Question): string => [question.answers].flat().join(', ')
</script>

<template>
  <details v-if="questions.length > 0" class="samples">
    <summary>{{ texts.sampleQuestionsTitle }}</summary>
    <article v-for="question in questions" :key="question.id" class="sample">
      <div class="sample__tags">
        <Badge variant="tag">{{ texts.topic }}: {{ question.topic }}</Badge>
        <Badge v-for="[group, values] in themeEntries(question)" :key="group" variant="tag">
          {{ texts.themeGroupDisplay(group, values) }}
        </Badge>
      </div>
      <RichText :text="question.question" />
      <ol class="sample__options">
        <li v-for="(option, i) in question.options" :key="i">
          <span class="sample__letter">{{ letterFor(i) }}</span>
          <RichText :text="option" />
        </li>
      </ol>
      <details class="sample__answer">
        <summary>{{ texts.showAnswer }}</summary>
        <p>
          <strong>{{ texts.correctAnswer }}:</strong> {{ answerLetters(question) }}
        </p>
        <div v-if="question.explanation">
          <strong>{{ texts.explanation }}:</strong>
          <RichText :text="question.explanation" />
        </div>
      </details>
    </article>
  </details>
</template>

<style scoped>
.samples {
  border-top: 1px solid var(--border);
}

.samples > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 0;
  list-style: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}

.samples > summary::-webkit-details-marker {
  display: none;
}

.samples > summary::after {
  content: '▼';
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
  transition: transform 0.2s ease;
}

.samples[open] > summary {
  margin-bottom: 12px;
}

.samples[open] > summary::after {
  transform: rotate(180deg);
}

.sample {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-h);
}

.sample__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.sample__tags :deep(.badge) {
  white-space: normal;
}

@media (max-width: 600px) {
  .sample__tags :deep(.badge) {
    padding: 4px 10px;
    border-radius: var(--radius-lg);
    line-height: 1.35;
  }
}

.sample__options {
  margin: 10px 0;
  padding: 0;
  list-style: none;
  color: var(--text);
}

.sample__options li {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.sample__letter {
  flex: none;
  font-weight: 600;
  color: var(--text-h);
}

.sample__answer summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-h);
}

.sample__answer p {
  margin: 8px 0;
}
</style>
