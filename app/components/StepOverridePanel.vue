<script setup lang="ts">
import type { ProcessStep, PartStepOverride } from '~/types/domain'

const props = defineProps<{
  partIds: string[]
  steps: ProcessStep[]
  overrides: PartStepOverride[]
}>()

const emit = defineEmits<{
  updated: []
}>()

const { createStepOverride, reverseStepOverride, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const selectedParts = ref<string[]>([])
const selectedStepId = ref<string | SelectNone>(SELECT_NONE)
const reason = ref('')
const validationError = ref<string | null>(null)

const stepOptions = computed(() => [
  { label: 'Select step...', value: SELECT_NONE, disabled: true },
  ...props.steps.map(s => ({
    label: `${s.order + 1}. ${s.name}`,
    value: s.id,
  })),
])

const activeOverrides = computed(() =>
  props.overrides.filter(o => o.active),
)

function togglePart(id: string) {
  const idx = selectedParts.value.indexOf(id)
  if (idx >= 0) {
    selectedParts.value.splice(idx, 1)
  } else {
    selectedParts.value.push(id)
  }
}

async function handleCreate() {
  validationError.value = null
  if (!selectedParts.value.length) {
    validationError.value = 'Select at least one part'
    return
  }
  if (!selectedStepId.value || selectedStepId.value === SELECT_NONE) {
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
    await createStepOverride(selectedParts.value[0]!, {
      partIds: selectedParts.value,
      stepId: selectedStepId.value,
      reason: reason.value.trim(),
      userId: operatorId.value,
    })
    selectedParts.value = []
    selectedStepId.value = SELECT_NONE
    reason.value = ''
    emit('updated')
  } catch {
    // error set by composable
  }
}

async function handleReverse(override: PartStepOverride) {
  try {
    await reverseStepOverride(override.partId, override.stepId)
    emit('updated')
  } catch {
    // error set by composable
  }
}
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">
      Step Overrides
    </h4>

    <!-- Active overrides -->
    <div
      v-if="activeOverrides.length"
      class="space-y-1"
    >
      <p class="text-xs font-medium text-(--ui-text-muted)">
        Active Overrides
      </p>
      <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="ov in activeOverrides"
          :key="ov.id"
          class="px-3 py-2 flex items-center justify-between text-sm"
        >
          <div class="min-w-0">
            <span class="font-mono text-xs">{{ ov.partId }}</span>
            <span class="text-(--ui-text-muted) mx-1">→</span>
            <span class="text-(--ui-text-highlighted)">
              {{ steps.find(s => s.id === ov.stepId)?.name ?? ov.stepId }}
            </span>
            <span
              v-if="ov.reason"
              class="text-xs text-(--ui-text-muted) ml-1"
            >({{ ov.reason }})</span>
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
      <p class="text-xs font-medium text-(--ui-text-highlighted)">
        Create Override
      </p>

      <div>
        <label class="text-xs text-(--ui-text-muted) block mb-1">Parts</label>
        <div class="max-h-32 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
          <label
            v-for="sid in partIds"
            :key="sid"
            class="flex items-center gap-2 px-2 py-1.5 hover:bg-(--ui-bg-elevated)/30 cursor-pointer text-xs"
          >
            <input
              type="checkbox"
              :checked="selectedParts.includes(sid)"
              class="rounded"
              @change="togglePart(sid)"
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
        <UInput
          v-model="reason"
          placeholder="Why override this step?"
          class="w-full"
          size="sm"
        />
      </div>

      <p
        v-if="validationError"
        class="text-xs text-(--ui-error)"
      >
        {{ validationError }}
      </p>
      <p
        v-if="error"
        class="text-xs text-(--ui-error)"
      >
        {{ error }}
      </p>

      <UButton
        size="sm"
        label="Create Override"
        :loading="loading"
        @click="handleCreate"
      />
    </div>
  </div>
</template>
