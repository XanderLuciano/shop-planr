<script setup lang="ts">
import type { PartStepStatusView } from '~/types/computed'

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
const $api = useAuthFetch()
const { users } = useAuth()

const advanceLoading = ref(false)
const editing = ref(false)
const toast = useToast()

// Deferred steps: map of partId → step statuses (only for parts with deferred steps)
const partStepStatuses = ref<Map<string, PartStepStatusView[]>>(new Map())

const partsWithDeferredSteps = computed(() => {
  const entries: { partId: string, steps: PartStepStatusView[] }[] = []
  for (const [partId, steps] of partStepStatuses.value) {
    if (steps.some(s => s.status === 'deferred')) {
      entries.push({ partId, steps })
    }
  }
  return entries
})

async function fetchDeferredSteps() {
  if (!job.value?.partIds?.length) {
    partStepStatuses.value = new Map()
    return
  }

  const statusMap = new Map<string, PartStepStatusView[]>()
  const result = await $api<Record<string, PartStepStatusView[]>>(
    '/api/parts/batch-step-statuses',
    { method: 'POST', body: { partIds: job.value.partIds } },
  )

  for (const [partId, statuses] of Object.entries(result)) {
    if (statuses.some(s => s.status === 'deferred')) {
      statusMap.set(partId, statuses)
    }
  }
  partStepStatuses.value = statusMap
}

async function handleDeferredStepChanged() {
  await Promise.all([fetchStep(), fetchDeferredSteps()])
}

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

    if (result.failed > 0) {
      toast.add({
        title: 'Partial advancement',
        description: `${result.advanced} part${result.advanced !== 1 ? 's' : ''} moved to ${dest}, ${result.failed} failed`,
        color: 'warning',
      })
    } else {
      toast.add({
        title: 'Parts advanced',
        description: `${result.advanced} part${result.advanced !== 1 ? 's' : ''} moved to ${dest}`,
        color: 'success',
      })
    }

    // Refresh step data
    await fetchStep()
    await fetchDeferredSteps()
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

async function handleCreated(count: number) {
  toast.add({
    title: 'Parts created',
    description: `${count} part${count !== 1 ? 's' : ''} created`,
    color: 'success',
  })
  // Refresh step data to pick up newly created parts
  await fetchStep()
  await fetchDeferredSteps()
}

function handleCancel() {
  goBack()
}

onMounted(async () => {
  await fetchStep()
  await fetchDeferredSteps()
})
</script>

<template>
  <div class="px-4 pt-2 pb-4 space-y-3 max-w-5xl">
    <!-- Back link + step stepper -->
    <ClientOnly>
      <div class="flex items-center justify-between">
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
        <div
          v-if="job"
          class="flex items-center gap-0.5 shrink-0 bg-primary/5 ring ring-inset ring-primary/15 rounded-lg p-0.5"
        >
          <UButton
            size="sm"
            variant="ghost"
            color="primary"
            icon="i-lucide-chevron-left"
            aria-label="Previous step"
            :disabled="job.stepOrder === 0"
            :to="job.previousStepId ? `/parts/step/${job.previousStepId}` : undefined"
          />
          <USeparator
            orientation="vertical"
            class="h-4"
          />
          <span class="text-xs font-medium text-primary px-1.5 tabular-nums">
            <span class="hidden sm:inline">Step </span>{{ job.stepOrder + 1 }} / {{ job.totalSteps }}
          </span>
          <USeparator
            orientation="vertical"
            class="h-4"
          />
          <UButton
            size="sm"
            variant="ghost"
            color="primary"
            icon="i-lucide-chevron-right"
            aria-label="Next step"
            :disabled="job.isFinalStep"
            :to="job.nextStepId ? `/parts/step/${job.nextStepId}` : undefined"
          />
        </div>
      </div>
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
      <div class="space-y-2">
        <!-- Breadcrumb: Job (linked) › Path › Step -->
        <UBreadcrumb
          :items="[
            { label: job.jobName, to: `/jobs/${encodeURIComponent(job.jobId)}`, icon: 'i-lucide-briefcase' },
            { label: job.pathName, icon: 'i-lucide-git-branch' },
            { label: job.stepName },
          ]"
        />

        <!-- Title row: step name -->
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
        :loading="advanceLoading"
        :notes="notes"
        @advance="handleAdvance"
        @skipped="handleDeferredStepChanged"
        @cancel="handleCancel"
        @scrapped="fetchStep"
        @note-added="fetchStep"
      />

      <!-- Deferred steps for parts at this step -->
      <DeferredStepsList
        v-for="entry in partsWithDeferredSteps"
        :key="entry.partId"
        :part-id="entry.partId"
        :steps="entry.steps"
        @completed="handleDeferredStepChanged"
        @waived="handleDeferredStepChanged"
      />
    </template>
  </div>
</template>
