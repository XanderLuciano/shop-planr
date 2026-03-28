<script setup lang="ts">
import type { WorkQueueJob, EnrichedPart, PartStepStatusView } from '~/server/types/computed'
import type { StepNote, CertAttachment, PartStepOverride } from '~/server/types/domain'

const route = useRoute()
const partId = route.params.id as string

const {
  part,
  job,
  path,
  distribution,
  siblingParts,
  loading,
  error,
  fetchDetail,
  fetchSiblings,
  refreshAfterAdvance,
} = usePartDetail(partId)

const { fetchNotesForStep, createNote } = useNotes()
const { getStepStatuses } = useLifecycle()
const { operatorId } = useOperatorIdentity()

const advanceLoading = ref(false)
const stepNotes = ref<StepNote[]>([])
const siblingsLoaded = ref(false)
const toast = useToast()

// Note creation state
const showNoteForm = ref(false)
const noteText = ref('')
const noteSaving = ref(false)

// Lifecycle data
const stepStatuses = ref<PartStepStatusView[]>([])
const overrides = ref<PartStepOverride[]>([])
const certAttachments = ref<CertAttachment[]>([])

// Tab state
const activeTab = ref('routing')
const tabs = [
  { label: 'Routing', value: 'routing' },
  { label: 'Siblings', value: 'siblings' },
]

// Siblings tab: sorting state
const siblingsSortColumn = ref<'id' | 'currentStepName' | 'status' | 'createdAt'>('id')
const siblingsSortDirection = ref<'asc' | 'desc'>('asc')

function toggleSiblingsSort(column: 'id' | 'currentStepName' | 'status' | 'createdAt') {
  if (siblingsSortColumn.value === column) {
    siblingsSortDirection.value = siblingsSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    siblingsSortColumn.value = column
    siblingsSortDirection.value = 'asc'
  }
}

const sortedSiblings = computed(() => {
  const list = [...siblingParts.value] as EnrichedPart[]
  const col = siblingsSortColumn.value
  const dir = siblingsSortDirection.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const aVal = String(a[col] ?? '')
    const bVal = String(b[col] ?? '')
    return aVal.localeCompare(bVal) * dir
  })
})

const siblingTotalCount = computed(() => siblingParts.value.length)
const siblingCompletedCount = computed(() =>
  siblingParts.value.filter((s: any) => s.status === 'completed' || s.currentStepIndex === -1).length,
)
const siblingInProgressCount = computed(() =>
  siblingParts.value.filter((s: any) => s.status === 'in-progress' || (s.currentStepIndex >= 0 && s.status !== 'scrapped')).length,
)

watch(activeTab, async (tab) => {
  if (tab === 'siblings' && !siblingsLoaded.value) {
    await fetchSiblings()
    siblingsLoaded.value = true
  }
})

// Computed states
const isScrapped = computed(() => part.value?.status === 'scrapped')
const isCompleted = computed(() => part.value?.status === 'completed' || part.value?.currentStepIndex === -1)
const isForceCompleted = computed(() => part.value?.forceCompleted === true)
const isInProgress = computed(() => part.value?.status === 'in_progress' || part.value?.status === 'in-progress' || (!isScrapped.value && !isCompleted.value && part.value?.currentStepIndex !== undefined && part.value.currentStepIndex >= 0))

const currentStep = computed(() => {
  if (!path.value || !part.value || part.value.currentStepIndex < 0) return null
  return path.value.steps[part.value.currentStepIndex] ?? null
})

const deferredSteps = computed(() =>
  stepStatuses.value.filter(s => s.status === 'deferred'),
)

const overriddenSteps = computed(() =>
  overrides.value.filter(o => o.active),
)

