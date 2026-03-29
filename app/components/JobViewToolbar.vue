<script setup lang="ts">
defineProps<{
  hasExpandedJobs: boolean
  hasExpandedPaths: boolean
  jobCount: number
}>()

defineEmits<{
  'expand-all-jobs': []
  'collapse-all-jobs': []
  'expand-all-paths': []
  'collapse-all-paths': []
}>()
</script>

<template>
  <div class="flex items-center">
    <UTooltip text="Expand All Jobs">
      <UButton
        icon="i-lucide-chevrons-down"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="!jobCount"
        @click="$emit('expand-all-jobs')"
      />
    </UTooltip>
    <UTooltip text="Collapse All Jobs">
      <UButton
        icon="i-lucide-chevrons-up"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="!hasExpandedJobs"
        @click="$emit('collapse-all-jobs')"
      />
    </UTooltip>
    <UTooltip text="Expand All Paths">
      <UButton
        icon="i-lucide-list-tree"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="!jobCount"
        @click="$emit('expand-all-paths')"
      />
    </UTooltip>
    <UTooltip text="Collapse All Paths">
      <UButton
        icon="i-lucide-list-minus"
        variant="ghost"
        color="neutral"
        size="xs"
        :disabled="!hasExpandedPaths"
        @click="$emit('collapse-all-paths')"
      />
    </UTooltip>
  </div>
</template>
