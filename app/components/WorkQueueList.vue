<script setup lang="ts">
import type { WorkQueueJob } from '~/server/types/computed'

defineProps<{
  jobs: WorkQueueJob[]
  totalParts: number
  filteredParts: number
  searchActive: boolean
}>()

const emit = defineEmits<{
  'select-job': [job: WorkQueueJob]
}>()

/** Group jobs by jobName for display */
function groupByJob(jobs: WorkQueueJob[]): Map<string, WorkQueueJob[]> {
  const map = new Map<string, WorkQueueJob[]>()
  for (const job of jobs) {
    const key = job.jobId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(job)
  }
  return map
}

function jobPartCount(entries: WorkQueueJob[]): number {
  return entries.reduce((sum, e) => sum + e.partCount, 0)
}

function formatLocation(loc?: string): string {
  return loc ? `📍 ${loc}` : ''
}

function formatNextStep(job: WorkQueueJob): string {
  if (job.isFinalStep) return 'Completed'
  if (!job.nextStepName) return '—'
  return job.nextStepLocation
    ? `${job.nextStepName} → ${job.nextStepLocation}`
    : job.nextStepName
}
</script>

<template>
  <div class="space-y-3">
    <!-- Summary bar -->
    <div class="flex items-center justify-between text-xs text-(--ui-text-muted)">
      <span>
        <span class="font-semibold text-(--ui-text-highlighted)">{{ totalParts }}</span> part{{ totalParts !== 1 ? 's' : '' }} awaiting action
      </span>
      <span v-if="searchActive">
        Showing <span class="font-semibold text-(--ui-text-highlighted)">{{ filteredParts }}</span> of {{ totalParts }}
      </span>
    </div>

    <!-- Empty state -->
    <div
      v-if="jobs.length === 0"
      class="text-center py-8 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-inbox"
        class="size-8 mx-auto mb-2 opacity-40"
      />
      <p>No jobs currently assigned.</p>
    </div>

    <!-- Job groups -->
    <div
      v-for="[jobId, entries] in groupByJob(jobs)"
      :key="jobId"
      class="border border-(--ui-border) rounded-md overflow-hidden"
    >
      <!-- Job header -->
      <div class="flex items-center justify-between px-3 py-2 bg-(--ui-bg-elevated)/50">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-(--ui-text-highlighted)">{{ entries[0]!.jobName }}</span>
          <UBadge
            color="primary"
            variant="subtle"
            size="xs"
          >
            {{ jobPartCount(entries) }} part{{ jobPartCount(entries) !== 1 ? 's' : '' }}
          </UBadge>
        </div>
      </div>

      <!-- Step rows within this job -->
      <div class="divide-y divide-(--ui-border)">
        <button
          v-for="entry in entries"
          :key="`${entry.pathId}-${entry.stepOrder}`"
          class="w-full text-left px-3 py-2 hover:bg-(--ui-bg-elevated)/30 transition-colors cursor-pointer"
          type="button"
          @click="emit('select-job', entry)"
        >
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2 text-xs">
                <span class="font-medium text-(--ui-text-highlighted)">{{ entry.stepName }}</span>
                <span
                  v-if="entry.stepLocation"
                  class="text-(--ui-text-muted)"
                >{{ formatLocation(entry.stepLocation) }}</span>
              </div>
              <div class="text-xs text-(--ui-text-muted)">
                {{ entry.pathName }} · Step {{ entry.stepOrder + 1 }}/{{ entry.totalSteps }}
                · Next: {{ formatNextStep(entry) }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <UBadge
                :color="entry.isFinalStep ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ entry.partCount }}
              </UBadge>
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-(--ui-text-muted)"
              />
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
