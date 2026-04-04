<script setup lang="ts">
import type { ProcessStep } from '~/types/domain'

const props = defineProps<{
  partId: string
  currentStepId: string | null
  steps: ProcessStep[]
}>()

const emit = defineEmits<{
  advanced: []
}>()

const { advanceToStep, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

// Find the current step to determine its order
const currentStep = computed(() =>
  props.steps.find(s => s.id === props.currentStepId) ?? null,
)

const futureSteps = computed(() =>
  props.steps
    .filter(s => currentStep.value !== null && s.order > currentStep.value.order)
    .map(s => ({
      label: `${s.order + 1}. ${s.name}${s.location ? ` (${s.location})` : ''}`,
      value: s.id,
      step: s,
    })),
)

const selectedStepId = ref(futureSteps.value[0]?.value ?? '')

const bypassedSteps = computed(() => {
  if (!selectedStepId.value || !currentStep.value) return []
  const targetStep = props.steps.find(s => s.id === selectedStepId.value)
  if (!targetStep) return []
  // Steps between current and target (exclusive of both)
  if (targetStep.order <= currentStep.value.order + 1) return []
  return props.steps
    .filter(s => s.order > currentStep.value!.order && s.order < targetStep.order)
    .map(s => ({
      stepId: s.id,
      stepName: s.name,
      classification: s.optional ? 'skipped' as const : 'deferred' as const,
      optional: s.optional,
    }))
})

const validationError = ref<string | null>(null)

async function handleAdvance() {
  validationError.value = null
  if (!operatorId.value) {
    validationError.value = 'No operator selected'
    return
  }
  if (!selectedStepId.value) {
    validationError.value = 'No target step selected'
    return
  }

  try {
    await advanceToStep(props.partId, {
      targetStepId: selectedStepId.value,
      userId: operatorId.value,
    })
    emit('advanced')
  } catch {
    // error is set by composable
  }
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Advance to Step</label>
      <USelect
        v-model="selectedStepId"
        :items="futureSteps"
        value-key="value"
        label-key="label"
        class="w-full"
      />
    </div>

    <!-- Bypass preview -->
    <div
      v-if="bypassedSteps.length"
      class="text-xs space-y-1"
    >
      <p class="font-medium text-amber-600 dark:text-amber-400">
        {{ bypassedSteps.length }} step{{ bypassedSteps.length !== 1 ? 's' : '' }} will be bypassed:
      </p>
      <div class="border border-amber-200 dark:border-amber-800 rounded-md divide-y divide-amber-200 dark:divide-amber-800">
        <div
          v-for="bp in bypassedSteps"
          :key="bp.stepId"
          class="px-2 py-1.5 flex items-center justify-between"
        >
          <span class="text-(--ui-text-highlighted)">{{ bp.stepName }}</span>
          <UBadge
            :color="bp.classification === 'skipped' ? 'neutral' : 'warning'"
            variant="subtle"
            size="xs"
          >
            {{ bp.classification === 'skipped' ? 'Skip' : 'Defer' }}
          </UBadge>
        </div>
      </div>
      <p
        v-if="bypassedSteps.some(b => b.classification === 'deferred')"
        class="text-amber-600 dark:text-amber-400"
      >
        ⚠ Required steps will be deferred and must be completed before final sign-off.
      </p>
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
      color="primary"
      label="Advance"
      icon="i-lucide-arrow-right"
      size="sm"
      :loading="loading"
      @click="handleAdvance"
    />
  </div>
</template>
