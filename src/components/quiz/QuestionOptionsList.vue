<script setup lang="ts">
import { computed } from 'vue'
import type { Question } from '../../types'
import RichText from '../ui/RichText.vue'

const props = withDefaults(defineProps<{
  question: Question
  selected: string[]
  reveal?: boolean
  interactive?: boolean
  disabled?: boolean
  variant?: 'live' | 'review'
}>(), {
  reveal: true,
  interactive: false,
  disabled: false,
  variant: 'review',
})

const emit = defineEmits<{
  toggle: [letter: string]
}>()

const isMultiAnswer = computed(() => Array.isArray(props.question.answers) && props.question.answers.length > 1)

function letterFor(index: number): string {
  return String.fromCharCode(65 + index)
}

function isCorrectLetter(letter: string): boolean {
  const expected = Array.isArray(props.question.answers) ? props.question.answers : [props.question.answers]
  return expected.includes(letter)
}

function letterClass(letter: string): string {
  if (!props.reveal) return ''
  if (isCorrectLetter(letter)) return 'option--correct'
  if (props.selected.includes(letter)) return 'option--incorrect'
  return 'option--missed'
}
</script>

<template>
  <div class="options" :class="`options--${variant}`">
    <label
      v-for="(option, i) in question.options"
      :key="i"
      class="option"
      :class="[letterClass(letterFor(i)), { 'option--selected': interactive && selected.includes(letterFor(i)) }]"
    >
      <input
        v-if="interactive"
        :type="isMultiAnswer ? 'checkbox' : 'radio'"
        :name="question.id"
        :value="letterFor(i)"
        :checked="selected.includes(letterFor(i))"
        :disabled="disabled"
        @change="emit('toggle', letterFor(i))"
      />
      <span class="option-letter">{{ letterFor(i) }}</span>
      <div class="option-text">
        <RichText :text="option" />
      </div>
    </label>
  </div>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.options--live .option {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.options--live .option:hover {
  border-color: var(--accent);
}

.option--selected {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.option--correct {
  border-color: var(--green);
}

.option--incorrect {
  border-color: var(--red);
}

.option--missed {
  opacity: 0.6;
}

.options--live .option--correct {
  background: var(--accent-bg);
}

.options--live .option--incorrect {
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.options--review .option--correct {
  background: color-mix(in srgb, var(--green) 10%, var(--surface));
}

.options--review .option--incorrect {
  background: color-mix(in srgb, var(--red) 10%, var(--surface));
}

.option input {
  margin-top: 2px;
  accent-color: var(--accent);
}

.option-letter {
  font-weight: 600;
  color: var(--text-h);
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  min-width: 0;
  color: var(--text);
  text-align: left;
}
</style>
