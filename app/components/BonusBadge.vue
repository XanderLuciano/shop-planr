<script setup lang="ts">
defineProps<{
  show: boolean
}>()
</script>

<template>
  <UBadge
    v-if="show"
    color="info"
    variant="subtle"
    size="xs"
  >
    Bonus
  </UBadge>
</template>
