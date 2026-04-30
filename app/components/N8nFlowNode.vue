<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

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
const NODE_ICONS: Record<string, string> = {
  'shop-planr-trigger': 'i-lucide-webhook',
  'n8n-nodes-base.set': 'i-lucide-pencil',
  'n8n-nodes-base.code': 'i-lucide-code',
  'n8n-nodes-base.if': 'i-lucide-git-branch',
  'n8n-nodes-base.filter': 'i-lucide-filter',
  'n8n-nodes-base.httpRequest': 'i-lucide-globe',
  'n8n-nodes-base.slack': 'i-lucide-message-square',
  'n8n-nodes-base.jira': 'i-lucide-ticket',
  'n8n-nodes-base.gmail': 'i-lucide-mail',
  'n8n-nodes-base.discord': 'i-lucide-hash',
  'n8n-nodes-base.microsoftTeams': 'i-lucide-users',
}

const icon = computed(() => NODE_ICONS[props.data.nodeType] ?? 'i-lucide-box')

// ---- Color categorization ----
type NodeCategory = 'trigger' | 'transform' | 'destination' | 'control'

const category = computed<NodeCategory>(() => {
  const t = props.data.nodeType
  if (props.data.isTrigger || t === 'shop-planr-trigger') return 'trigger'
  if (t.includes('if') || t.includes('filter')) return 'control'
  if (['httpRequest', 'slack', 'jira', 'gmail', 'discord', 'microsoftTeams'].some(x => t.includes(x))) return 'destination'
  return 'transform'
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

// ---- Handle: trigger has no input; IF has two outputs (true/false) ----
const hasInput = computed(() => !props.data.isTrigger)
const isIf = computed(() => props.data.nodeType === 'n8n-nodes-base.if')
</script>

<template>
  <div
    class="min-w-[160px] max-w-[200px] relative"
    :class="colorClasses"
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
      :class="category === 'trigger' ? '!border-violet-500' : category === 'transform' ? '!border-emerald-500' : category === 'control' ? '!border-amber-500' : '!border-blue-500'"
    />

    <!-- Output handle(s) -->
    <!-- IF node: two outputs (true/false) -->
    <template v-if="isIf">
      <Handle
        id="true"
        type="source"
        :position="Position.Right"
        :style="{ top: '35%' }"
        class="!w-3 !h-3 !bg-green-500 !border-2 !border-(--ui-bg)"
      />
      <Handle
        id="false"
        type="source"
        :position="Position.Right"
        :style="{ top: '70%' }"
        class="!w-3 !h-3 !bg-red-500 !border-2 !border-(--ui-bg)"
      />
      <div
        class="absolute right-[-36px] text-[9px] font-bold text-green-600 dark:text-green-400 pointer-events-none"
        :style="{ top: 'calc(35% - 6px)' }"
      >
        TRUE
      </div>
      <div
        class="absolute right-[-36px] text-[9px] font-bold text-red-600 dark:text-red-400 pointer-events-none"
        :style="{ top: 'calc(70% - 6px)' }"
      >
        FALSE
      </div>
    </template>
    <!-- All other nodes: single output -->
    <Handle
      v-else
      type="source"
      :position="Position.Right"
      class="!w-3 !h-3 !bg-(--ui-bg) !border-2"
      :class="category === 'trigger' ? '!border-violet-500' : category === 'transform' ? '!border-emerald-500' : category === 'control' ? '!border-amber-500' : '!border-blue-500'"
    />
  </div>
</template>
