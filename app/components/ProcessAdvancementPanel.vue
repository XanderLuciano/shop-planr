<script setup lang="ts">
import type { WorkQueueJob } from '~/types/computed'
import type { StepNote } from '~/types/domain'

const props = defineProps<{
  job: WorkQueueJob
  loading: boolean
  notes?: readonly StepNote[]
}>()

const emit = defineEmits<{
  advance: [payload: { partIds: string[], note?: string }]
  cancel: []
  scrapped: []
  skipped: []
  noteAdded: [note: StepNote]
}>()

const { isAdmin, users } = useAuth()
const { advanceToStep } = useLifecycle()
const toast = useToast()

const localPartIds = ref<string[]>([...props.job.partIds])
const selectedParts = ref<Set<string>>(new Set())
const quantity = ref(props.job.partCount)
const note = ref('')
const validationError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Re-sync localPartIds when the prop changes (e.g. after server re-fetch)
watch(() => props.job.partIds, (newIds) => {
  localPartIds.value = [...newIds]
})

// Add Note dialog state
const showAddNoteDialog = ref(false)

// Scrap / force-complete dialog state
const showScrapDialog = ref(false)
const scrapTargetId = ref<string | null>(null)
const showForceCompleteDialog = ref(false)
const forceCompleteTargetId = ref<string | null>(null)

// --- Advanced options state ---
const advancedOpen = ref(false)
const selectedTargetStepId = ref<string | typeof SELECT_NONE>(SELECT_NONE)
const skipLoading = ref(false)

// Reset advanced options when step changes
watch(() => props.job.stepId, () => {
  advancedOpen.value = false
  selectedTargetStepId.value = SELECT_NONE
})

// Compute available target steps for skip-to dropdown
const availableTargetSteps = computed(() => {
  const steps = props.job.pathSteps
  if (!steps || steps.length === 0) return []

  const futureSteps = steps.filter(s => s.order > props.job.stepOrder)

  // In strict mode, only show the immediate next step
  if (props.job.pathAdvancementMode === 'strict') {
    const nextStep = futureSteps.find(s => s.order === props.job.stepOrder + 1)
    return nextStep ? [nextStep] : []
  }

  return futureSteps
})

const targetStepItems = computed(() => [
  { label: 'Select step...', value: SELECT_NONE, disabled: true },
  ...availableTargetSteps.value.map(s => ({
    label: `${s.order + 1}. ${s.name}${s.location ? ` (${s.location})` : ''}`,
    value: s.id,
  })),
])

// Compute bypass preview: steps between current and target
const bypassPreview = computed(() => {
  const targetId = selectedOrUndefined(selectedTargetStepId.value)
  if (!targetId || !props.job.pathSteps) return []

  const targetStep = props.job.pathSteps.find(s => s.id === targetId)
  if (!targetStep) return []

  // Steps between current step and target (exclusive of both)
  return props.job.pathSteps
    .filter(s => s.order > props.job.stepOrder && s.order < targetStep.order)
    .map(s => ({
      stepId: s.id,
      stepName: s.name,
      classification: s.optional ? 'skip' as const : 'defer' as const,
    }))
})

const hasTargetSelected = computed(() =>
  selectedOrUndefined(selectedTargetStepId.value) !== undefined,
)

watch(selectedParts, (sel) => {
  quantity.value = sel.size
  validateQuantity()
}, { deep: true })

watch(quantity, () => {
  validateQuantity()
})

function validateQuantity() {
  const count = localPartIds.value.length
  if (quantity.value > count) {
    validationError.value = `Cannot exceed ${count} available part${count !== 1 ? 's' : ''}`
  } else if (quantity.value < 1) {
    validationError.value = 'Quantity must be at least 1'
  } else {
    validationError.value = null
  }
}

function togglePart(partId: string) {
  const next = new Set(selectedParts.value)
  if (next.has(partId)) next.delete(partId)
  else next.add(partId)
  selectedParts.value = next
}

function selectByQuantity() {
  const q = Math.min(Math.max(1, quantity.value), localPartIds.value.length)
  const next = new Set<string>()
  for (let i = 0; i < q && i < localPartIds.value.length; i++) {
    next.add(localPartIds.value[i]!)
  }
  selectedParts.value = next
}

function selectAll() {
  selectedParts.value = new Set(localPartIds.value)
  quantity.value = localPartIds.value.length
}

function selectNone() {
  selectedParts.value = new Set()
  quantity.value = 0
}

