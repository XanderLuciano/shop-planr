<script setup lang="ts">
import type { WorkflowVariable, VariableGroup } from '~/utils/n8nVariables'

const props = defineProps<{
  variables: WorkflowVariable[]
  /** Whether the picker button is disabled */
  disabled?: boolean
}>()

const emit = defineEmits<{
  pick: [expression: string]
}>()

const open = ref(false)
const search = ref('')

const GROUP_ORDER: VariableGroup[] = ['envelope', 'payload', 'computed', 'flow']
const GROUP_LABELS: Record<VariableGroup, string> = {
  envelope: 'Envelope (always present)',
  payload: 'Event Payload',
  computed: 'Computed Helpers',
  flow: 'Flow Context',
}

interface Group {
  group: VariableGroup
  label: string
  items: WorkflowVariable[]
}

const grouped = computed<Group[]>(() => {
  const q = search.value.trim().toLowerCase()
  const filtered = q
    ? props.variables.filter(v =>
        v.label.toLowerCase().includes(q)
        || v.description.toLowerCase().includes(q)
        || v.expression.toLowerCase().includes(q))
    : props.variables

  const byGroup = new Map<VariableGroup, WorkflowVariable[]>()
  for (const v of filtered) {
    const arr = byGroup.get(v.group) ?? []
    arr.push(v)
    byGroup.set(v.group, arr)
  }

  return GROUP_ORDER
    .filter(g => byGroup.has(g))
    .map(g => ({ group: g, label: GROUP_LABELS[g], items: byGroup.get(g) ?? [] }))
})

const totalFiltered = computed(() => grouped.value.reduce((sum, g) => sum + g.items.length, 0))

function handlePick(v: WorkflowVariable) {
  emit('pick', v.expression)
  open.value = false
  search.value = ''
}

function formatAvailability(v: WorkflowVariable): string {
  if (v.availableIn.length === 0) return 'Always available'
  return `In ${v.availableIn.length} event${v.availableIn.length !== 1 ? 's' : ''}`
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      icon="i-lucide-braces"
      variant="ghost"
      size="xs"
      :disabled="disabled"
      title="Insert variable from webhook payload"
    />
    <template #content>
      <div class="w-96 max-h-[28rem] flex flex-col">
        <div class="p-2 border-b border-(--ui-border)">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search variables..."
            size="sm"
            autofocus
            class="w-full"
          />
        </div>
        <div class="flex-1 overflow-y-auto p-1">
          <div
            v-if="totalFiltered === 0"
            class="text-center py-4 text-xs text-(--ui-text-muted)"
          >
            No variables match "{{ search }}"
          </div>
          <div
            v-for="group in grouped"
            :key="group.group"
            class="mb-2 last:mb-0"
          >
            <p class="px-2 pt-2 pb-1 text-[10px] font-semibold text-(--ui-text-muted) uppercase tracking-wide">
              {{ group.label }}
            </p>
            <button
              v-for="v in group.items"
              :key="v.expression"
              class="w-full text-left px-2 py-1.5 rounded hover:bg-(--ui-bg-elevated) transition-colors cursor-pointer"
              @click="handlePick(v)"
            >
              <div class="flex items-center justify-between gap-2">
                <code class="text-xs font-mono text-(--ui-text-highlighted) truncate">
                  {{ v.label }}
                </code>
                <span class="text-[10px] text-(--ui-text-dimmed) shrink-0">
                  {{ v.type }}
                </span>
              </div>
              <p
                v-if="v.description"
                class="text-[11px] text-(--ui-text-muted) mt-0.5 line-clamp-2"
              >
                {{ v.description }}
              </p>
              <p class="text-[10px] text-(--ui-text-dimmed) mt-0.5">
                {{ formatAvailability(v) }}
              </p>
            </button>
          </div>
        </div>
        <div class="p-2 border-t border-(--ui-border) text-[10px] text-(--ui-text-muted)">
          Click to insert. Expressions use n8n syntax
          <code class="bg-(--ui-bg-elevated) px-1 rounded">&#123;&#123; ... &#125;&#125;</code>
        </div>
      </div>
    </template>
  </UPopover>
</template>
