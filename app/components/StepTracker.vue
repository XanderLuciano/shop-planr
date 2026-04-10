<script setup lang="ts">
import type { Path, ShopUser } from '~/types/domain'
import type { StepDistribution } from '~/types/computed'

const props = withDefaults(defineProps<{
  path: Path
  distribution: StepDistribution[]
  completedCount?: number
  users?: ShopUser[]
}>(), {
  completedCount: 0,
  users: () => [],
})

const emit = defineEmits<{
  'step-click': [payload: { stepId: string, stepName: string, stepOrder: number }]
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
  if (shouldHighlightStep(step.partCount, step.isBottleneck)) return 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
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

// Grid layout: compute how many cards fit per row based on container width
const containerRef = ref<HTMLElement | null>(null)
const columnsPerRow = ref(8)
const containerWidth = ref(0)
const CARD_MIN_WIDTH = 120
const ARROW_WIDTH = 20
const GAP = 4 // gap-x-1 = 0.25rem = 4px

function computeColumns() {
  const el = containerRef.value
  if (!el) return
  const width = el.clientWidth
  containerWidth.value = width
  // For N cards: N * CARD_MIN_WIDTH + (N-1) * (ARROW_WIDTH + GAP) + (N-1) * GAP <= width
  // Simplify: each card slot = CARD_MIN_WIDTH, each gap between = ARROW_WIDTH + 2*GAP
  const slotGap = ARROW_WIDTH + 2 * GAP
  const cols = Math.max(2, Math.floor((width + slotGap) / (CARD_MIN_WIDTH + slotGap)))
  columnsPerRow.value = cols
}

// Fixed card width so all cards across all rows are the same size
const cardWidth = computed(() => {
  if (!containerWidth.value || !columnsPerRow.value) return CARD_MIN_WIDTH
  const n = columnsPerRow.value
  // Total arrow+gap space between n cards: (n-1) arrows, each with gap on both sides
  const arrowSpace = (n - 1) * (ARROW_WIDTH + 2 * GAP)
  return Math.floor((containerWidth.value - arrowSpace) / n)
})

// All items: steps + done sentinel
interface RowItem {
  type: 'step' | 'done'
  step?: StepDistribution
  index: number // original index in distribution (for step label "Step N")
}

const allItems = computed<RowItem[]>(() => {
  const items: RowItem[] = props.distribution.map((s, i) => ({ type: 'step', step: s, index: i }))
  items.push({ type: 'done', index: props.distribution.length })
  return items
})

const rows = computed<RowItem[][]>(() => {
  const result: RowItem[][] = []
  const items = allItems.value
  for (let i = 0; i < items.length; i += columnsPerRow.value) {
    result.push(items.slice(i, i + columnsPerRow.value))
  }
  return result
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(computeColumns)
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(computeColumns)
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(() => props.distribution, () => nextTick(computeColumns))
</script>

<template>
  <!-- Mobile layout: vertical stack -->
  <div class="md:hidden flex flex-col gap-y-2 py-1">
    <template
      v-for="(step, i) in distribution"
      :key="step.stepId"
    >
      <div
        v-if="i > 0"
        class="flex items-center justify-center"
      >
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-(--ui-text-muted)"
        />
      </div>
      <div
        class="rounded border px-3 py-2 cursor-pointer transition-colors hover:border-(--ui-primary) hover:bg-(--ui-primary)/5"
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
              <UIcon
                v-if="depIcon(getProcessStep(step.stepId)?.dependencyType)"
                :name="depIcon(getProcessStep(step.stepId)?.dependencyType)!"
                class="size-2.5"
              />
              <span
                v-if="getProcessStep(step.stepId)?.optional"
                class="italic ml-1"
              >Optional</span>
            </span>
            <div class="text-sm font-medium text-(--ui-text-highlighted)">
              {{ step.stepName }}
            </div>
            <div
              v-if="step.location"
              class="text-xs text-(--ui-text-muted)"
            >
              {{ step.location }}
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-xs">
              <span class="font-bold text-(--ui-text-highlighted)">{{ step.partCount }}</span>
              <span class="text-(--ui-text-muted)"> at</span>
            </div>
            <div class="text-xs text-green-600 dark:text-green-400">
              {{ step.completedCount }} done
            </div>
            <BottleneckBadge
              v-if="step.isBottleneck"
              :is-bottleneck="true"
              class="mt-0.5"
            />
          </div>
        </div>
        <div
          v-if="users.length"
          class="mt-1.5 text-xs text-(--ui-text-muted)"
        >
          👤 {{ getProcessStep(step.stepId)?.assignedTo ? users.find(u => u.id === getProcessStep(step.stepId)?.assignedTo)?.displayName ?? 'Assigned' : 'Unassigned' }}
        </div>
      </div>
    </template>
    <!-- Mobile Done -->
    <div
      v-if="distribution.length"
      class="flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-(--ui-text-muted)"
      />
    </div>
    <div class="flex items-center justify-between rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 px-3 py-2">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-check-circle"
          class="size-4 text-green-600 dark:text-green-400"
        />
        <span class="text-sm font-medium text-(--ui-text-highlighted)">Done</span>
      </div>
      <span class="text-sm font-bold text-green-600 dark:text-green-400">{{ completedCount }} completed</span>
    </div>
  </div>

  <!-- Desktop layout: grid rows -->
  <div
    ref="containerRef"
    class="hidden md:flex flex-col gap-y-3 py-1"
  >
    <template
      v-for="(row, rowIdx) in rows"
      :key="rowIdx"
    >
      <hr
        v-if="rowIdx > 0"
        class="border-(--ui-border)/50"
      >
      <div
        class="flex items-stretch gap-x-1"
        :class="row.length < columnsPerRow ? 'justify-center' : ''"
      >
        <template
          v-for="(item, colIdx) in row"
          :key="item.type === 'step' ? item.step!.stepId : 'done'"
        >
          <!-- Arrow between cards (not before first in row) -->
          <div
            v-if="colIdx > 0"
            class="flex items-center justify-center shrink-0"
          >
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-(--ui-text-muted)"
            />
          </div>

          <!-- Step card -->
          <div
            v-if="item.type === 'step'"
            class="flex flex-col items-center justify-center shrink-0 px-2 py-2.5 rounded border text-center cursor-pointer transition-colors hover:border-(--ui-primary) hover:bg-(--ui-primary)/5"
            :class="stepBorderClass(item.step!)"
            :style="{ width: `${cardWidth}px` }"
            @click="handleStepClick(item.step!)"
          >
            <span class="text-[10px] text-(--ui-text-muted) mb-0.5 flex items-center gap-0.5">
              Step {{ item.index + 1 }}
              <UIcon
                v-if="depIcon(getProcessStep(item.step!.stepId)?.dependencyType)"
                :name="depIcon(getProcessStep(item.step!.stepId)?.dependencyType)!"
                class="size-2.5"
              />
              <BottleneckBadge
                v-if="item.step!.isBottleneck"
                :is-bottleneck="true"
              />
            </span>
            <span
              class="text-xs font-medium text-(--ui-text-highlighted) text-center break-words"
              :title="item.step!.stepName"
            >{{ item.step!.stepName }}</span>
            <span
              v-if="item.step!.location"
              class="text-[10px] text-(--ui-text-muted) text-center break-words"
              :title="item.step!.location"
            >{{ item.step!.location }}</span>
            <span
              v-if="getProcessStep(item.step!.stepId)?.optional"
              class="text-[9px] text-(--ui-text-muted) italic"
            >Optional</span>
            <div class="mt-1 flex items-center gap-1 text-[10px] flex-wrap justify-center">
              <span class="font-bold text-(--ui-text-highlighted)">{{ item.step!.partCount }}</span>
              <span class="text-(--ui-text-muted)">at ·</span>
              <span class="text-green-600 dark:text-green-400">{{ item.step!.completedCount }} done</span>
            </div>
            <span
              v-if="users.length"
              class="mt-1 text-[10px] text-(--ui-text-muted) text-center break-words"
              :title="getProcessStep(item.step!.stepId)?.assignedTo ? users.find(u => u.id === getProcessStep(item.step!.stepId)?.assignedTo)?.displayName ?? 'Assigned' : 'Unassigned'"
            >
              👤 {{ getProcessStep(item.step!.stepId)?.assignedTo ? users.find(u => u.id === getProcessStep(item.step!.stepId)?.assignedTo)?.displayName ?? 'Assigned' : 'Unassigned' }}
            </span>
          </div>

          <!-- Done card -->
          <div
            v-else
            class="flex flex-col items-center justify-center shrink-0 min-h-[100px] px-2 py-1.5 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-center"
            :style="{ width: `${cardWidth}px` }"
          >
            <span class="text-[10px] text-(--ui-text-muted) mb-0.5">Done</span>
            <UIcon
              name="i-lucide-check-circle"
              class="size-4 text-green-600 dark:text-green-400"
            />
            <div class="mt-1">
              <span class="text-sm font-bold text-green-600 dark:text-green-400">
                {{ completedCount }}
              </span>
            </div>
            <span class="text-[10px] text-(--ui-text-muted)">completed</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
