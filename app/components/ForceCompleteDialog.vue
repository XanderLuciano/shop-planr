<script setup lang="ts">
const props = defineProps<{
  serialId: string
  incompleteSteps: { stepId: string, stepName: string }[]
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'completed': []
}>()

const { forceComplete, loading, error } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const reason = ref('')
const validationError = ref<string | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

function resetForm() {
  reason.value = ''
  validationError.value = null
}

async function handleConfirm() {
  validationError.value = null

  if (!operatorId.value) {
    validationError.value = 'No operator selected'
    return
  }

  try {
    await forceComplete(props.serialId, {
      reason: reason.value.trim() || undefined,
      userId: operatorId.value,
    })
    resetForm()
    isOpen.value = false
    emit('completed')
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
          Force Complete
        </h3>
        <p class="text-sm text-(--ui-text-muted)">
          <span class="font-mono font-medium">{{ serialId }}</span> has
          <span class="font-bold text-amber-600">{{ incompleteSteps.length }}</span>
          required step{{ incompleteSteps.length !== 1 ? 's' : '' }} incomplete — force complete anyway?
        </p>

        <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border) max-h-40 overflow-y-auto">
          <div
            v-for="step in incompleteSteps"
            :key="step.stepId"
            class="px-3 py-2 text-sm flex items-center gap-2"
          >
            <UIcon name="i-lucide-alert-triangle" class="size-4 text-amber-500 shrink-0" />
            <span class="text-(--ui-text-highlighted)">{{ step.stepName }}</span>
          </div>
        </div>

        <div>
          <label class="text-sm font-medium text-(--ui-text-highlighted) block mb-1">Reason (optional)</label>
          <UInput
            v-model="reason"
            placeholder="Why is this being force completed?"
            class="w-full"
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
            color="warning"
            label="Force Complete"
            :loading="loading"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
