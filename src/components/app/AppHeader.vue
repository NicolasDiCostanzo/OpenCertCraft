<script setup lang="ts">
  import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccount } from '../../composables/useAccount'
import { useThemeMode } from '../../composables/useThemeMode'
import { links } from '../../config'
import { useUserAccountStore } from '../../stores/userAccount'
import { texts } from '../../texts/en'
import IconCoffee from '../icons/IconCoffee.vue'
import IconGithub from '../icons/IconGithub.vue'
import IconLogo from '../icons/IconLogo.vue'
import IconMoon from '../icons/IconMoon.vue'
import IconSun from '../icons/IconSun.vue'
import SecondaryButton from '../ui/SecondaryButton.vue'
import ExternalLink from './ExternalLink.vue'

  const router = useRouter()
  const preferences = useThemeMode()
  const account = useUserAccountStore()
  const { signOut } = useAccount()

  const signOutPending = ref(false)

  const titleTarget = computed(() => (account.accountMode === 'account' ? '/cert' : '/'))

  async function handleSignOut() {
    if (signOutPending.value) return
    signOutPending.value = true
    try {
      await signOut()
    } finally {
      signOutPending.value = false
    }
  }

  function goToWelcome() {
    router.push({ name: 'welcome' })
  }
</script>

<template>
  <header class="app-header">
    <RouterLink :to="titleTarget" class="app-title" :title="texts.appTitle">
      <IconLogo class="app-title__logo" />
      <span class="app-title__name">{{ texts.headerBrand }}</span>
    </RouterLink>
    <div class="app-header__actions">
      <div class="app-header__links">
        <ExternalLink :href="links.repo" icon-only>
          <template #icon><IconGithub /></template>
        </ExternalLink>
        <ExternalLink :href="links.sponsor" icon-only>
          <template #icon><IconCoffee /></template>
        </ExternalLink>
      </div>
      <span class="app-header__divider" aria-hidden="true"></span>
      <div v-if="account.user" class="account-chip">
        <span class="account-chip__email">{{ account.user.email ?? account.user.userId }}</span>
        <SecondaryButton size="sm" :disabled="signOutPending" @click="handleSignOut">{{ texts.signOut }}
        </SecondaryButton>
      </div>
      <SecondaryButton v-else-if="account.accountMode === 'local'" size="sm" @click="goToWelcome">
        {{ texts.signIn }}
      </SecondaryButton>
      <button type="button" class="theme-switch" role="switch" :aria-checked="preferences.dark"
        :aria-label="texts.themeToggle(preferences.dark)" @click="preferences.toggleTheme()">
        <span class="theme-switch__track">
          <span class="theme-switch__knob"></span>
          <span class="theme-switch__option" :class="{ 'is-active': !preferences.dark }">
            <IconSun class="icon" />
          </span>
          <span class="theme-switch__option" :class="{ 'is-active': preferences.dark }">
            <IconMoon class="icon" />
          </span>
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 24px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    text-align: left;
  }

  .app-title {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--text-h);
    text-decoration: none;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .app-title__logo {
    width: 30px;
    height: 30px;
    color: var(--brand);
    flex-shrink: 0;
    transition: color 0.15s ease, opacity 0.15s ease;
  }

  .app-title:hover .app-title__logo {
    color: var(--text-h);
  }

  .app-title__name {
    font-family: var(--heading);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.2px;
    color: var(--brand);
  }

  .app-header__actions {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .app-header__links {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .app-header__divider {
    width: 1px;
    height: 24px;
    background: var(--border);
    flex-shrink: 0;
  }

  .account-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .account-chip .btn {
    white-space: nowrap;
    flex-shrink: 0;
  }

  .account-chip__email {
    font-size: 14px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .theme-switch {
    display: inline-flex;
    align-items: center;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
  }

  .theme-switch__track {
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 60px;
    height: 32px;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--bg);
    transition: border-color 0.15s ease;
  }

  .theme-switch:hover .theme-switch__track {
    border-color: var(--accent);
  }

  .theme-switch__knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    transition: transform 0.18s ease;
  }

  .theme-switch[aria-checked='true'] .theme-switch__knob {
    transform: translateX(28px);
  }

  .theme-switch__option {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--text);
    opacity: 0.55;
    transition: opacity 0.15s ease;
  }

  .theme-switch__option.is-active {
    opacity: 1;
    color: var(--text-inverse);
  }

  .theme-switch .icon {
    width: 15px;
    height: 15px;
  }

  @media (max-width: 1024px) {
    .app-header {
      padding: 10px 20px;
    }
  }

  @media (max-width: 720px) {
    .app-header {
      padding: 10px 16px;
      gap: 10px;
    }

    .app-header__actions {
      gap: 8px;
    }

    .app-header__divider {
      display: none;
    }
  }

  @media (max-width: 500px) {
    .app-title__name {
      display: none;
    }

    .account-chip {
      gap: 6px;
    }

    .account-chip__email {
      display: none;
    }
  }
</style>
