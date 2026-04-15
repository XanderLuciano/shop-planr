<script setup lang="ts">
import type { Tag } from '~/types/domain'
defineProps<{ tag: Tag }>()
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
    :style="{ backgroundColor: tag.color }"
  >{{ tag.name }}</span>
</template>
