<script setup lang="ts">
import type { WorkflowVariable } from '~/utils/n8nVariables'

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

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.variables
  return props.variables.filter(v =>
    v.label.toLowerCase().includes(q)
    || v.description.toLowerCase().includes(q),
  )
})

function handlePick(v: WorkflowVariable) {
  emit('pick', v.expression)
  open.value = false
  search.value = ''
}

function formatAvailability(v: WorkflowVariable): string {
  if (v.availableIn.length === 0) return 'Always available'
  return `${v.availableIn.length} event${v.availableIn.length !== 1 ? 's' : ''}`
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
      <div class="w-80 max-h-96 flex flex-col">
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
            v-if="filtered.length === 0"
            class="text-center py-4 text-xs text-(--ui-text-muted)"
          >
            No variables match "{{ search }}"
          </div>
          <button
            v-for="v in filtered"
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
        <div class="p-2 border-t border-(--ui-border) text-[10px] text-(--ui-text-muted)">
          Click to insert <code>&#123;&#123; $json.body.field &#125;&#125;</code> syntax
        </div>
      </div>
    </template>
  </UPopover>
</template>
