<script setup lang="ts">
import type { PartStepStatusView } from '~/server/types/computed'

const props = defineProps<{
  partId: string
  steps: PartStepStatusView[]
}>()

const { completeDeferredStep, waiveStep, loading } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const waiveReason = ref('')
const waiveStepId = ref<string | null>(null)
const actionError = ref<string | null>(null)

const deferredSteps = computed(() => props.steps.filter((s) => s.status === 'deferred'))

async function handleComplete(stepId: string) {
  actionError.value = null
  if (!operatorId.value) {
    actionError.value = 'No operator selected'
    return
  }
  try {
    await completeDeferredStep(props.partId, stepId, { userId: operatorId.value })
  } catch (e: any) {
    actionError.value = e?.data?.message ?? e?.message ?? 'Failed to complete step'
  }
}

function startWaive(stepId: string) {
  waiveStepId.value = stepId
  waiveReason.value = ''
}

function cancelWaive() {
  waiveStepId.value = null
  waiveReason.value = ''
}

async function confirmWaive() {
  actionError.value = null
  if (!waiveStepId.value) return
  if (!waiveReason.value.trim()) {
    actionError.value = 'Waive reason is required'
    return
  }
  if (!operatorId.value) {
    actionError.value = 'No operator selected'
    return
  }
  try {
    await waiveStep(props.partId, waiveStepId.value, {
      reason: waiveReason.value.trim(),
      approverId: operatorId.value,
    })
    cancelWaive()
  } catch (e: any) {
    actionError.value = e?.data?.message ?? e?.message ?? 'Failed to waive step'
  }
}
</script>

<template>
  <div v-if="deferredSteps.length" class="space-y-2">
    <h4 class="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
      <UIcon name="i-lucide-clock" class="size-4" />
      Deferred Steps ({{ deferredSteps.length }})
    </h4>

    <div
      class="border border-amber-200 dark:border-amber-800 rounded-md divide-y divide-amber-200 dark:divide-amber-800"
    >
      <div
        v-for="step in deferredSteps"
        :key="step.stepId"
        class="px-3 py-2 flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-medium text-(--ui-text-highlighted) truncate">{{
            step.stepName
          }}</span>
          <UBadge color="warning" variant="subtle" size="xs">Deferred</UBadge>
        </div>

        <div v-if="waiveStepId === step.stepId" class="flex items-center gap-2">
          <UInput v-model="waiveReason" placeholder="Waive reason..." size="xs" class="w-40" />
          <UButton size="xs" label="Confirm" :loading="loading" @click="confirmWaive" />
          <UButton size="xs" variant="ghost" label="Cancel" @click="cancelWaive" />
        </div>
        <div v-else class="flex items-center gap-1 shrink-0">
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            label="Complete"
            :loading="loading"
            @click="handleComplete(step.stepId)"
          />
          <UButton
            size="xs"
            color="warning"
            variant="soft"
            label="Waive"
            @click="startWaive(step.stepId)"
          />
        </div>
      </div>
    </div>

    <p v-if="actionError" class="text-xs text-(--ui-error)">
      {{ actionError }}
    </p>
  </div>
</template>