function handleAdvance() {
  if (validationError.value || selectedParts.value.size === 0) return
  const ids = localPartIds.value.filter((id: string) => selectedParts.value.has(id))
  const trimmedNote = note.value.trim()
  emit('advance', { partIds: ids, note: trimmedNote || undefined })
}

function formatDestination(): string {
  if (props.job.isFinalStep) return 'Completed'
  if (!props.job.nextStepName) return '—'
  let dest = props.job.nextStepName
  if (props.job.nextStepLocation) dest += ` → ${props.job.nextStepLocation}`
  if (props.job.nextStepAssignedTo) {
    const user = users.value.find(u => u.id === props.job.nextStepAssignedTo)
    if (user) dest += ` · ${user.displayName}`
  }
  return dest
}

function openScrap(partId: string) {
  scrapTargetId.value = partId
  showScrapDialog.value = true
}

function openForceComplete(partId: string) {
  forceCompleteTargetId.value = partId
  showForceCompleteDialog.value = true
}

function handleScrapped() {
  if (!scrapTargetId.value) return
  const scrappedId = scrapTargetId.value
  localPartIds.value = removePartFromList(localPartIds.value, scrappedId)
  selectedParts.value = removePartFromSelection(selectedParts.value, scrappedId)
  scrapTargetId.value = null
  emit('scrapped')
}

async function handleSkipSelectedParts() {
  const targetId = selectedOrUndefined(selectedTargetStepId.value)
  if (!targetId || selectedParts.value.size === 0 || skipLoading.value) return

  const ids = localPartIds.value.filter((id: string) => selectedParts.value.has(id))
  skipLoading.value = true
  try {
    for (const partId of ids) {
      await advanceToStep(partId, { targetStepId: targetId, skip: true })
    }
    toast.add({
      title: 'Parts skipped',
      description: `${ids.length} part${ids.length !== 1 ? 's' : ''} skipped forward`,
      color: 'success',
    })
    emit('skipped')
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Skip failed',
      description: err?.data?.message ?? err?.message ?? 'An error occurred',
      color: 'error',
    })
  } finally {
    skipLoading.value = false
  }
}

