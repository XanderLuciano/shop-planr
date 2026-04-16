<script setup lang="ts">
import type { Tag } from '~/types/domain'
import { readableForeground } from '~/utils/tagColor'

const props = defineProps<{ tag: Tag }>()

const fg = computed(() => readableForeground(props.tag.color))
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :style="{ backgroundColor: tag.color, color: fg }"
  >
    {{ tag.name }}
    <slot />
  </span>
</template>
