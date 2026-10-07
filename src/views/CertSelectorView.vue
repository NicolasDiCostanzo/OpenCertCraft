<script setup lang="ts">
import CertSelector from '../components/cert/CertSelector.vue';
import { useQuizLoader } from '../composables/useQuizLoader';

const { groupedCerts } = useQuizLoader()
</script>

<template>
  <section id="center">
    <CertSelector :groups="groupedCerts" />
  </section>
</template>