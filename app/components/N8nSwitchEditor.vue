<script setup lang="ts">
import type { WorkflowVariable } from '~/utils/n8nVariables'

const props = defineProps<{
  parameters: Record<string, unknown>
  variables: WorkflowVariable[]
}>()

const emit = defineEmits<{
  'update:parameters': [params: Record<string, unknown>]
}>()

interface SwitchRule {
  /** The expression / value to evaluate */
  value: string
  /** The operator applied between value and expected */
  operation: string
  /** The value to compare against */
  expected: string
  /** Which output (0..3) this rule routes to — implicit by array index in n8n */
}

const RULE_OPS = [
  { label: 'equals', value: 'equal' },
  { label: 'does not equal', value: 'notEqual' },
  { label: 'contains', value: 'contains' },
  { label: 'does not contain', value: 'notContains' },
  { label: 'starts with', value: 'startsWith' },
  { label: 'ends with', value: 'endsWith' },
  { label: 'regex', value: 'regex' },
  { label: '>', value: 'greater' },
  { label: '<', value: 'less' },
  { label: 'is empty', value: 'isEmpty' },
  { label: 'is not empty', value: 'isNotEmpty' },
]

function rulesList(): SwitchRule[] {
  const container = props.parameters.rules as { values?: unknown[] } | undefined
  const arr = container?.values ?? []
  return arr.map((item) => {
    const r = item as Record<string, unknown>
    return {
      value: String(r.value ?? r.value1 ?? ''),
      operation: String(r.operation ?? 'equal'),
      expected: String(r.expected ?? r.value2 ?? ''),
    }
  })
}

function setRules(list: SwitchRule[]) {
  const params = structuredClone(props.parameters)
  const shaped = list.map(r => ({
    value: r.value,
    operation: r.operation,
    expected: r.expected,
  }))
  params.rules = { values: shaped }
  emit('update:parameters', params)
}

function addRule() {
  const list = rulesList()
  if (list.length >= 4) return
  setRules([...list, { value: '', operation: 'equal', expected: '' }])
}

function updateRule(idx: number, patch: Partial<SwitchRule>) {
  const list = rulesList()
  const row = list[idx]
  if (!row) return
  list[idx] = { ...row, ...patch }
  setRules(list)
}

function removeRule(idx: number) {
  const list = rulesList()
  list.splice(idx, 1)
  setRules(list)
}

function set(key: string, value: unknown) {
  emit('update:parameters', { ...props.parameters, [key]: value })
}

const fallback = computed(() => String(props.parameters.fallbackOutput ?? 'extra'))
const allMatching = computed(() => {
  const options = props.parameters.options as { allMatchingOutputs?: boolean } | undefined
  return Boolean(options?.allMatchingOutputs)
})

function setAllMatching(value: boolean | 'indeterminate') {
  const params = structuredClone(props.parameters)
  params.options = { ...(params.options as Record<string, unknown> ?? {}), allMatchingOutputs: value === true }
  emit('update:parameters', params)
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <div>
          <label class="text-xs font-medium text-(--ui-text-highlighted) block">
            Routing Rules
          </label>
          <p class="text-[10px] text-(--ui-text-muted) mt-0.5">
            Up to 4 rules. Each matching rule routes to its corresponding output on the canvas.
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          variant="ghost"
          size="xs"
          :disabled="rulesList().length >= 4"
          @click="addRule"
        />
      </div>

      <div
        v-if="rulesList().length === 0"
        class="text-[11px] text-(--ui-text-dimmed) px-1.5 py-2 border border-dashed border-(--ui-border) rounded"
      >
        No rules yet. Click + to add one.
      </div>

      <div
        v-for="(rule, idx) in rulesList()"
        :key="idx"
        class="space-y-1 p-2 mb-1.5 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
      >
        <div class="flex items-center justify-between">
          <UBadge
            variant="subtle"
            color="info"
            size="xs"
          >
            Route {{ idx + 1 }}
          </UBadge>
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="error"
            size="xs"
            @click="removeRule(idx)"
          />
        </div>
        <N8nVariableInput
          :model-value="rule.value"
          :variables="variables"
          placeholder="Value, e.g. {{ $json.body.event }}"
          @update:model-value="(v: string) => updateRule(idx, { value: v })"
        />
        <USelect
          :model-value="rule.operation"
          :items="RULE_OPS"
          size="xs"
          class="w-full"
          @update:model-value="(v: string) => updateRule(idx, { operation: v })"
        />
        <N8nVariableInput
          v-if="!['isEmpty', 'isNotEmpty'].includes(rule.operation)"
          :model-value="rule.expected"
          :variables="variables"
          placeholder="Expected value, e.g. part_scrapped"
          @update:model-value="(v: string) => updateRule(idx, { expected: v })"
        />
      </div>
    </div>

    <USeparator />

    <UFormField label="Fallback Output">
      <USelect
        :model-value="fallback"
        :items="[
          { label: 'Extra &quot;Default&quot; output (unmatched → default branch)', value: 'extra' },
          { label: 'No fallback (unmatched items are discarded)', value: 'none' },
        ]"
        size="sm"
        class="w-full"
        @update:model-value="(v: string) => set('fallbackOutput', v)"
      />
    </UFormField>

    <label class="flex items-start gap-2 text-xs cursor-pointer">
      <UCheckbox
        :model-value="allMatching"
        class="mt-0.5"
        @update:model-value="setAllMatching"
      />
      <span>
        <span class="font-medium text-(--ui-text-highlighted)">Send to all matching outputs</span>
        <span class="block text-[11px] text-(--ui-text-muted)">
          When off, the first matching rule wins. When on, an item can fan out to multiple routes.
        </span>
      </span>
    </label>
  </div>
</template>
