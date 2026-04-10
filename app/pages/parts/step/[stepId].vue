<script setup lang="ts">
const route = useRoute()
const stepId = route.params.stepId as string
const { backNavigation: backNav, goBack } = useNavigationStack()

// Deterministic fallback derived from shared helpers (no sessionStorage dependency)
const fallbackPath = resolveFallbackRoute(route.path)
const fallbackLabel = `Back to ${resolveLabel(fallbackPath)}`

const {
  job,
  notes,
  loading,
  error,
  notFound,
  previousStepWipCount,
  fetchStep,
} = useStepView(stepId)

const { advanceBatch } = useAdvanceBatch()
const { users } = useAuth()

const advanceLoading = ref(false)
const skipLoading = ref(false)
const editing = ref(false)
const toast = useToast()

// Resolve assignee user ID to display name
const assigneeName = computed(() => {
  if (!job.value?.assignedTo) return null
  const user = users.value.find(u => u.id === job.value!.assignedTo)
  return user?.displayName ?? null
})

async function handleSaved() {
  editing.value = false
  await fetchStep()
}

function handleEditCancel() {
  editing.value = false
}

async function handleAdvance(payload: { partIds: string[], note?: string }) {
  if (!job.value) return

  advanceLoading.value = true
  try {
    const result = await advanceBatch({
      partIds: payload.partIds,
      jobId: job.value.jobId,
      pathId: job.value.pathId,
      stepId: job.value.stepId,
      availablePartCount: job.value.partCount,
      note: payload.note,
    })

    const dest = job.value.isFinalStep ? 'Completed' : (job.value.nextStepName ?? 'next step')
    toast.add({
      title: 'Parts advanced',
      description: `${result.advanced} part${result.advanced !== 1 ? 's' : ''} moved to ${dest}`,
      color: 'success',
    })

    // Refresh step data
    await fetchStep()
  } catch (e) {
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
  if (!job.value) return

  skipLoading.value = true
  try {
    const { advanceToStep } = useLifecycle()
    const result = await executeSkip({
      partIds: payload.partIds,
      nextStepId: job.value.nextStepId,
      advanceToStep,
    })

    if (!result.skipped) {
      toast.add({
        title: 'Skip failed',
        description: result.error ?? 'An error occurred',
        color: 'warning',
      })
      return
    }

    toast.add({
      title: 'Step skipped',
      description: `${result.count} part${result.count !== 1 ? 's' : ''} skipped to ${job.value.nextStepName ?? 'next step'}`,
      color: 'success',
    })

    await fetchStep()
  } catch (e) {
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
  goBack()
}

onMounted(async () => {
  await fetchStep()
})
</script>

<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <!-- Back link -->
    <ClientOnly>
      <NuxtLink
        :to="backNav.to"
        class="inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
        {{ backNav.label }}
      </NuxtLink>
      <template #fallback>
        <NuxtLink
          :to="fallbackPath"
          class="inline-flex items-center gap-1 text-sm text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          {{ fallbackLabel }}
        </NuxtLink>
      </template>
    </ClientOnly>

    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-12 justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading step data...
    </div>

    <!-- 404 state -->
    <div
      v-else-if="notFound"
      class="text-center py-12"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        class="size-8 mx-auto mb-2 text-(--ui-warning)"
      />
      <p class="text-sm text-(--ui-text-highlighted) font-medium mb-1">
        Step not found
      </p>
      <p class="text-xs text-(--ui-text-muted) mb-4">
        This step doesn't exist or has no active parts.
      </p>
      <ClientOnly>
        <UButton
          :to="backNav.to"
          size="sm"
          variant="soft"
          :label="backNav.label"
          icon="i-lucide-arrow-left"
        />
        <template #fallback>
          <UButton
            :to="fallbackPath"
            size="sm"
            variant="soft"
            :label="fallbackLabel"
            icon="i-lucide-arrow-left"
          />
        </template>
      </ClientOnly>
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
      <div class="space-y-3">
        <!-- Breadcrumb: Job (linked) › Path › Step -->
        <UBreadcrumb
          :items="[
            { label: job.jobName, to: `/jobs/${job.jobId}`, icon: 'i-lucide-briefcase' },
            { label: job.pathName, icon: 'i-lucide-git-branch' },
            { label: job.stepName },
          ]"
        />

        <!-- Title row: step name + prev/next -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <h1 class="text-xl font-semibold text-(--ui-text-highlighted) truncate">
              {{ job.stepName }}
            </h1>
            <UButton
              v-if="!editing"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil"
              aria-label="Edit step properties"
              @click="editing = true"
            />
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-chevron-left"
              aria-label="Previous step"
              :disabled="job.stepOrder === 0"
              :to="job.previousStepId ? `/parts/step/${job.previousStepId}` : undefined"
            />
            <UBadge
              size="sm"
              color="neutral"
              variant="subtle"
            >
              {{ job.stepOrder + 1 }} / {{ job.totalSteps }}
            </UBadge>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-chevron-right"
              aria-label="Next step"
              :disabled="job.isFinalStep"
              :to="job.nextStepId ? `/parts/step/${job.nextStepId}` : undefined"
            />
          </div>
        </div>

        <!-- Metadata badges -->
        <div
          v-if="!editing && (job.stepLocation || assigneeName)"
          class="flex items-center gap-1.5 flex-wrap"
        >
          <UBadge
            v-if="job.stepLocation"
            size="sm"
            color="neutral"
            variant="soft"
            leading-icon="i-lucide-map-pin"
          >
            {{ job.stepLocation }}
          </UBadge>
          <UBadge
            v-if="assigneeName"
            size="sm"
            color="neutral"
            variant="soft"
            leading-icon="i-lucide-user"
          >
            {{ assigneeName }}
          </UBadge>
        </div>

        <!-- Inline editor (replaces metadata when active) -->
        <StepPropertiesEditor
          v-if="editing"
          :step-id="job.stepId"
          :current-assigned-to="job.assignedTo"
          :current-location="job.stepLocation"
          @saved="handleSaved"
          @cancel="handleEditCancel"
        />
      </div>

      <!-- First step (always shows PartCreationPanel, even with 0 parts) -->
      <PartCreationPanel
        v-if="job.stepOrder === 0"
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
        <UIcon
          name="i-lucide-clock"
          class="size-8 mx-auto mb-2 text-(--ui-text-muted)"
        />
        <p class="text-sm text-(--ui-text-highlighted) font-medium mb-1">
          Waiting for the previous step
        </p>
        <p class="text-xs text-(--ui-text-muted) mb-4">
          The prior step "{{ job.previousStepName }}" currently has
          {{ previousStepWipCount ?? 0 }} part{{ (previousStepWipCount ?? 0) !== 1 ? 's' : '' }} in progress.
          Parts will appear here once they are advanced from the previous step.
        </p>
        <ClientOnly>
          <UButton
            :to="backNav.to"
            size="sm"
            variant="soft"
            :label="backNav.label"
            icon="i-lucide-arrow-left"
          />
          <template #fallback>
            <UButton
              :to="fallbackPath"
              size="sm"
              variant="soft"
              :label="fallbackLabel"
              icon="i-lucide-arrow-left"
            />
          </template>
        </ClientOnly>
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
        @note-added="fetchStep"
      />
    </template>
  </div>
</template>
