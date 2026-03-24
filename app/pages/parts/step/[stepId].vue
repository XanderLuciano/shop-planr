<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const stepId = route.params.stepId as string

const {
  job,
  notes,
  loading,
  error,
  notFound,
  fetchStep,
} = useStepView(stepId)

const {
  operatorId,
  operatorName,
  activeUsers,
  loading: identityLoading,
  selectOperator,
  clearOperator,
  init: initIdentity,
} = useOperatorIdentity()

const { advanceBatch } = useWorkQueue()

const advanceLoading = ref(false)
const toast = useToast()

// Track whether all parts were advanced (empty state)
const allAdvanced = ref(false)

// Operator dropdown items
const operatorMenuItems = computed<DropdownMenuItem[][]>(() => {
  if (!activeUsers.value.length) {
    return [[{ label: 'No operators available', disabled: true }]]
  }
  return [
    activeUsers.value.map((user: { id: string, name: string }) => ({
      label: user.name,
      icon: user.id === operatorId.value ? 'i-lucide-check' : 'i-lucide-user',
      onSelect() {
        selectOperator(user.id)
      },
    })),
  ]
})

async function handleAdvance(payload: { serialIds: string[], note?: string }) {
  if (!job.value || !operatorId.value) return

  advanceLoading.value = true
  try {
    const result = await advanceBatch({
      serialIds: payload.serialIds,
      userId: operatorId.value,
      jobId: job.value.jobId,
      pathId: job.value.pathId,
      stepId: job.value.stepId,
      note: payload.note,
    })

    const dest = result.nextStepName ?? 'Completed'
    toast.add({
      title: 'Parts advanced',
      description: `${result.advanced} part${result.advanced !== 1 ? 's' : ''} moved to ${dest}`,
      color: 'success',
    })

    // Refresh step data
    await fetchStep()

    // If no parts remain after refresh, show empty state
    if (!job.value || job.value.partCount === 0) {
      allAdvanced.value = true
    }
  } catch (e: any) {
    toast.add({
      title: 'Advancement failed',
      description: e?.message ?? 'An error occurred',
      color: 'error',
    })
  } finally {
    advanceLoading.value = false
  }
}

async function handleCreated(count: number) {
  toast.add({
    title: 'Serials created',
    description: `${count} serial number${count !== 1 ? 's' : ''} created`,
    color: 'success',
  })
  // Refresh step data to pick up newly created serials
  await fetchStep()
}

function handleCancel() {
  navigateTo('/parts')
}

onMounted(async () => {
  await initIdentity()
  await fetchStep()
})
</script>

<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <!-- Back link -->
    <NuxtLink
      to="/parts"
      class="inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      Back to Parts
    </NuxtLink>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-12 justify-center"
    >
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading step data...
    </div>

    <!-- 404 state -->
    <div
      v-else-if="notFound"
      class="text-center py-12"
    >
      <UIcon name="i-lucide-alert-triangle" class="size-8 mx-auto mb-2 text-(--ui-warning)" />
      <p class="text-sm text-(--ui-text-highlighted) font-medium mb-1">Step not found</p>
      <p class="text-xs text-(--ui-text-muted) mb-4">
        This step doesn't exist or has no active parts.
      </p>
      <UButton
        to="/parts"
        size="sm"
        variant="soft"
        label="Back to Parts"
        icon="i-lucide-arrow-left"
      />
    </div>

    <!-- Error state (non-404) -->
    <div
      v-else-if="error && !notFound"
      class="flex items-center gap-2 text-xs text-(--ui-error)"
    >
      <span>{{ error }}</span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        label="Retry"
        @click="fetchStep"
      />
    </div>

    <!-- All parts advanced empty state -->
    <div
      v-else-if="allAdvanced || (job && job.partCount === 0)"
      class="text-center py-12"
    >
      <UIcon name="i-lucide-check-circle" class="size-8 mx-auto mb-2 text-(--ui-success)" />
      <p class="text-sm text-(--ui-text-highlighted) font-medium mb-1">All parts advanced</p>
      <p class="text-xs text-(--ui-text-muted) mb-4">
        No parts remain at this step.
      </p>
      <UButton
        to="/parts"
        size="sm"
        variant="soft"
        label="Back to Parts"
        icon="i-lucide-arrow-left"
      />
    </div>

    <!-- Step content -->
    <template v-else-if="job">
      <!-- Step header -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold text-(--ui-text-highlighted)">{{ job.stepName }}</h1>
            <p class="text-sm text-(--ui-text-muted)">
              {{ job.jobName }} · {{ job.pathName }}
              <span v-if="job.stepLocation"> · 📍 {{ job.stepLocation }}</span>
            </p>
          </div>

          <!-- Operator selector -->
          <div class="flex items-center gap-2">
            <UDropdownMenu
              :items="operatorMenuItems"
              size="sm"
              :content="{ align: 'end' }"
            >
              <UButton
                size="sm"
                :variant="operatorId ? 'ghost' : 'soft'"
                :color="operatorId ? 'neutral' : 'warning'"
                :icon="operatorId ? 'i-lucide-user' : 'i-lucide-hard-hat'"
                :label="operatorName ?? 'Select Operator'"
                trailing-icon="i-lucide-chevron-down"
                :loading="identityLoading"
              />
            </UDropdownMenu>
            <UButton
              v-if="operatorId"
              size="xs"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Clear operator"
              @click="clearOperator"
            />
          </div>
        </div>
      </div>

      <!-- No operator warning -->
      <div
        v-if="!operatorId"
        class="text-sm text-(--ui-text-muted) py-8 text-center"
      >
        <UIcon name="i-lucide-hard-hat" class="size-8 mb-2 opacity-50" />
        <p>Select an operator to advance parts or create serials.</p>
      </div>

      <!-- First step: serial creation panel -->
      <SerialCreationPanel
        v-else-if="job.stepOrder === 0"
        :job="job"
        :loading="advanceLoading"
        @advance="handleAdvance"
        @cancel="handleCancel"
        @created="handleCreated"
      />

      <!-- Other steps: advancement panel -->
      <ProcessAdvancementPanel
        v-else
        :job="job"
        :loading="advanceLoading"
        :notes="notes"
        @advance="handleAdvance"
        @cancel="handleCancel"
      />
    </template>
  </div>
</template>
