<script setup lang="ts">
import type { ScrapReason } from '~/types/domain'

const props = defineProps<{
  partId: string
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'scrapped': []
}>()

const { scrapPart, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const scrapReasons: { label: string, value: ScrapReason | SelectNone, disabled?: boolean }[] = [
  { label: 'Select a reason...', value: SELECT_NONE, disabled: true },
  { label: 'Out of tolerance', value: 'out_of_tolerance' },
  { label: 'Process defect', value: 'process_defect' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Operator error', value: 'operator_error' },
  { label: 'Other', value: 'other' },
]

const selectedReason = ref<ScrapReason | SelectNone>(SELECT_NONE)
const explanation = ref('')
const validationError = ref<string | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

function resetForm() {
  selectedReason.value = SELECT_NONE
  explanation.value = ''
  validationError.value = null
}

function isValidReason(val: string): val is ScrapReason {
  return val !== SELECT_NONE
}

async function handleConfirm() {
  validationError.value = null

  if (!isValidReason(selectedReason.value)) {
    validationError.value = 'Please select a scrap reason'
    return
  }
  if (selectedReason.value === 'other' && !explanation.value.trim()) {
    validationError.value = 'Explanation is required when reason is "Other"'
    return
  }
  if (!operatorId.value) {
    validationError.value = 'No operator selected'
    return
  }

  try {
    await scrapPart(props.partId, {
      reason: selectedReason.value,
      explanation: selectedReason.value === 'other' ? explanation.value.trim() : undefined,
      userId: operatorId.value,
    })
    resetForm()
    isOpen.value = false
    emit('scrapped')
  } catch {
    // error is set by composable
  }
}

function handleCancel() {
  resetForm()
  isOpen.value = false
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
          Scrap Part
        </h3>
        <p class="text-sm text-(--ui-text-muted)">
          This will permanently remove <span class="font-mono font-medium">{{ partId }}</span> from active production.
        </p>

        <div>
          <label class="text-sm font-medium text-(--ui-text-highlighted) block mb-1">Scrap Reason</label>
          <USelect
            v-model="selectedReason"
            :items="scrapReasons"
            value-key="value"
            label-key="label"
            placeholder="Select a reason..."
            class="w-full"
          />
        </div>

        <div v-if="selectedReason === 'other'">
          <label class="text-sm font-medium text-(--ui-text-highlighted) block mb-1">Explanation</label>
          <UTextarea
            v-model="explanation"
            placeholder="Describe why this part is being scrapped..."
            :rows="3"
          />
        </div>

        <p v-if="validationError" class="text-sm text-(--ui-error)">
          {{ validationError }}
        </p>
        <p v-if="error" class="text-sm text-(--ui-error)">
          {{ error }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" label="Cancel" @click="handleCancel" />
          <UButton
            color="error"
            label="Scrap"
            :loading="loading"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
