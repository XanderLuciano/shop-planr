<script setup lang="ts">
import type { Job, Tag } from '~/types/domain'
import type { JobProgress } from '~/types/computed'

withDefaults(defineProps<{
  job: Job & { tags?: Tag[] }
  progress: JobProgress | null
  editing?: boolean
  index?: number
}>(), {
  editing: false,
  index: 0,
})

defineEmits<{
  click: []
  dragstart: [event: DragEvent]
  dragover: [event: DragEvent]
  drop: [event: DragEvent]
  dragend: []
  dragleave: []
  touchstart: [event: TouchEvent]
  touchmove: [event: TouchEvent]
  touchend: [event: TouchEvent]
}>()
</script>

<template>
  <div
    class="p-3 rounded-lg border border-(--ui-border) space-y-2"
    :class="{
      'hover:bg-(--ui-bg-elevated)/50 cursor-pointer': !editing,
      'cursor-grab active:cursor-grabbing': editing,
    }"
    :draggable="editing"
    :role="editing ? undefined : 'button'"
    :tabindex="editing ? undefined : 0"
    @click="!editing && $emit('click')"
    @keydown.enter.prevent="!editing && $emit('click')"
    @keydown.space.prevent="!editing && $emit('click')"
    @dragstart="editing && $emit('dragstart', $event)"
    @dragover="editing && $emit('dragover', $event)"
    @drop="editing && $emit('drop', $event)"
    @dragend="editing && $emit('dragend')"
    @dragleave="editing && $emit('dragleave')"
    @touchstart.passive="editing && $emit('touchstart', $event)"
    @touchmove="editing && $emit('touchmove', $event)"
    @touchend="editing && $emit('touchend', $event)"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          v-if="editing"
          name="i-lucide-grip-vertical"
          class="size-4 text-(--ui-text-muted) shrink-0"
        />
        <span
          v-if="editing"
          class="text-xs font-mono text-(--ui-text-muted) shrink-0"
        >{{ index + 1 }}.</span>
        <span class="font-medium text-sm">{{ job.name }}</span>
      </div>
      <span
        v-if="job.jiraPriority && !editing"
        class="text-xs text-(--ui-text-muted)"
      >{{ job.jiraPriority }}</span>
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
    <div v-if="job.tags?.length" class="flex flex-wrap gap-1">
      <JobTagPill v-for="tag in job.tags" :key="tag.id" :tag="tag" />
    </div>
  </div>
</template>
