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
  skip: [payload: { partIds: string[] }]
}>()

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

// Scrap / force-complete dialog state
const showScrapDialog = ref(false)
const scrapTargetId = ref<string | null>(null)
const showForceCompleteDialog = ref(false)
const forceCompleteTargetId = ref<string | null>(null)

watch(selectedParts, (sel) => {
  quantity.value = sel.size
  validateQuantity()
}, { deep: true })

watch(quantity, () => { validateQuantity() })

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

function handleSkip() {
  if (selectedParts.value.size === 0) return
  const ids = localPartIds.value.filter((id: string) => selectedParts.value.has(id))
  emit('skip', { partIds: ids })
}

function formatDestination(): string {
  if (props.job.isFinalStep) return 'Completed'
  if (!props.job.nextStepName) return '—'
  return props.job.nextStepLocation
    ? `${props.job.nextStepName} → ${props.job.nextStepLocation}`
    : props.job.nextStepName
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

onMounted(() => { selectAll() })
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
          <UButton size="xs" variant="ghost" label="All" @click="selectAll" />
          <UButton size="xs" variant="ghost" label="None" @click="selectNone" />
        </div>
      </div>
      <div class="max-h-40 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="partId in localPartIds"
          :key="partId"
          class="flex items-center justify-between px-2 py-1.5 hover:bg-(--ui-bg-elevated)/30"
        >
          <label class="flex items-center gap-2 cursor-pointer text-xs flex-1">
            <input type="checkbox" :checked="selectedParts.has(partId)" class="rounded" @change="togglePart(partId)">
            <span class="font-mono">{{ partId }}</span>
          </label>
          <div class="flex items-center gap-0.5 shrink-0">
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-eye" title="View part detail" :to="partDetailLink(partId)" @click.stop />
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" title="Scrap" @click="openScrap(partId)" />
            <UButton size="xs" variant="ghost" color="success" icon="i-lucide-shield-check" title="Force Complete" @click="openForceComplete(partId)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Quantity input -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Quantity</label>
      <div class="flex items-center gap-2">
      <UInput v-model.number="quantity" type="number" :min="1" :max="localPartIds.length" size="sm" class="w-24" @blur="selectByQuantity" />
        <span class="text-xs text-(--ui-text-muted)">of {{ localPartIds.length }} available</span>
      </div>
      <p v-if="validationError" class="text-xs text-(--ui-error) mt-1">{{ validationError }}</p>
    </div>

    <!-- Optional note -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Note (optional)</label>
      <UTextarea v-model="note" placeholder="Add observations or issues..." :maxlength="1000" :rows="2" size="sm" />
      <div class="text-xs text-(--ui-text-muted) text-right mt-0.5">{{ note.length }}/1000</div>
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
        :disabled="loading || !!validationError || selectedParts.size === 0"
        size="sm" color="primary" label="Advance" icon="i-lucide-arrow-right"
        @click="handleAdvance"
      />
      <UButton
        v-if="job.stepOptional && !job.isFinalStep"
        :loading="loading"
        :disabled="loading || selectedParts.size === 0"
        size="sm"
        variant="outline"
        color="neutral"
        label="Skip"
        icon="i-lucide-skip-forward"
        @click="handleSkip"
      />
      <UButton size="sm" variant="ghost" label="Cancel" @click="emit('cancel')" />
    </div>

    <!-- Success message -->
    <div v-if="successMessage" class="text-xs text-(--ui-success) bg-(--ui-success)/10 px-2 py-1.5 rounded-md">
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
  </div>
</template>