// WorkQueueJob for ProcessAdvancementPanel
const workQueueJob = computed<WorkQueueJob | null>(() => {
  if (!part.value || !job.value || !path.value || !currentStep.value) return null
  const steps = path.value.steps
  const stepIndex = part.value.currentStepIndex
  const isFinal = stepIndex === steps.length - 1
  const nextStep = isFinal ? null : steps[stepIndex + 1]

  return {
    jobId: job.value.id,
    jobName: job.value.name,
    pathId: path.value.id,
    pathName: path.value.name,
    stepId: currentStep.value.id,
    stepName: currentStep.value.name,
    stepOrder: currentStep.value.order,
    stepLocation: currentStep.value.location,
    totalSteps: steps.length,
    partIds: [part.value.id],
    partCount: 1,
    nextStepName: nextStep?.name,
    nextStepLocation: nextStep?.location,
    isFinalStep: isFinal,
  }
})

function getStepDistribution(stepId: string) {
  return distribution.value.find(d => d.stepId === stepId)
}

function getAssigneeName(assignedTo?: string) {
  if (!assignedTo) return 'Unassigned'
  return assignedTo
}

function getStepStatusForStep(stepId: string): PartStepStatusView | undefined {
  return stepStatuses.value.find(s => s.stepId === stepId)
}

function stepStatusBadge(stepId: string) {
  const ss = getStepStatusForStep(stepId)
  if (!ss) return null
  const map: Record<string, { color: string, label: string }> = {
    completed: { color: 'success', label: 'Completed' },
    in_progress: { color: 'info', label: 'In Progress' },
    pending: { color: 'neutral', label: 'Pending' },
    skipped: { color: 'neutral', label: 'Skipped' },
    deferred: { color: 'warning', label: 'Deferred' },
    waived: { color: 'warning', label: 'Waived' },
  }
  return map[ss.status] ?? null
}

function isStepOverridden(stepId: string): boolean {
  return overrides.value.some(o => o.stepId === stepId && o.active)
}

