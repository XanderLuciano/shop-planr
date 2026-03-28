<script setup lang="ts">
import type { WorkQueueJob } from '~/server/types/computed'

const props = defineProps<{
  job: WorkQueueJob
  loading: boolean
}>()

const emit = defineEmits<{
  advance: [payload: { partIds: string[], note?: string }]
  cancel: []
  created: [count: number]
}>()

const { batchCreateParts } = useParts()
const { operatorId } = useOperatorIdentity()

const quantity = ref<number>(1)
const creating = ref(false)
const selectedParts = ref<Set<string>>(new Set())
const note = ref('')
const validationError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

watch(quantity, () => { validateQuantity() })

function validateQuantity() {
  if (quantity.value < 1) {
    validationError.value = 'Quantity must be at least 1'
  } else {
    validationError.value = null
  }
}

function formatDestination(): string {
  if (props.job.isFinalStep) return 'Completed'
  if (!props.job.nextStepName) return '—'
  return props.job.nextStepLocation
    ? `${props.job.nextStepName} → ${props.job.nextStepLocation}`
    : props.job.nextStepName
}

function togglePart(partId: string) {
  const next = new Set(selectedParts.value)
  if (next.has(partId)) next.delete(partId)
  else next.add(partId)
  selectedParts.value = next
}

function selectAll() {
  selectedParts.value = new Set(props.job.partIds)
}

function selectNone() {
  selectedParts.value = new Set()
}

function clearMessages() {
  successMessage.value = null
  errorMessage.value = null
}

async function handleCreate() {
  if (validationError.value || !operatorId.value) return
  clearMessages()
  creating.value = true
  try {
    const created = await batchCreateParts({
      jobId: props.job.jobId,
      pathId: props.job.pathId,
      quantity: quantity.value,
      userId: operatorId.value,
    })
    successMessage.value = `${created.length} part${created.length !== 1 ? 's' : ''} created`
    emit('created', created.length)
  } catch (e: any) {
    errorMessage.value = e?.data?.message ?? e?.message ?? 'Failed to create parts'
  } finally {
    creating.value = false
  }
}

async function handleCreateAndAdvance() {
  if (validationError.value || !operatorId.value) return
  clearMessages()
  creating.value = true
  try {
    const created = await batchCreateParts({
      jobId: props.job.jobId,
      pathId: props.job.pathId,
      quantity: quantity.value,
      userId: operatorId.value,
    })
    const createdIds = created.map(s => s.id)
    emit('created', created.length)
    emit('advance', { partIds: createdIds, note: note.value.trim() || undefined })
  } catch (e: any) {
    errorMessage.value = e?.data?.message ?? e?.message ?? 'Failed to create parts'
  } finally {
    creating.value = false
  }
}

function handleAdvance() {
  if (selectedParts.value.size === 0) return
  const ids = props.job.partIds.filter((id: string) => selectedParts.value.has(id))
  const trimmedNote = note.value.trim()
  emit('advance', { partIds: ids, note: trimmedNote || undefined })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Destination info -->
    <div class="text-xs px-2 py-1.5 rounded-md bg-(--ui-bg-elevated)/50 border border-(--ui-border)">
      <span class="text-(--ui-text-muted)">Advancing to:</span>
      <span class="ml-1 font-medium text-(--ui-text-highlighted)">{{ formatDestination() }}</span>
    </div>

    <!-- Creation form -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Create Parts</label>
      <div class="flex items-center gap-2">
        <UInput
          v-model.number="quantity"
          type="number"
          :min="1"
          size="sm"
          class="w-24"
          :disabled="creating"
        />
        <UButton
          size="sm"
          color="primary"
          label="Create"
          icon="i-lucide-plus"
          :loading="creating"
          :disabled="creating || !!validationError"
          @click="handleCreate"
        />
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          label="Create & Advance"
          icon="i-lucide-arrow-right"
          :loading="creating"
          :disabled="creating || !!validationError"
          @click="handleCreateAndAdvance"
        />
      </div>
      <p v-if="validationError" class="text-xs text-(--ui-error) mt-1">{{ validationError }}</p>
    </div>

    <!-- Success message -->
    <div v-if="successMessage" class="text-xs text-(--ui-success) bg-(--ui-success)/10 px-2 py-1.5 rounded-md">
      {{ successMessage }}
    </div>

    <!-- Error message -->
    <div v-if="errorMessage" class="text-xs text-(--ui-error) bg-(--ui-error)/10 px-2 py-1.5 rounded-md">
      {{ errorMessage }}
    </div>

    <!-- Accumulated parts list -->
    <div v-if="job.partIds.length > 0">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold text-(--ui-text-highlighted)">
          Accumulated Parts ({{ selectedParts.size }}/{{ job.partIds.length }})
        </span>
        <div class="flex gap-1">
          <UButton size="xs" variant="ghost" label="All" @click="selectAll" />
          <UButton size="xs" variant="ghost" label="None" @click="selectNone" />
        </div>
      </div>
      <div class="max-h-40 overflow-y-auto border border-(--ui-border) rounded-md divide-y divide-(--ui-border)">
        <label
          v-for="partId in job.partIds"
          :key="partId"
          class="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-(--ui-bg-elevated)/30 text-xs"
        >
          <input type="checkbox" :checked="selectedParts.has(partId)" class="rounded" @change="togglePart(partId)">
          <span class="font-mono">{{ partId }}</span>
        </label>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-xs text-(--ui-text-muted) text-center py-4 border border-(--ui-border) rounded-md">
      No parts created yet. Use the form above to create parts.
    </div>

    <!-- Optional note -->
    <div>
      <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Note (optional)</label>
      <UTextarea v-model="note" placeholder="Add observations or issues..." :maxlength="1000" :rows="2" size="sm" />
      <div class="text-xs text-(--ui-text-muted) text-right mt-0.5">{{ note.length }}/1000</div>
    </div>

    <!-- Advance action -->
    <div class="flex items-center gap-2 pt-1">
      <UButton
        :loading="loading"
        :disabled="loading || selectedParts.size === 0"
        size="sm"
        color="primary"
        :label="`Advance ${selectedParts.size} selected`"
        icon="i-lucide-arrow-right"
        @click="handleAdvance"
      />
      <UButton size="sm" variant="ghost" label="Cancel" @click="emit('cancel')" />
    </div>
  </div>
</template>
