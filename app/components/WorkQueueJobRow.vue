<script setup lang="ts">
import type { WorkQueueJob, GroupByDimension } from '~/types/computed'

const props = defineProps<{
  job: WorkQueueJob
  /** Current grouping dimension — used to suppress redundant info */
  groupBy?: GroupByDimension
}>()

defineEmits<{
  select: [job: WorkQueueJob]
}>()

/** Hide step name when grouped by step (group header already shows it) */
const showStepName = computed(() => props.groupBy !== 'step')

/** Hide location when grouped by location (group header already shows it) */
const showLocation = computed(() => props.groupBy !== 'location' && !!props.job.stepLocation)

/** Progress percentage for the goal bar (0–100), only when goalQuantity is set */
const progressPercent = computed(() => {
  const goal = props.job.goalQuantity
  const done = props.job.completedCount ?? 0
  if (!goal || goal <= 0) return 0
  return Math.min(100, Math.round((done / goal) * 100))
})
</script>

<template>
  <button
    class="w-full text-left px-3 py-2 hover:bg-(--ui-bg-elevated)/30 transition-colors cursor-pointer border-l-2"
    :class="job.isFinalStep ? 'border-l-(--ui-success)' : 'border-l-(--ui-primary)/40'"
    type="button"
    @click="$emit('select', props.job)"
  >
    <div class="flex items-center justify-between gap-3">
      <!-- Left: info stack -->
      <div class="min-w-0 space-y-0.5">
        <!-- Primary line: job name + path -->
        <div class="flex items-center gap-1.5 text-xs">
          <span class="font-medium text-(--ui-text-highlighted) truncate">
            {{ job.jobName }}
          </span>
          <span class="text-(--ui-text-muted)">·</span>
          <span class="text-(--ui-text-muted) truncate">{{ job.pathName }}</span>
        </div>

        <!-- Secondary line: step info + location -->
        <div class="flex items-center gap-1.5 text-xs text-(--ui-text-muted)">
          <UIcon
            name="i-lucide-layers"
            class="size-3 shrink-0"
          />
          <span v-if="showStepName">{{ job.stepName }} ·</span>
          <span class="shrink-0">step {{ job.stepOrder + 1 }} of {{ job.totalSteps }}</span>
          <template v-if="showLocation">
            <span>·</span>
            <span class="inline-flex items-center gap-0.5 shrink-0">
              <UIcon
                name="i-lucide-map-pin"
                class="size-3"
              />
              {{ job.stepLocation }}
            </span>
          </template>
        </div>
      </div>

      <!-- Right: parts waiting + goal progress + chevron -->
      <div class="flex items-center gap-3 shrink-0">
        <!-- Parts waiting at this step -->
        <div class="flex items-center gap-1.5">
          <UBadge
            :color="job.isFinalStep ? 'success' : 'primary'"
            variant="subtle"
            size="xs"
          >
            {{ job.partCount }} {{ job.partCount === 1 ? 'part' : 'parts' }}
          </UBadge>
        </div>

        <!-- Goal progress (when goalQuantity is set) -->
        <div
          v-if="job.goalQuantity != null"
          class="flex items-center gap-1.5 text-xs text-(--ui-text-muted)"
        >
          <div class="w-12 h-1.5 rounded-full bg-(--ui-bg-elevated) overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="progressPercent >= 100 ? 'bg-(--ui-success)' : 'bg-(--ui-primary)'"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <span class="tabular-nums">{{ job.completedCount }}/{{ job.goalQuantity }}</span>
        </div>

        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 text-(--ui-text-muted)"
        />
      </div>
    </div>
  </button>
</template>