async function handleSaveNote() {
  if (!noteText.value.trim() || !currentStep.value || !job.value || !path.value) return
  noteSaving.value = true
  try {
    await createNote({
      jobId: job.value.id,
      pathId: path.value.id,
      stepId: currentStep.value.id,
      partIds: [partId],
      text: noteText.value.trim(),
      userId: operatorId.value ?? 'system',
    })
    showNoteForm.value = false
    noteText.value = ''
    toast.add({ title: 'Note created', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Failed to create note', description: e?.data?.message ?? e?.message ?? 'Failed to create note', color: 'error' })
  } finally {
    noteSaving.value = false
  }
}

async function handleAdvance(payload: { partIds: string[], note?: string }) {
  if (!part.value || !currentStep.value) return
  const { advancePart } = useParts()
  const { operatorId } = useOperatorIdentity()

  advanceLoading.value = true
  try {
    for (const sid of payload.partIds) {
      await advancePart(sid, operatorId.value ?? 'system')
    }
    if (payload.note?.trim()) {
      await $fetch('/api/notes', {
        method: 'POST',
        body: {
          jobId: job.value!.id,
          pathId: path.value!.id,
          stepId: currentStep.value.id,
          partIds: payload.partIds,
          text: payload.note.trim(),
          userId: operatorId.value ?? 'system',
        },
      })
    }
    await refreshAfterAdvance()
    await loadLifecycleData()
    toast.add({ title: 'Part advanced', description: `${part.value!.id} moved forward`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Advancement failed', description: e?.message ?? 'An error occurred', color: 'error' })
  } finally {
    advanceLoading.value = false
  }
}

async function loadStepNotes() {
  if (!currentStep.value) { stepNotes.value = []; return }
  try {
    stepNotes.value = await fetchNotesForStep(currentStep.value.id)
  } catch { stepNotes.value = [] }
}

async function loadLifecycleData() {
  try {
    stepStatuses.value = await getStepStatuses(partId)
  } catch { stepStatuses.value = [] }

  try {
    overrides.value = await $fetch<PartStepOverride[]>(`/api/parts/${encodeURIComponent(partId)}/overrides`)
  } catch { overrides.value = [] }

  try {
    certAttachments.value = await $fetch<CertAttachment[]>(`/api/parts/${encodeURIComponent(partId)}/cert-attachments`)
  } catch { certAttachments.value = [] }
}

async function onDeferredCompleted() {
  await refreshAfterAdvance()
  await loadLifecycleData()
}

async function onCertAttached() {
  await loadLifecycleData()
}

onMounted(async () => {
  await fetchDetail()
  await loadStepNotes()
  await loadLifecycleData()
})
</script>

<template>
  <div class="p-4 space-y-4 max-w-5xl">
    <!-- Back link -->
    <NuxtLink
      to="/parts-browser"
      class="inline-flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon name="i-lucide-arrow-left" class="size-3" />
      Back to Parts Browser
    </NuxtLink>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading part detail...
    </div>

    <!-- Error -->
    <div v-else-if="error && !part" class="text-sm text-red-500 py-8">{{ error }}</div>

    <template v-else-if="part && job && path">
      <!-- Header -->
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold text-(--ui-text-highlighted)">{{ part.id }}</h1>
          <UBadge
            :color="isScrapped ? 'error' : isCompleted ? 'success' : 'warning'"
            variant="subtle"
            size="sm"
          >
            {{ isScrapped ? 'Scrapped' : isForceCompleted ? 'Force Completed' : isCompleted ? 'Completed' : 'In Progress' }}
          </UBadge>
        </div>
        <div class="text-xs text-(--ui-text-muted)">
          {{ (job as any).name }} · {{ path.name }}
        </div>
      </div>

      <!-- Scrap indicator -->
      <div v-if="isScrapped" class="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 text-red-600 text-sm">
        <UIcon name="i-lucide-alert-triangle" class="size-4" />
        <div>
          <span class="font-medium">Scrapped</span>
          <span v-if="part.scrapReason"> — {{ part.scrapReason.replace(/_/g, ' ') }}</span>
          <span v-if="part.scrapExplanation">: {{ part.scrapExplanation }}</span>
          <div v-if="part.scrappedAt" class="text-xs mt-0.5">
            {{ part.scrappedBy ? `By ${part.scrappedBy}` : '' }} on {{ new Date(part.scrappedAt).toLocaleString() }}
          </div>
        </div>
      </div>

      <!-- Force-complete indicator -->
      <div v-if="isForceCompleted && !isScrapped" class="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 text-amber-600 text-sm">
        <UIcon name="i-lucide-shield-check" class="size-4" />
        <div>
          <span class="font-medium">Force completed</span>
          <span v-if="part.forceCompletedReason"> — {{ part.forceCompletedReason }}</span>
          <div v-if="part.forceCompletedAt" class="text-xs mt-0.5">
            {{ part.forceCompletedBy ? `By ${part.forceCompletedBy}` : '' }} on {{ new Date(part.forceCompletedAt).toLocaleString() }}
          </div>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="flex gap-1 border-b border-(--ui-border)">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="activeTab === tab.value
            ? 'border-(--ui-primary) text-(--ui-text-highlighted)'
            : 'border-transparent text-(--ui-text-muted) hover:text-(--ui-text-highlighted)'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Routing Tab -->
      <div v-if="activeTab === 'routing'" class="space-y-4">
        <!-- SectionCard: Routing -->
        <SectionCard title="Routing" icon="i-lucide-route">
          <!-- Step list -->
          <div class="border border-(--ui-border) rounded-md overflow-hidden divide-y divide-(--ui-border)">
            <div
              v-for="(step, index) in path.steps"
              :key="step.id"
              class="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-(--ui-primary)/5"
              :class="{
                'bg-(--ui-primary)/10 border-l-2 border-l-(--ui-primary)': part.currentStepIndex === index,
                'bg-(--ui-bg-elevated)/30': part.currentStepIndex !== index,
              }"
              @click="navigateTo(`/parts/step/${encodeURIComponent(step.id)}`)"
            >
              <!-- Step order -->
              <div class="flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0"
                :class="index < part.currentStepIndex || isCompleted
                  ? 'bg-green-500/20 text-green-600'
                  : part.currentStepIndex === index
                    ? 'bg-(--ui-primary)/20 text-(--ui-primary)'
                    : 'bg-(--ui-bg-elevated) text-(--ui-text-muted)'"
              >
                <UIcon v-if="index < part.currentStepIndex || isCompleted" name="i-lucide-check" class="size-3.5" />
                <span v-else>{{ step.order }}</span>
              </div>

              <!-- Step info -->
              <div class="flex-1 min-w-0">
                <div class="font-medium text-(--ui-text-highlighted) flex items-center gap-1.5">
                  {{ step.name }}
                  <UBadge v-if="step.optional" color="neutral" variant="subtle" size="xs">Optional</UBadge>
                  <UBadge v-if="isStepOverridden(step.id)" color="info" variant="subtle" size="xs">Override</UBadge>
                </div>
                <div v-if="step.location" class="text-xs text-(--ui-text-muted)">📍 {{ step.location }}</div>
                <!-- Step status badge -->
                <div v-if="stepStatusBadge(step.id)" class="mt-0.5">
                  <UBadge :color="(stepStatusBadge(step.id) as any).color" variant="subtle" size="xs">
                    {{ (stepStatusBadge(step.id) as any).label }}
                  </UBadge>
                </div>
              </div>

              <!-- Assigned user -->
              <div class="text-xs text-(--ui-text-muted) shrink-0">{{ getAssigneeName(step.assignedTo) }}</div>

              <!-- Distribution count -->
              <div class="shrink-0">
                <UBadge v-if="getStepDistribution(step.id)" variant="subtle" color="neutral" size="xs">
                  {{ getStepDistribution(step.id)!.partCount }} parts
                </UBadge>
              </div>
            </div>
          </div>

          <!-- Completed state -->
          <div v-if="isCompleted && !isScrapped && !isForceCompleted" class="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 text-green-600 text-sm mt-4">
            <UIcon name="i-lucide-check" class="size-4" />
            This part has completed all process steps.
          </div>

          <!-- Step overrides display -->
          <div v-if="overriddenSteps.length" class="space-y-2 mt-4">
            <h4 class="text-sm font-semibold text-(--ui-text-highlighted) flex items-center gap-1.5">
              <UIcon name="i-lucide-shuffle" class="size-4" />
              Step Overrides ({{ overriddenSteps.length }})
            </h4>
            <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
              <div v-for="ov in overriddenSteps" :key="ov.id" class="px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <span class="text-(--ui-text-highlighted)">Step {{ ov.stepId }}</span>
                  <span v-if="ov.reason" class="text-xs text-(--ui-text-muted) ml-2">{{ ov.reason }}</span>
                </div>
                <span class="text-xs text-(--ui-text-muted)">by {{ ov.createdBy }}</span>
              </div>
            </div>
          </div>

          <!-- Deferred steps -->
          <DeferredStepsList
            v-if="deferredSteps.length"
            class="mt-4"
            :part-id="partId"
            :steps="stepStatuses"
            @completed="onDeferredCompleted"
          />
        </SectionCard>

        <!-- SectionCard: Certificates -->
        <SectionCard title="Certificates" icon="i-lucide-file-badge">
          <!-- Cert attach button (only when in-progress) -->
          <CertAttachButton
            v-if="isInProgress && currentStep"
            :part-id="partId"
            :step-id="currentStep.id"
            @attached="onCertAttached"
          />

          <!-- Attached certificates list -->
          <div v-if="certAttachments.length" class="space-y-2" :class="{ 'mt-4': isInProgress && currentStep }">
            <div class="border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
              <div v-for="att in certAttachments" :key="`${att.certId}-${att.stepId}`" class="px-3 py-2 flex items-center justify-between text-sm">
                <span class="font-mono text-(--ui-text-highlighted)">{{ att.certId }}</span>
                <span class="text-xs text-(--ui-text-muted)">{{ new Date(att.attachedAt).toLocaleString() }} by {{ att.attachedBy }}</span>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!certAttachments.length && !isInProgress" class="text-sm text-(--ui-text-muted)">
            No certificates attached
          </div>
        </SectionCard>

        <!-- SectionCard: Notes -->
        <SectionCard title="Notes" icon="i-lucide-message-square">
          <div class="space-y-3">
            <PartDetailNotes :part-id="partId" hide-heading />

            <!-- Add Note button — visible only for in-progress parts when form is closed -->
            <UButton
              v-if="isInProgress && !showNoteForm"
              icon="i-lucide-plus"
              label="Add Note"
              size="sm"
              variant="outline"
              @click="showNoteForm = true"
            />

            <!-- Inline note creation form -->
            <div v-if="showNoteForm" class="space-y-2">
              <UTextarea
                v-model="noteText"
                placeholder="Type your note..."
                :readonly="noteSaving"
                :rows="3"
                size="sm"
              />
              <div class="flex gap-2">
                <UButton
                  label="Save"
                  size="sm"
                  :disabled="!noteText.trim() || noteSaving"
                  :loading="noteSaving"
                  @click="handleSaveNote"
                />
                <UButton
                  label="Cancel"
                  size="sm"
                  variant="outline"
                  :disabled="noteSaving"
                  @click="showNoteForm = false; noteText = ''"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <!-- SectionCard: Advance Process (conditional) -->
        <SectionCard v-if="isInProgress && workQueueJob" title="Advance Process" icon="i-lucide-arrow-right-circle">
          <ProcessAdvancementPanel
            :job="workQueueJob"
            :loading="advanceLoading"
            :notes="stepNotes"
            @advance="handleAdvance"
            @cancel="() => {}"
          />
        </SectionCard>
      </div>

      <!-- Siblings Tab -->
      <div v-if="activeTab === 'siblings'" class="space-y-3">
        <div class="flex gap-4 text-xs text-(--ui-text-muted)">
          <span>Total: <span class="font-medium text-(--ui-text-highlighted)">{{ siblingTotalCount }}</span></span>
          <span>Completed: <span class="font-medium text-green-600">{{ siblingCompletedCount }}</span></span>
          <span>In Progress: <span class="font-medium text-amber-600">{{ siblingInProgressCount }}</span></span>
        </div>

        <div class="border border-(--ui-border) rounded-md overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-(--ui-bg-elevated)/50 text-xs text-(--ui-text-muted)">
                <th class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none" @click="toggleSiblingsSort('id')">
                  Identifier <span v-if="siblingsSortColumn === 'id'">{{ siblingsSortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none" @click="toggleSiblingsSort('currentStepName')">
                  Current Step <span v-if="siblingsSortColumn === 'currentStepName'">{{ siblingsSortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none" @click="toggleSiblingsSort('status')">
                  Status <span v-if="siblingsSortColumn === 'status'">{{ siblingsSortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
                <th class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none" @click="toggleSiblingsSort('createdAt')">
                  Created <span v-if="siblingsSortColumn === 'createdAt'">{{ siblingsSortDirection === 'asc' ? '↑' : '↓' }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-(--ui-border)">
              <tr
                v-for="sib in sortedSiblings"
                :key="sib.id"
                class="cursor-pointer transition-colors"
                :class="sib.id === partId ? 'bg-(--ui-primary)/10 font-medium' : 'hover:bg-(--ui-bg-elevated)/50'"
                @click="navigateTo(`/parts-browser/${encodeURIComponent(sib.id)}`)"
              >
                <td class="px-3 py-2 text-(--ui-text-highlighted)">{{ sib.id }}</td>
                <td class="px-3 py-2">{{ sib.currentStepName }}</td>
                <td class="px-3 py-2">
                  <UBadge
                    :color="sib.status === 'completed' ? 'success' : sib.status === 'scrapped' ? 'error' : 'warning'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ sib.status === 'completed' ? 'Completed' : sib.status === 'scrapped' ? 'Scrapped' : 'In Progress' }}
                  </UBadge>
                </td>
                <td class="px-3 py-2 text-(--ui-text-muted)">{{ new Date(sib.createdAt).toLocaleDateString() }}</td>
              </tr>
              <tr v-if="sortedSiblings.length === 0">
                <td colspan="4" class="px-3 py-6 text-center text-(--ui-text-muted)">No sibling parts found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
