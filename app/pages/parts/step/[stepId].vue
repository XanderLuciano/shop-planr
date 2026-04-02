<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const stepId = route.params.stepId as string
const fromQuery = route.query.from as string | undefined
const backNav = computed(() => resolveBackNavigation(fromQuery))

const {
  job,
  notes,
  loading,
  error,
  notFound,
  previousStepWipCount,
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
const skipLoading = ref(false)
const toast = useToast()

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

async function handleAdvance(payload: { partIds: string[], note?: string }) {
  if (!job.value || !operatorId.value) return

  advanceLoading.value = true
  try {
    const result = await advanceBatch({
      partIds: payload.partIds,
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

async function handleSkip(payload: { partIds: string[] }) {
  if (!job.value || !operatorId.value) {
    toast.add({
      title: 'Operator required',
      description: 'Please select an operator before skipping.',
      color: 'warning',
    })
    return
  }

  if (!job.value.nextStepId) return

  skipLoading.value = true
  try {
    const { advanceToStep } = useLifecycle()
    for (const partId of payload.partIds) {
      await advanceToStep(partId, {
        targetStepId: job.value.nextStepId,
        userId: operatorId.value,
      })
    }

    toast.add({
      title: 'Step skipped',
      description: `${payload.partIds.length} part${payload.partIds.length !== 1 ? 's' : ''} skipped to ${job.value.nextStepName ?? 'next step'}`,
      color: 'success',
    })

    await fetchStep()
  } catch (e: any) {
    toast.add({
      title: 'Skip failed',
      description: e?.message ?? 'An error occurred',
      color: 'error',
    })
  } finally {
    skipLoading.value = false
  }
}

async function handleCreated(count: number) {
  toast.add({
    title: 'Parts created',
    description: `${count} part${count !== 1 ? 's' : ''} created`,
    color: 'success',
  })
  // Refresh step data to pick up newly created parts
  await fetchStep()
}

function handleCancel() {
  navigateTo(backNav.value.to)
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
      :to="backNav.to"
      class="inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ backNav.label }}
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
        :to="backNav.to"
        size="sm"
        variant="soft"
        :label="backNav.label"
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

    <!-- Step content -->
    <template v-else-if="job">
      <!-- Step header -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-bold text-(--ui-text-highlighted)">{{ job.stepName }}</h1>
              <span class="text-xs text-(--ui-text-muted) bg-(--ui-bg-elevated) px-1.5 py-0.5 rounded">
                Step {{ job.stepOrder + 1 }} of {{ job.totalSteps }}
              </span>
            </div>
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

        <!-- Prev / Next step navigation -->
        <div class="flex items-center justify-between">
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="Prev"
            :disabled="job.stepOrder === 0"
            :to="job.previousStepId ? `/parts/step/${job.previousStepId}${fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : ''}` : undefined"
          />
          <UButton
            size="xs"
            variant="ghost"
            trailing-icon="i-lucide-arrow-right"
            label="Next"
            :disabled="job.isFinalStep"
            :to="job.nextStepId ? `/parts/step/${job.nextStepId}${fromQuery ? `?from=${encodeURIComponent(fromQuery)}` : ''}` : undefined"
          />
        </div>
      </div>

      <!-- No operator warning -->
      <div
        v-if="!operatorId"
        class="text-sm text-(--ui-text-muted) py-8 text-center"
      >
        <UIcon name="i-lucide-hard-hat" class="size-8 mb-2 opacity-50" />
        <p>Select an operator to advance parts or create new parts.</p>
      </div>

      <!-- First step (always shows PartCreationPanel, even with 0 parts) -->
      <PartCreationPanel
        v-else-if="job.stepOrder === 0"
        :job="job"
        :loading="advanceLoading"
        @advance="handleAdvance"
        @cancel="handleCancel"
        @created="handleCreated"
      />

      <!-- Non-first step with zero parts: waiting for prior step -->
      <div
        v-else-if="job.partCount === 0"
        class="text-center py-12"
      >
        <UIcon name="i-lucide-clock" class="size-8 mx-auto mb-2 text-(--ui-text-muted)" />
        <p class="text-sm text-(--ui-text-highlighted) font-medium mb-1">Waiting for the previous step</p>
        <p class="text-xs text-(--ui-text-muted) mb-4">
          The prior step "{{ job.previousStepName }}" currently has
          {{ previousStepWipCount ?? 0 }} part{{ (previousStepWipCount ?? 0) !== 1 ? 's' : '' }} in progress.
          Parts will appear here once they are advanced from the previous step.
        </p>
        <UButton
          :to="backNav.to"
          size="sm"
          variant="soft"
          :label="backNav.label"
          icon="i-lucide-arrow-left"
        />
      </div>

      <!-- Non-first step with active parts: advancement panel -->
      <ProcessAdvancementPanel
        v-else
        :job="job"
        :loading="advanceLoading || skipLoading"
        :notes="notes"
        @advance="handleAdvance"
        @skip="handleSkip"
        @cancel="handleCancel"
        @scrapped="fetchStep"
      />
    </template>
  </div>
</template>