onMounted(() => {
  selectAll()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Destination info -->
    <div class="text-xs px-2 py-1.5 rounded-md bg-(--ui-bg-elevated)/50 border border-(--ui-border)">
      <span class="text-(--ui-text-muted)">Advancing to:</span>
      <span class="ml-1 font-medium text-(--ui-text-highlighted)">{{ formatDestination() }}</span>
    </div>

    <!-- Part selection -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">
          Parts ({{ selectedParts.size }}/{{ localPartIds.length }})
        </span>
        <div class="flex gap-1">
          <UButton
            size="xs"
            variant="ghost"
            label="All"
            @click="selectAll"
          />
          <UButton
            size="xs"
            variant="ghost"
            label="None"
            @click="selectNone"
          />
        </div>
      </div>
      <div class="max-h-40 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="partId in localPartIds"
          :key="partId"
          class="flex items-center justify-between px-2 py-1.5 hover:bg-(--ui-bg-elevated)/30"
        >
          <label class="flex items-center gap-2 cursor-pointer text-xs flex-1">
            <input
              type="checkbox"
              :checked="selectedParts.has(partId)"
              class="rounded"
              @change="togglePart(partId)"
            >
            <span class="font-mono">{{ partId }}</span>
          </label>
          <div class="flex items-center gap-0.5 shrink-0">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-eye"
              title="View part detail"
              :to="`/parts-browser/${encodeURIComponent(partId)}`"
              @click.stop
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              title="Scrap"
              @click="openScrap(partId)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="success"
              icon="i-lucide-shield-check"
              title="Force Complete"
              @click="openForceComplete(partId)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Quantity input -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Quantity</label>
      <div class="flex items-center gap-2">
        <UInput
          v-model.number="quantity"
          type="number"
          :min="1"
          :max="localPartIds.length"
          size="sm"
          class="w-24"
          @blur="selectByQuantity"
        />
        <span class="text-xs text-(--ui-text-muted)">of {{ localPartIds.length }} available</span>
      </div>
      <p
        v-if="validationError"
        class="text-xs text-(--ui-error) mt-1"
      >
        {{ validationError }}
      </p>
    </div>

    <!-- Optional note -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Note (optional)</label>
      <UTextarea
        v-model="note"
        placeholder="Add observations or issues..."
        :maxlength="1000"
        :rows="2"
        size="sm"
      />
      <div class="text-xs text-(--ui-text-muted) text-right mt-0.5">
        {{ note.length }}/1000
      </div>
    </div>

    <!-- Existing notes -->
    <div v-if="notes && notes.length">
      <span class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Previous Notes</span>
      <StepNoteList :notes="notes" />
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1">
      <UButton
        :loading="loading"
        :disabled="loading || skipLoading || !!validationError || selectedParts.size === 0"
        size="sm"
        color="primary"
        label="Advance"
        icon="i-lucide-arrow-right"
        @click="handleAdvance"
      />
      <UButton
        size="sm"
        variant="outline"
        label="Add Note"
        icon="i-lucide-message-square-plus"
        @click="showAddNoteDialog = true"
      />
      <UButton
        size="sm"
        variant="ghost"
        label="Cancel"
        @click="emit('cancel')"
      />
    </div>

    <!-- Admin-only Advanced options -->
    <div v-if="isAdmin">
      <button
        class="flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
        @click="advancedOpen = !advancedOpen"
      >
        <UIcon
          :name="advancedOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="size-4"
        />
        Advanced options
      </button>

      <div
        v-if="advancedOpen"
        class="mt-2 border border-(--ui-border) rounded-md p-3 space-y-3"
      >
        <!-- Skip-to-step dropdown -->
        <div>
          <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Skip to:</label>
          <USelect
            v-model="selectedTargetStepId"
            :items="targetStepItems"
            size="sm"
            class="w-full"
          />
        </div>

        <!-- Bypass preview -->
        <div
          v-if="hasTargetSelected && bypassPreview.length > 0"
          class="text-xs space-y-1"
        >
          <p class="font-medium text-amber-600 dark:text-amber-400">
            ⚠ {{ bypassPreview.length }} step{{ bypassPreview.length !== 1 ? 's' : '' }} will be bypassed:
          </p>
          <div class="border border-amber-200 dark:border-amber-800 rounded-md divide-y divide-amber-200 dark:divide-amber-800">
            <div
              v-for="bp in bypassPreview"
              :key="bp.stepId"
              class="px-2 py-1.5 flex items-center justify-between"
            >
              <span class="text-(--ui-text-highlighted)">{{ bp.stepName }}</span>
              <UBadge
                :color="bp.classification === 'skip' ? 'neutral' : 'warning'"
                variant="subtle"
                size="xs"
              >
                {{ bp.classification === 'skip' ? 'Skip' : 'Defer' }}
              </UBadge>
            </div>
          </div>
          <p
            v-if="bypassPreview.some(b => b.classification === 'defer')"
            class="text-amber-600 dark:text-amber-400"
          >
            ⚠ Required steps will be deferred and must be completed before final sign-off.
          </p>
        </div>

        <!-- Skip Selected Parts button -->
        <UButton
          :loading="skipLoading"
          :disabled="skipLoading || loading || !hasTargetSelected || selectedParts.size === 0"
          size="sm"
          variant="outline"
          color="neutral"
          label="Skip Selected Parts"
          icon="i-lucide-skip-forward"
          @click="handleSkipSelectedParts"
        />
      </div>
    </div>

    <!-- Success message -->
    <div
      v-if="successMessage"
      class="text-xs text-(--ui-success) bg-(--ui-success)/10 px-2 py-1.5 rounded-md"
    >
      {{ successMessage }}
    </div>

    <!-- Scrap dialog -->
    <ScrapDialog
      v-if="scrapTargetId"
      :part-id="scrapTargetId"
      :model-value="showScrapDialog"
      @update:model-value="showScrapDialog = $event"
      @scrapped="handleScrapped"
    />

    <!-- Force complete dialog -->
    <ForceCompleteDialog
      v-if="forceCompleteTargetId"
      :part-id="forceCompleteTargetId"
      :incomplete-steps="[]"
      :model-value="showForceCompleteDialog"
      @update:model-value="showForceCompleteDialog = $event"
      @completed="forceCompleteTargetId = null"
    />

    <!-- Add Note dialog -->
    <AddNoteDialog
      v-model="showAddNoteDialog"
      :part-ids="localPartIds"
      :job-id="job.jobId"
      :path-id="job.pathId"
      :step-id="job.stepId"
      :step-name="job.stepName"
      :pre-selected-part-ids="[...selectedParts]"
      @saved="emit('noteAdded', $event)"
    />
  </div>
</template>
