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
        class="block hover:bg-(--ui-bg-elevated)/50 rounded px-1 -mx-1 py-0.5 transition-colors"
      >
        <div class="relative h-7 bg-(--ui-bg-accented) rounded overflow-hidden flex">
          <!-- Completed portion (green) -->
          <div
            v-if="job.goalQuantity > 0 && job.completedParts > 0"
            class="h-full bg-green-400 dark:bg-green-700 transition-all"
            :style="{ width: Math.min((job.completedParts / job.goalQuantity) * 100, 100) + '%' }"
          />
          <!-- In-progress portion (blue) -->
          <div
            v-if="job.goalQuantity > 0 && job.inProgressParts > 0"
            class="h-full bg-blue-300 dark:bg-blue-700 transition-all"
            :style="{ width: Math.min((job.inProgressParts / job.goalQuantity) * 100, 100 - Math.min((job.completedParts / job.goalQuantity) * 100, 100)) + '%' }"
          />

          <!-- Overlaid job name (left) + percentage pill (right) -->
          <span class="absolute inset-0 flex items-center justify-between text-xs font-bold px-2 dark:text-white text-gray-800 drop-shadow-sm">
            <span class="truncate">{{ job.jobName }}</span>
            <UTooltip :delay-duration="0" :disable-hoverable-content="true" :ui="{ content: 'h-auto max-h-none pointer-events-none' }">
              <span class="shrink-0 ml-2 inline-flex items-center bg-black/15 dark:bg-white/15 rounded-full overflow-hidden text-[10px] cursor-default" @click.prevent.stop>
                <span class="px-1.5 py-0.5">{{ Math.round(job.progressPercent) }}%</span>
              </span>
              <template #content>
                <div class="text-xs p-1.5 w-40">
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="flex items-center gap-1.5">
                      <span class="size-2 rounded-full bg-green-400 dark:bg-green-700 shrink-0" />
                      <span class="text-(--ui-text-muted)">Completed</span>
                    </span>
                    <span class="font-semibold tabular-nums">{{ job.completedParts }}</span>
                  </div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="flex items-center gap-1.5">
                      <span class="size-2 rounded-full bg-blue-300 dark:bg-blue-700 shrink-0" />
                      <span class="text-(--ui-text-muted)">In Progress</span>
                    </span>
                    <span class="font-semibold tabular-nums">{{ job.inProgressParts }}</span>
                  </div>
                  <div class="border-t border-(--ui-border) pt-1.5 flex items-center justify-between">
                    <span class="text-(--ui-text-muted)">Goal</span>
                    <span class="font-semibold tabular-nums">{{ job.completedParts + job.inProgressParts }} / {{ job.goalQuantity }}</span>
                  </div>
                </div>
              </template>
            </UTooltip>
          </span>
        </div>
      </NuxtLink>
    </div>
  </UCard>
</template>
