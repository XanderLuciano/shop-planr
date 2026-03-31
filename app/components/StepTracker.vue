<script setup lang="ts">
import type { Path, ShopUser } from '~/types/domain'
import type { StepDistribution } from '~/types/computed'

const props = withDefaults(defineProps<{
  path: Path
  distribution: StepDistribution[]
  completedCount?: number
  users?: ShopUser[]
  stepAssignments?: Record<string, string | undefined>
}>(), {
  completedCount: 0,
  users: () => [],
})

const emit = defineEmits<{
  'step-click': [payload: { stepId: string, stepName: string, stepOrder: number }]
  'assigned': [stepId: string, userId: string | null]
}>()

function handleStepClick(step: StepDistribution) {
  emit('step-click', { stepId: step.stepId, stepName: step.stepName, stepOrder: step.stepOrder })
}

function getProcessStep(stepId: string) {
  return props.path.steps.find(s => s.id === stepId)
}

function stepBorderClass(step: StepDistribution) {
  const ps = getProcessStep(step.stepId)
  if (step.isBottleneck) return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
  if (ps?.optional) return 'border-dashed border-(--ui-border) bg-(--ui-bg-elevated)/50'
  return 'border-(--ui-border) bg-(--ui-bg-elevated)/50'
}

function depIcon(depType?: string) {
  switch (depType) {
    case 'physical': return 'i-lucide-lock'
    case 'completion_gate': return 'i-lucide-shield-check'
    default: return ''
  }
}
</script>

<template>
  <div class="flex flex-col md:flex-row md:flex-wrap justify-start gap-x-1 gap-y-2 items-stretch py-1">
    <template
      v-for="(step, i) in distribution"
      :key="step.stepId"
    >
      <!-- Arrow between steps -->
      <div v-if="i > 0" class="flex items-center justify-center shrink-0">
        <UIcon name="i-lucide-chevron-right" class="size-4 text-(--ui-text-muted) hidden md:block" />
        <UIcon name="i-lucide-chevron-down" class="size-4 text-(--ui-text-muted) md:hidden" />
      </div>

      <!-- Mobile: horizontal card layout -->
      <div
        class="md:hidden rounded border px-3 py-2 cursor-pointer transition-colors hover:border-(--ui-primary) hover:bg-(--ui-primary)/5"
        :class="stepBorderClass(step)"
        role="button"
        tabindex="0"
        @click="handleStepClick(step)"
        @keydown.enter.prevent="handleStepClick(step)"
        @keydown.space.prevent="handleStepClick(step)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <span class="text-[10px] text-(--ui-text-muted) flex items-center gap-0.5">
              Step {{ i + 1 }}
              <UIcon v-if="depIcon(getProcessStep(step.stepId)?.dependencyType)" :name="depIcon(getProcessStep(step.stepId)?.dependencyType)!" class="size-2.5" />
              <span v-if="getProcessStep(step.stepId)?.optional" class="italic ml-1">Optional</span>
            </span>
            <div class="text-sm font-medium text-(--ui-text-highlighted)">{{ step.stepName }}</div>
            <div v-if="step.location" class="text-xs text-(--ui-text-muted)">{{ step.location }}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-xs">
              <span class="font-bold text-(--ui-text-highlighted)">{{ step.partCount }}</span>
              <span class="text-(--ui-text-muted)"> at</span>
            </div>
            <div class="text-xs text-green-600 dark:text-green-400">{{ step.completedCount }} done</div>
            <BottleneckBadge v-if="step.isBottleneck" :is-bottleneck="true" class="mt-0.5" />
          </div>
        </div>
        <div v-if="users.length" class="mt-1.5" @click.stop>
          <StepAssignmentDropdown
            :step-id="step.stepId"
            :current-assignee="getProcessStep(step.stepId)?.assignedTo"
            :users="users"
            @assigned="(stepId: string, userId: string | null) => emit('assigned', stepId, userId)"
          />
        </div>
      </div>

      <!-- Desktop: compact centered card -->
      <div
        class="hidden md:flex flex-col items-center justify-center md:min-w-[110px] md:max-w-[150px] md:flex-1 px-1.5 py-1 rounded border text-center cursor-pointer transition-colors hover:border-(--ui-primary) hover:bg-(--ui-primary)/5"
        :class="stepBorderClass(step)"
        @click="handleStepClick(step)"
      >
      <span class="text-[10px] text-(--ui-text-muted) mb-0.5 flex items-center gap-0.5">
        Step {{ i + 1 }}
        <UIcon v-if="depIcon(getProcessStep(step.stepId)?.dependencyType)" :name="depIcon(getProcessStep(step.stepId)?.dependencyType)!" class="size-2.5" />
      </span>
      <span class="text-xs font-medium text-(--ui-text-highlighted) truncate max-w-[100px]" :title="step.stepName">{{ step.stepName }}</span>
      <span v-if="step.location" class="text-[10px] text-(--ui-text-muted) truncate max-w-[100px]" :title="step.location">{{ step.location }}</span>
      <!-- Optional label -->
      <span v-if="getProcessStep(step.stepId)?.optional" class="text-[9px] text-(--ui-text-muted) italic">Optional</span>
      <div class="mt-1 flex items-center gap-1 text-[10px]">
        <span class="font-bold text-(--ui-text-highlighted)">{{ step.partCount }}</span>
        <span class="text-(--ui-text-muted)">at ·</span>
        <span class="text-green-600 dark:text-green-400">{{ step.completedCount }} done</span>
      </div>
      <BottleneckBadge v-if="step.isBottleneck" :is-bottleneck="true" class="mt-1" />
      <!-- Step assignment dropdown -->
      <div v-if="users.length" class="mt-1.5" @click.stop>
        <StepAssignmentDropdown
          :step-id="step.stepId"
          :current-assignee="getProcessStep(step.stepId)?.assignedTo"
          :users="users"
          @assigned="(stepId: string, userId: string | null) => emit('assigned', stepId, userId)"
        />
      </div>
      </div>
    </template>

    <!-- Arrow before Done -->
    <div v-if="distribution.length" class="flex items-center justify-center shrink-0">
      <UIcon name="i-lucide-chevron-right" class="size-4 text-(--ui-text-muted) hidden md:block" />
      <UIcon name="i-lucide-chevron-down" class="size-4 text-(--ui-text-muted) md:hidden" />
    </div>

    <!-- Completed column — mobile -->
    <div class="md:hidden flex items-center justify-between rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 px-3 py-2">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-check-circle" class="size-4 text-green-600 dark:text-green-400" />
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Done</span>
      </div>
      <span class="text-sm font-bold text-green-600 dark:text-green-400">{{ completedCount }} completed</span>
    </div>

    <!-- Completed column — desktop -->
    <div class="hidden md:flex flex-col items-center justify-center md:min-w-[110px] md:max-w-[150px] md:flex-1 px-1.5 py-1 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-center">
      <span class="text-[10px] text-(--ui-text-muted) mb-0.5">Done</span>
      <UIcon name="i-lucide-check-circle" class="size-4 text-green-600 dark:text-green-400" />
      <div class="mt-1">
        <span class="text-sm font-bold text-green-600 dark:text-green-400">
          {{ completedCount }}
        </span>
      </div>
      <span class="text-[10px] text-(--ui-text-muted)">completed</span>
    </div>
  </div>
</template>
