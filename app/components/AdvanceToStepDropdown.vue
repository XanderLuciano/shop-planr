<script setup lang="ts">
import type { ProcessStep } from '~/types/domain'

const props = defineProps<{
  partId: string
  currentStepIndex: number
  steps: ProcessStep[]
}>()

const emit = defineEmits<{
  advanced: []
}>()

const { advanceToStep, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const selectedIndex = ref(props.currentStepIndex + 1)
const validationError = ref<string | null>(null)

const futureSteps = computed(() =>
  props.steps
    .filter((_s, i) => i > props.currentStepIndex)
    .map((s, _i) => ({
      label: `${s.order + 1}. ${s.name}${s.location ? ` (${s.location})` : ''}`,
      value: s.order,
      step: s,
    })),
)

const bypassedSteps = computed(() => {
  if (selectedIndex.value <= props.currentStepIndex + 1) return []
  return props.steps
    .filter((_s, i) => i > props.currentStepIndex && i < selectedIndex.value)
    .map(s => ({
      stepId: s.id,
      stepName: s.name,
      classification: s.optional ? 'skipped' as const : 'deferred' as const,
      optional: s.optional,
    }))
})

async function handleAdvance() {
  validationError.value = null
  if (!operatorId.value) {
    validationError.value = 'No operator selected'
    return
  }

  try {
    await advanceToStep(props.partId, {
      targetStepIndex: selectedIndex.value,
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
        v-model="selectedIndex"
        :items="futureSteps"
        value-key="value"
        label-key="label"
        class="w-full"
      />
    </div>

    <!-- Bypass preview -->
    <div v-if="bypassedSteps.length" class="text-xs space-y-1">
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
      <p v-if="bypassedSteps.some(b => b.classification === 'deferred')" class="text-amber-600 dark:text-amber-400">
        ⚠ Required steps will be deferred and must be completed before final sign-off.
      </p>
    </div>

    <p v-if="validationError" class="text-xs text-(--ui-error)">{{ validationError }}</p>
    <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>

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
