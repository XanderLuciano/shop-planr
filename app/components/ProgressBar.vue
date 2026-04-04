<script setup lang="ts">
import { computeProgressBar } from '~/utils/progressBar'

const props = withDefaults(defineProps<{
  completed: number
  goal: number
  inProgress?: number
}>(), {
  inProgress: 0,
})

const progress = computed(() => computeProgressBar({
  completed: props.completed,
  goal: props.goal,
  inProgress: props.inProgress,
}))
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
      <div
        v-if="progress.completedWidth > 0"
        class="h-full bg-[#22C55E] transition-all"
        :style="{ width: progress.completedWidth + '%' }"
      />
      <div
        v-if="progress.inProgressWidth > 0"
        class="h-full bg-[#3B82F6] transition-all"
        :style="{ width: progress.inProgressWidth + '%' }"
      />
    </div>
    <span class="text-xs font-medium text-(--ui-text-muted) w-10 text-right shrink-0">
      {{ progress.displayPercent }}%
    </span>
  </div>
</template>
