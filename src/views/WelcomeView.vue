<script setup lang="ts">
  import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AvailableExams from '../components/app/AvailableExams.vue';
import WelcomeCard from '../components/app/WelcomeCard.vue';
import WelcomeSyncCard from '../components/app/WelcomeSyncCard.vue';
import WelcomeEyebrow from '../components/ui/WelcomeEyebrow.vue';
import { useAccount } from '../composables/useAccount';
import { useQuizLoader } from '../composables/useQuizLoader';
import { isAuthAvailable, isSyncConfigured } from '../config';
import { useQuizHistoryStore } from '../stores/quizHistory';
import { useUserProgressStore } from '../stores/userProgress';
import { texts } from '../texts/en';

  const router = useRouter();
  const { continueLocal } = useAccount()
  const authAvailable = isAuthAvailable()
  const syncAvailable = isSyncConfigured()
  const canSyncLater = authAvailable && syncAvailable
  const { groupedCerts } = useQuizLoader()
  const historyStore = useQuizHistoryStore();
  const progressStore = useUserProgressStore();
  const hasLocalData = computed(
    () => historyStore.entries.length > 0 || Object.keys(progressStore.byExamCode).length > 0,
  )

  function openSignIn() {
    router.push({ name: 'auth', query: { mode: 'signin' } })
  }

  function openSignUp() {
    router.push({ name: 'auth', query: { mode: 'signup' } })
  }

  function openUpload() {
    router.push({ name: 'auth', query: { mode: 'signin', upload: '1' } })
  }
</script>

<template>
  <section id="center" class="welcome">
    <div class="welcome__intro">
      <h1>{{ texts.welcomeIntroTitle }}</h1>
      <WelcomeEyebrow :points="texts.welcomeEyebrowPoints" />
    </div>
    <div class="welcome__start">
      <WelcomeSyncCard v-if="authAvailable" :title="texts.welcomeSyncTitle"
        :description="syncAvailable ? texts.welcomeSyncDesc : texts.welcomeSyncDescNoSync"
        :sign-in-label="texts.welcomeExistingAccountCta" :sign-up-label="texts.welcomeNewAccountCta"
        @sign-in="openSignIn" @sign-up="openSignUp" />
      <WelcomeCard v-if="authAvailable && syncAvailable && hasLocalData" variant="secondary"
        :title="texts.welcomeUploadData" :description="texts.welcomeUploadDataDesc"
        :cta-label="texts.welcomeUploadDataCta" @select="openUpload" />
      <WelcomeCard variant="primary" :title="texts.welcomeNoAccount"
        :description="canSyncLater ? texts.welcomeNoAccountDesc : texts.welcomeNoAccountDescNoSync"
        :cta-label="texts.welcomeNoAccountCta" @select="continueLocal" />
    </div>
    <AvailableExams :groups="groupedCerts" />
  </section>
</template>

<style scoped>
  .welcome__intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 600px;
  }

  .welcome__intro h1 {
    margin: 0;
    font-size: 40px;
    letter-spacing: -1.2px;
    line-height: 118%;
  }

  .welcome__intro p {
    margin: 4px 0 0;
    color: var(--text-h);
    font-size: 21px;
    font-weight: 600;
    line-height: 150%;
    letter-spacing: -0.2px;
    text-align: center;
    text-wrap: balance;
    max-width: 38ch;
  }

  .welcome :deep(.available-exams),
  .welcome :deep(.welcome-steps) {
    align-self: stretch;
    width: 100%;
  }

  .welcome__start {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 600px;
  }

  @media (max-width: 1024px) {
    .welcome__intro {
      max-width: 100%;
    }

    .welcome__intro h1 {
      font-size: 28px;
      letter-spacing: -0.6px;
    }

    .welcome__intro p {
      font-size: 18px;
    }

    .welcome :deep(.available-exams),
    .welcome :deep(.welcome-steps),
    .welcome__start {
      max-width: 100%;
    }
  }
</style>