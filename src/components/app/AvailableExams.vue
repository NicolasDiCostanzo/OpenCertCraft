<script setup lang="ts">
  import { texts } from '../../texts/en'
import type { CertFamilyGroup } from '../../types'
import { familyCertCount } from '../../assets/certFamilies'
import CertCodeBadge from '../cert/CertCodeBadge.vue'
import Badge from '../ui/BaseBadge.vue'
import Card from '../ui/BaseCard.vue'

  const { groups } = defineProps<{ groups: CertFamilyGroup[] }>()
</script>

<template>
  <Card tag="details" padding="lg" class="available-exams">
    <summary class="available-exams__summary">
      <span class="available-exams__chevron" aria-hidden="true">▼</span>
      <span>{{ texts.examsIncluded(familyCertCount(groups)) }}</span>
    </summary>
    <details v-for="group in groups" :key="group.familyId" class="available-exams__group" open>
      <summary class="available-exams__family">
        <span class="available-exams__chevron" aria-hidden="true">▼</span>
        <span>{{ group.label }}</span>
        <span class="available-exams__count">{{ texts.familyCertCount(group.certs.length) }}</span>
      </summary>
      <ul class="available-exams__list">
        <li v-for="cert in group.certs" :key="cert.exam.code" class="available-exams__item">
          <span class="available-exams__name">{{ cert.exam.name }}</span>
          <span class="available-exams__meta">
            <CertCodeBadge :code="cert.exam.code" />
            <Badge variant="weight">{{ texts.questionBankValue(cert.questionCount) }}</Badge>
          </span>
        </li>
      </ul>
    </details>
  </Card>
</template>

<style scoped>
  .available-exams {
    box-sizing: border-box;
    width: 100%;
    text-align: left;
  }

  .available-exams__summary {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    list-style: none;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text);
    transition: color 0.15s ease;
  }

  .available-exams__summary:hover {
    color: var(--text-h);
  }

  .available-exams__summary::-webkit-details-marker {
    display: none;
  }

  .available-exams__chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 11px;
    line-height: 1;
    letter-spacing: 0;
    color: var(--accent);
    transition: transform 0.2s ease;
  }

  .available-exams[open] .available-exams__chevron {
    transform: rotate(180deg);
  }

  .available-exams__family {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 0;
    padding: 0;
    cursor: pointer;
    user-select: none;
    list-style: none;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text);
  }

  .available-exams__family::-webkit-details-marker {
    display: none;
  }

  .available-exams__group:not([open]) .available-exams__chevron {
    transform: rotate(-90deg);
  }

  .available-exams__count {
    margin-left: auto;
    font-weight: 400;
    text-transform: none;
    letter-spacing: normal;
  }

  .available-exams__list {
    display: flex;
    flex-direction: column;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .available-exams__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 6px 12px;
    padding: 10px 0;
  }

  .available-exams__item+.available-exams__item {
    border-top: 1px solid var(--border);
  }

  .available-exams__name {
    font-size: 15px;
    color: var(--text-h);
  }

  .available-exams__meta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

</style>
