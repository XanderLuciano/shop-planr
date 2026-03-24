<script setup lang="ts">
import type { WorkQueueJob } from '~/server/types/computed'
import type { StepNote } from '~/server/types/domain'

const props = defineProps<{
  job: WorkQueueJob
  loading: boolean
  notes?: StepNote[]
}>()

const emit = defineEmits<{
  advance: [payload: { serialIds: string[], note?: string }]
  cancel: []
}>()

const selectedSerials = ref<Set<string>>(new Set())
const quantity = ref(props.job.partCount)
const note = ref('')
const validationError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Scrap / force-complete dialog state
const showScrapDialog = ref(false)
const scrapTargetId = ref<string | null>(null)
const showForceCompleteDialog = ref(false)
const forceCompleteTargetId = ref<string | null>(null)

watch(selectedSerials, (sel) => {
  quantity.value = sel.size
  validateQuantity()
}, { deep: true })

watch(quantity, () => { validateQuantity() })

function validateQuantity() {
  if (quantity.value > props.job.partCount) {
    validationError.value = `Cannot exceed ${props.job.partCount} available part${props.job.partCount !== 1 ? 's' : ''}`
  } else if (quantity.value < 1) {
    validationError.value = 'Quantity must be at least 1'
  } else {
    validationError.value = null
  }
}

function toggleSerial(serialId: string) {
  const next = new Set(selectedSerials.value)
  if (next.has(serialId)) next.delete(serialId)
  else next.add(serialId)
  selectedSerials.value = next
}

function selectByQuantity() {
  const q = Math.min(Math.max(1, quantity.value), props.job.partCount)
  const next = new Set<string>()
  for (let i = 0; i < q && i < props.job.serialIds.length; i++) {
    next.add(props.job.serialIds[i]!)
  }
  selectedSerials.value = next
}

function selectAll() {
  selectedSerials.value = new Set(props.job.serialIds)
  quantity.value = props.job.partCount
}

function selectNone() {
  selectedSerials.value = new Set()
  quantity.value = 0
}

function handleAdvance() {
  if (validationError.value || selectedSerials.value.size === 0) return
  const ids = props.job.serialIds.filter((id: string) => selectedSerials.value.has(id))
  const trimmedNote = note.value.trim()
  emit('advance', { serialIds: ids, note: trimmedNote || undefined })
}

function formatDestination(): string {
  if (props.job.isFinalStep) return 'Completed'
  if (!props.job.nextStepName) return '—'
  return props.job.nextStepLocation
    ? `${props.job.nextStepName} → ${props.job.nextStepLocation}`
    : props.job.nextStepName
}

function openScrap(serialId: string) {
  scrapTargetId.value = serialId
  showScrapDialog.value = true
}

function openForceComplete(serialId: string) {
  forceCompleteTargetId.value = serialId
  showForceCompleteDialog.value = true
}

onMounted(() => { selectAll() })
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="text-sm font-semibold text-(--ui-text-highlighted)">{{ job.stepName }}</div>
        <div class="text-xs text-(--ui-text-muted)">
          {{ job.jobName }} · {{ job.pathName }}
          <span v-if="job.stepLocation"> · 📍 {{ job.stepLocation }}</span>
        </div>
      </div>
      <UButton size="xs" variant="ghost" icon="i-lucide-x" aria-label="Close panel" @click="emit('cancel')" />
    </div>

    <!-- Destination info -->
    <div class="text-xs px-2 py-1.5 rounded-md bg-(--ui-bg-elevated)/50 border border-(--ui-border)">
      <span class="text-(--ui-text-muted)">Advancing to:</span>
      <span class="ml-1 font-medium text-(--ui-text-highlighted)">{{ formatDestination() }}</span>
    </div>

    <!-- Serial selection -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">
          Serial Numbers ({{ selectedSerials.size }}/{{ job.partCount }})
        </span>
        <div class="flex gap-1">
          <UButton size="xs" variant="ghost" label="All" @click="selectAll" />
          <UButton size="xs" variant="ghost" label="None" @click="selectNone" />
        </div>
      </div>
      <div class="max-h-40 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <div
          v-for="serialId in job.serialIds"
          :key="serialId"
          class="flex items-center justify-between px-2 py-1.5 hover:bg-(--ui-bg-elevated)/30"
        >
          <label class="flex items-center gap-2 cursor-pointer text-xs flex-1">
            <input type="checkbox" :checked="selectedSerials.has(serialId)" class="rounded" @change="toggleSerial(serialId)">
            <span class="font-mono">{{ serialId }}</span>
          </label>
          <div class="flex items-center gap-0.5 shrink-0">
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" title="Scrap" @click="openScrap(serialId)" />
            <UButton size="xs" variant="ghost" color="warning" icon="i-lucide-shield-check" title="Force Complete" @click="openForceComplete(serialId)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Quantity input -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Quantity</label>
      <div class="flex items-center gap-2">
        <UInput v-model.number="quantity" type="number" :min="1" :max="job.partCount" size="sm" class="w-24" @blur="selectByQuantity" />
        <span class="text-xs text-(--ui-text-muted)">of {{ job.partCount }} available</span>
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
        :disabled="!!validationError || selectedSerials.size === 0"
        size="sm" color="primary" label="Advance" icon="i-lucide-arrow-right"
        @click="handleAdvance"
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
      :serial-id="scrapTargetId"
      :model-value="showScrapDialog"
      @update:model-value="showScrapDialog = $event"
      @scrapped="scrapTargetId = null"
    />

    <!-- Force complete dialog -->
    <ForceCompleteDialog
      v-if="forceCompleteTargetId"
      :serial-id="forceCompleteTargetId"
      :incomplete-steps="[]"
      :model-value="showForceCompleteDialog"
      @update:model-value="showForceCompleteDialog = $event"
      @completed="forceCompleteTargetId = null"
    />
  </div>
</template>
