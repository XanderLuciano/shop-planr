<script setup lang="ts">
defineProps<{
  isBottleneck: boolean
}>()
</script>

<template>
  <UBadge v-if="isBottleneck" color="warning" variant="subtle" size="xs">
    <UIcon name="i-lucide-alert-triangle" class="size-3 mr-0.5" />
    Bottleneck
  </UBadge>
</template>
