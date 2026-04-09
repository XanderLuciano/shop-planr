<script setup lang="ts">
import type { WorkQueueJob } from '~/types/computed'

const props = defineProps<{
  job: WorkQueueJob
}>()

defineEmits<{
  select: [job: WorkQueueJob]
}>()

function formatLocation(loc?: string): string {
  return loc ? `📍 ${loc}` : ''
}

function formatSubtitle(job: WorkQueueJob): string {
  const parts = [job.jobName, job.pathName, `Step ${job.stepOrder + 1}/${job.totalSteps}`]
  return parts.join(' · ')
}
</script>

<template>
  <button
    class="w-full text-left px-3 py-2 hover:bg-(--ui-bg-elevated)/30 transition-colors cursor-pointer"
    type="button"
    @click="$emit('select', props.job)"
  >
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 text-xs">
          <span class="font-medium text-(--ui-text-highlighted)">{{ job.stepName }}</span>
          <span
            v-if="job.stepLocation"
            class="text-(--ui-text-muted)"
          >{{ formatLocation(job.stepLocation) }}</span>
        </div>
        <div class="text-xs text-(--ui-text-muted)">
          <slot name="subtitle">
            {{ formatSubtitle(job) }}
          </slot>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UBadge
          :color="job.isFinalStep ? 'success' : 'neutral'"
          variant="subtle"
          size="xs"
        >
          {{ job.partCount }}
        </UBadge>
        <span
          v-if="job.goalQuantity != null"
          class="text-xs text-(--ui-text-muted)"
        >
          {{ job.completedCount }} / {{ job.goalQuantity }} completed
        </span>
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 text-(--ui-text-muted)"
        />
      </div>
    </div>
  </button>
</template>
