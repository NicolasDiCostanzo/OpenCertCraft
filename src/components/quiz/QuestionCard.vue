<script setup lang="ts">
import { computed } from 'vue';
import { texts } from '../../texts/en';
import type { Question } from '../../types';
import RichText from '../ui/RichText.vue';
import QuestionOptionsList from './QuestionOptionsList.vue';

const props = defineProps<{
  question: Question
  selected: string[]
  reveal: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [questionId: string, selected: string[]]
}>()

const isMultiAnswer = computed(() => Array.isArray(props.question.answers) && props.question.answers.length > 1)

function toggle(letter: string) {
  if (props.disabled) return
  const current = props.selected
  if (isMultiAnswer.value) {
    const next = current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter]
    emit('select', props.question.id, next)
  } else {
    emit('select', props.question.id, [letter])
  }
}

function isCorrectLetter(letter: string): boolean {
  const expected = Array.isArray(props.question.answers) ? props.question.answers : [props.question.answers]
  return expected.includes(letter)
}

const isCorrect = computed(() => props.selected.length > 0 && props.selected.every((l) => isCorrectLetter(l)) && props.selected.length === (Array.isArray(props.question.answers) ? props.question.answers.length : 1))

const displayAnswer = computed(() => {
  const expected = Array.isArray(props.question.answers) ? props.question.answers : [props.question.answers]
  return expected.join(', ')
})
</script>

<template>
  <div class="question">
    <div class="question-text">
      <RichText :text="question.question" />
    </div>

    <ul v-if="question.promptImages?.length" class="prompt-images">
      <li v-for="(img, i) in question.promptImages" :key="i">
        <img :src="img" :alt="texts.promptImageAlt" />
      </li>
    </ul>

    <QuestionOptionsList
      :question="question"
      :selected="selected"
      :reveal="reveal"
      :disabled="disabled"
      interactive
      variant="live"
      @toggle="toggle"
    />

    <div v-if="reveal" class="feedback" :class="isCorrect ? 'feedback--correct' : 'feedback--incorrect'">
      <span class="feedback-badge">{{ isCorrect ? texts.correct : texts.incorrect }}</span>
      <div v-if="!isCorrect || question.explanation" class="feedback-explanation">
        <template v-if="!isCorrect">
          <strong>{{ texts.correctAnswer }}:</strong> {{ displayAnswer }}<br />
        </template>
        <template v-if="question.explanation">
          <strong>{{ texts.explanation }}:</strong>
          <RichText :text="question.explanation" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-text {
  font-size: 17px;
  line-height: 1.5;
  color: var(--text-h);
  margin: 0 0 16px;
}

.prompt-images {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-images img {
  max-width: 100%;
  border-radius: 6px;
}

.feedback {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid;
}

.feedback--correct {
  border-color: var(--green);
  background: var(--accent-bg);
}

.feedback--incorrect {
  border-color: var(--red);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.feedback-badge {
  font-weight: 600;
  font-size: 14px;
}

.feedback--correct .feedback-badge {
  color: var(--accent);
}

.feedback--incorrect .feedback-badge {
  color: var(--text);
}

.feedback-explanation {
  margin: 8px 0 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}
</style>
