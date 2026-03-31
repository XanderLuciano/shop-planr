<script setup lang="ts">
import type { Job } from '~/server/types/domain'
import type { JobProgress } from '~/server/types/computed'

defineProps<{
  job: Job
  progress: JobProgress | null
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="p-3 rounded-lg border border-(--ui-border) hover:bg-(--ui-bg-elevated)/50 cursor-pointer space-y-2"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div class="flex items-center justify-between">
      <span class="font-medium text-sm">{{ job.name }}</span>
      <span v-if="job.jiraPriority" class="text-xs text-(--ui-text-muted)">{{ job.jiraPriority }}</span>
    </div>
    <div class="flex items-center gap-3 text-xs text-(--ui-text-muted)">
      <span v-if="job.jiraPartNumber">Part: {{ job.jiraPartNumber }}</span>
      <span>Qty: {{ job.goalQuantity }}</span>
    </div>
    <ProgressBar
      v-if="progress"
      :completed="progress.completedParts"
      :goal="progress.goalQuantity"
      :in-progress="progress.inProgressParts"
    />
  </div>
</template>
