<script setup lang="ts">
import type { JobProgress } from '~/types/computed'

const props = defineProps<{
  jobs: JobProgress[]
}>()
</script>

<template>
  <UCard :ui="{ body: 'p-4 sm:p-4' }">
    <template #header>
      <p class="text-sm font-semibold text-(--ui-text-highlighted)">
        Job Progress
      </p>
    </template>

    <div
      v-if="!props.jobs.length"
      class="text-sm text-(--ui-text-muted) py-4 text-center"
    >
      No active jobs
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <NuxtLink
        v-for="job in props.jobs"
        :key="job.jobId"
        :to="`/jobs/${encodeURIComponent(job.jobId)}`"
        class="flex items-center gap-3 hover:bg-(--ui-bg-elevated)/50 rounded px-1 -mx-1 py-0.5 transition-colors"
      >
        <span
          class="text-xs text-(--ui-text-muted) w-32 truncate shrink-0"
          :title="job.jobName"
        >
          {{ job.jobName }}
        </span>

        <div class="flex-1 h-5 bg-(--ui-bg-accented) rounded overflow-hidden flex">
          <!-- Completed portion (green) -->
          <div
            v-if="job.goalQuantity > 0 && job.completedParts > 0"
            class="h-full bg-green-500 transition-all"
            :style="{ width: Math.min((job.completedParts / job.goalQuantity) * 100, 100) + '%' }"
          />
          <!-- In-progress portion (blue) -->
          <div
            v-if="job.goalQuantity > 0 && job.inProgressParts > 0"
            class="h-full bg-blue-500 transition-all"
            :style="{ width: Math.min((job.inProgressParts / job.goalQuantity) * 100, 100 - Math.min((job.completedParts / job.goalQuantity) * 100, 100)) + '%' }"
          />
        </div>

        <span class="text-xs font-medium text-(--ui-text-highlighted) w-12 text-right shrink-0">
          {{ Math.round(job.progressPercent) }}%
        </span>
      </NuxtLink>
    </div>
  </UCard>
</template>
