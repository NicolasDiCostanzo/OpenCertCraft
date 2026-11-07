<script setup lang="ts">
import { links } from '../../config'
import { texts } from '../../texts/en'
import RequestNotice from '../cert/RequestNotice.vue'
import IconCoffee from '../icons/IconCoffee.vue'
import IconGithub from '../icons/IconGithub.vue'
import ExternalLink from './ExternalLink.vue'
</script>

<template>
  <footer class="app-footer">
    <RequestNotice />
    <div class="app-footer__links">
      <ExternalLink :href="links.repo" :label="texts.repoLinkLabel">
        <template #icon><IconGithub /></template>
      </ExternalLink>
      <ExternalLink :href="links.sponsor" :label="texts.sponsorLinkLabel">
        <template #icon><IconCoffee /></template>
      </ExternalLink>
    </div>
  </footer>
</template>

<style scoped>
  .app-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    justify-content: center;
    padding: 12px 24px calc(12px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .app-footer__links {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 3rem;
  }

  @media (max-width: 720px) {
    .app-footer {
      padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
    }

    .app-footer__links {
      gap: 1.5rem;
    }
  }
</style>
