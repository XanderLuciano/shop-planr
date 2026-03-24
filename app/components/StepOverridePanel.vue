<script setup lang="ts">
import type { ProcessStep, SnStepOverride } from '~/server/types/domain'

const props = defineProps<{
  serialIds: string[]
  steps: ProcessStep[]
  overrides: SnStepOverride[]
}>()

const emit = defineEmits<{
  updated: []
}>()

const { createStepOverride, reverseStepOverride, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const selectedSerials = ref<string[]>([])
const selectedStepId = ref('')
const reason = ref('')
const validationError = ref<string | null>(null)

const stepOptions = computed(() =>
  props.steps.map(s => ({
    label: `${s.order + 1}. ${s.name}`,
    value: s.id,
  })),
)

const activeOverrides = computed(() =>
  props.overrides.filter(o => o.active),
)

function toggleSerial(id: string) {
  const idx = selectedSerials.value.indexOf(id)
  if (idx >= 0) {
    selectedSerials.value.splice(idx, 1)
  } else {
    selectedSerials.value.push(id)
  }
}

async function handleCreate() {
  validationError.value = null
  if (!selectedSerials.value.length) {
    validationError.value = 'Select at least one serial number'
    return
  }
  if (!selectedStepId.value) {
    validationError.value = 'Select a step to override'
    return
  }
  if (!reason.value.trim()) {
    validationError.value = 'Reason is required'
    return
  }
  if (!operatorId.value) {
    validationError.value = 'No operator selected'
    return
  }

  try {
    await createStepOverride(selectedSerials.value[0]!, {
      serialIds: selectedSerials.value,
      stepId: selectedStepId.value,
      reason: reason.value.trim(),
      userId: operatorId.value,
    })
    selectedSerials.value = []
    selectedStepId.value = ''
    reason.value = ''
    emit('updated')
  } catch {
    // error set by composable
  }
}

async function handleReverse(override: SnStepOverride) {
  try {
    await reverseStepOverride(override.serialId, override.stepId)
    emit('updated')
  } catch {
    // error set by composable
  }
}
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">Step Overrides</h4>

    <!-- Active overrides -->
    <div v-if="activeOverrides.length" class="space-y-1">
      <p class="text-xs font-medium text-(--ui-text-muted)">Active Overrides</p>
      <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="ov in activeOverrides"
          :key="ov.id"
          class="px-3 py-2 flex items-center justify-between text-sm"
        >
          <div class="min-w-0">
            <span class="font-mono text-xs">{{ ov.serialId }}</span>
            <span class="text-(--ui-text-muted) mx-1">→</span>
            <span class="text-(--ui-text-highlighted)">
              {{ steps.find(s => s.id === ov.stepId)?.name ?? ov.stepId }}
            </span>
            <span v-if="ov.reason" class="text-xs text-(--ui-text-muted) ml-1">({{ ov.reason }})</span>
          </div>
          <UButton
            size="xs"
            color="error"
            variant="soft"
            label="Reverse"
            :loading="loading"
            @click="handleReverse(ov)"
          />
        </div>
      </div>
    </div>

    <!-- Create override form -->
    <div class="space-y-2 border border-(--ui-border) rounded-md p-3">
      <p class="text-xs font-medium text-(--ui-text-highlighted)">Create Override</p>

      <div>
        <label class="text-xs text-(--ui-text-muted) block mb-1">Serial Numbers</label>
        <div class="max-h-32 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
          <label
            v-for="sid in serialIds"
            :key="sid"
            class="flex items-center gap-2 px-2 py-1.5 hover:bg-(--ui-bg-elevated)/30 cursor-pointer text-xs"
          >
            <input
              type="checkbox"
              :checked="selectedSerials.includes(sid)"
              class="rounded"
              @change="toggleSerial(sid)"
            >
            <span class="font-mono">{{ sid }}</span>
          </label>
        </div>
      </div>

      <div>
        <label class="text-xs text-(--ui-text-muted) block mb-1">Step</label>
        <USelect
          v-model="selectedStepId"
          :items="stepOptions"
          value-key="value"
          label-key="label"
          placeholder="Select step..."
          class="w-full"
        />
      </div>

      <div>
        <label class="text-xs text-(--ui-text-muted) block mb-1">Reason</label>
        <UInput v-model="reason" placeholder="Why override this step?" class="w-full" size="sm" />
      </div>

      <p v-if="validationError" class="text-xs text-(--ui-error)">{{ validationError }}</p>
      <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>

      <UButton
        size="sm"
        label="Create Override"
        :loading="loading"
        @click="handleCreate"
      />
    </div>
  </div>
</template>
