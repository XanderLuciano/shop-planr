<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { getOutputsForNode, getNodeDefinition } from '~/utils/n8nNodeDefinitions'

interface NodeData {
  label: string
  nodeType: string
  parameters: Record<string, unknown>
  typeVersion: number
  isTrigger?: boolean
  /** Whether the editor currently considers this node selected */
  isSelected?: boolean
  /** Whether the node has a validation warning (e.g. disconnected, missing required field) */
  warning?: string
}

const props = defineProps<{
  id: string
  data: NodeData
}>()

// ---- Icon lookup ----
const icon = computed(() => {
  if (props.data.isTrigger) return 'i-lucide-webhook'
  const def = getNodeDefinition(props.data.nodeType)
  return def?.icon ?? 'i-lucide-box'
})

// ---- Color categorization ----
type NodeCategory = 'trigger' | 'transform' | 'destination' | 'control'

const category = computed<NodeCategory>(() => {
  if (props.data.isTrigger) return 'trigger'
  const def = getNodeDefinition(props.data.nodeType)
  return def?.category ?? 'transform'
})

const colorClasses = computed(() => {
  const base = 'rounded-lg border-2 shadow-sm transition-all'
  const selected = props.data.isSelected ? 'ring-2 ring-offset-2 ring-offset-[var(--ui-bg-elevated)]' : ''
  switch (category.value) {
    case 'trigger':
      return `${base} ${selected} bg-violet-500/15 border-violet-500/50 ring-violet-500`
    case 'transform':
      return `${base} ${selected} bg-emerald-500/10 border-emerald-500/40 ring-emerald-500`
    case 'control':
      return `${base} ${selected} bg-amber-500/10 border-amber-500/40 ring-amber-500`
    case 'destination':
      return `${base} ${selected} bg-blue-500/10 border-blue-500/40 ring-blue-500`
  }
  return base
})

const categoryLabel = computed(() => {
  switch (category.value) {
    case 'trigger': return 'TRIGGER'
    case 'transform': return 'TRANSFORM'
    case 'control': return 'CONTROL'
    case 'destination': return 'DESTINATION'
  }
  return ''
})

const iconColor = computed(() => {
  switch (category.value) {
    case 'trigger': return 'text-violet-600 dark:text-violet-400'
    case 'transform': return 'text-emerald-600 dark:text-emerald-400'
    case 'control': return 'text-amber-600 dark:text-amber-400'
    case 'destination': return 'text-blue-600 dark:text-blue-400'
  }
  return ''
})

const typeLabel = computed(() =>
  props.data.nodeType.replace('n8n-nodes-base.', '').replace('shop-planr-trigger', 'webhook'),
)

// ---- Handles ----
const hasInput = computed(() => !props.data.isTrigger)

/**
 * Outputs for this node. A node with a single default output has just one
 * handle; IF has two; Switch can have up to 5 (4 routes + default).
 */
const outputs = computed(() => {
  if (props.data.isTrigger) return [{ id: 'main', label: '', color: undefined as string | undefined }]
  const defs = getOutputsForNode(props.data.nodeType) ?? []
  return defs.map(o => ({ id: o.id, label: o.label, color: o.color }))
})

/** Compute the `top` offset for a given output handle index. */
function topForIndex(index: number, total: number): string {
  if (total === 1) return '50%'
  // Spread handles evenly between ~25% and ~85% of the node body
  const start = 25
  const end = 85
  const step = (end - start) / Math.max(total - 1, 1)
  return `${start + step * index}%`
}

function handleColorClass(color?: string): string {
  switch (color) {
    case 'green': return '!bg-green-500'
    case 'red': return '!bg-red-500'
    case 'amber': return '!bg-amber-500'
    case 'gray': return '!bg-gray-400'
    default:
      // Match category color
      switch (category.value) {
        case 'trigger': return '!bg-violet-500'
        case 'transform': return '!bg-emerald-500'
        case 'control': return '!bg-amber-500'
        case 'destination': return '!bg-blue-500'
      }
      return '!bg-violet-500'
  }
}

function labelColorClass(color?: string): string {
  switch (color) {
    case 'green': return 'text-green-600 dark:text-green-400'
    case 'red': return 'text-red-600 dark:text-red-400'
    case 'amber': return 'text-amber-600 dark:text-amber-400'
    case 'gray': return 'text-gray-500 dark:text-gray-400'
    default: return 'text-(--ui-text-muted)'
  }
}

// Input handle border color matches category
const inputBorderClass = computed(() => {
  switch (category.value) {
    case 'trigger': return '!border-violet-500'
    case 'transform': return '!border-emerald-500'
    case 'control': return '!border-amber-500'
    case 'destination': return '!border-blue-500'
  }
  return '!border-violet-500'
})

/** Minimum height per node based on number of output handles. */
const minHeight = computed(() => {
  const n = outputs.value.length
  if (n <= 1) return undefined
  return `${Math.max(n * 26 + 40, 64)}px`
})
</script>

<template>
  <div
    class="min-w-[170px] max-w-[210px] relative"
    :class="colorClasses"
    :style="minHeight ? { minHeight } : undefined"
  >
    <!-- Category ribbon -->
    <div
      class="text-[9px] font-bold tracking-widest px-2.5 pt-1.5 opacity-70"
      :class="iconColor"
    >
      {{ categoryLabel }}
    </div>

    <!-- Body -->
    <div class="px-2.5 py-1.5 pb-2">
      <div class="flex items-center gap-2">
        <UIcon
          :name="icon"
          class="size-4 shrink-0"
          :class="iconColor"
        />
        <span class="text-sm font-medium text-(--ui-text-highlighted) truncate">
          {{ data.label }}
        </span>
      </div>
      <p class="text-[10px] text-(--ui-text-muted) mt-0.5 truncate">
        {{ typeLabel }}
      </p>
      <div
        v-if="data.warning"
        class="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400"
      >
        <UIcon
          name="i-lucide-triangle-alert"
          class="size-3"
        />
        <span class="truncate">{{ data.warning }}</span>
      </div>
    </div>

    <!-- Input handle (except trigger) -->
    <Handle
      v-if="hasInput"
      type="target"
      :position="Position.Left"
      class="!w-3 !h-3 !bg-(--ui-bg) !border-2"
      :class="inputBorderClass"
    />

    <!-- Output handles — one per declared output -->
    <template
      v-for="(o, idx) in outputs"
      :key="o.id"
    >
      <Handle
        :id="o.id"
        type="source"
        :position="Position.Right"
        :style="{ top: topForIndex(idx, outputs.length) }"
        class="!w-3 !h-3 !border-2 !border-(--ui-bg)"
        :class="handleColorClass(o.color)"
      />
      <div
        v-if="o.label"
        class="absolute right-[-44px] text-[9px] font-bold pointer-events-none whitespace-nowrap"
        :class="labelColorClass(o.color)"
        :style="{ top: `calc(${topForIndex(idx, outputs.length)} - 6px)` }"
      >
        {{ o.label }}
      </div>
    </template>
  </div>
</template>
