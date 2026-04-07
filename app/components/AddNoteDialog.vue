<script setup lang="ts">
import type { StepNote } from '~/types/domain'

const props = defineProps<{
  modelValue: boolean
  partIds: string[]
  jobId: string
  pathId: string
  stepId: string
  stepName: string
  preSelectedPartIds?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [note: StepNote]
}>()

const { createNote } = useNotes()
const { operatorId } = useOperatorIdentity()
const toast = useToast()

const noteText = ref('')
const selectedPartIds = ref<Set<string>>(new Set())
const saving = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const canSave = computed(() => {
  return (
    noteText.value.trim().length > 0
    && selectedPartIds.value.size > 0
    && !!operatorId.value
    && !saving.value
  )
})

watch(() => props.modelValue, (open) => {
  if (open) {
    noteText.value = ''
    if (props.preSelectedPartIds?.length) {
      selectedPartIds.value = new Set(props.preSelectedPartIds)
    } else {
      selectedPartIds.value = new Set()
    }
  }
})

function togglePart(partId: string) {
  const next = new Set(selectedPartIds.value)
  if (next.has(partId)) next.delete(partId)
  else next.add(partId)
  selectedPartIds.value = next
}

function selectAll() {
  selectedPartIds.value = new Set(props.partIds)
}

function selectNone() {
  selectedPartIds.value = new Set()
}

async function handleSave() {
  const trimmedText = noteText.value.trim()
  if (!trimmedText || selectedPartIds.value.size === 0 || !operatorId.value) return

  saving.value = true
  try {
    const note = await createNote({
      jobId: props.jobId,
      pathId: props.pathId,
      stepId: props.stepId,
      partIds: Array.from(selectedPartIds.value),
      text: trimmedText,
      userId: operatorId.value,
    })

    emit('saved', note)
    emit('update:modelValue', false)

    toast.add({
      title: 'Note added',
      description: `Note added to ${selectedPartIds.value.size} part${selectedPartIds.value.size !== 1 ? 's' : ''}`,
      color: 'success',
    })
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    toast.add({
      title: 'Failed to add note',
      description: err?.data?.message ?? err?.message ?? 'An error occurred',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  noteText.value = ''
  selectedPartIds.value = new Set()
  isOpen.value = false
}
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
          Add Note
        </h3>
        <p class="text-sm text-(--ui-text-muted)">
          Add a note to selected parts at
          <span class="font-medium text-(--ui-text-highlighted)">{{ stepName }}</span>
        </p>

        <!-- Part selection -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-(--ui-text-highlighted)">
              Parts ({{ selectedPartIds.size }}/{{ partIds.length }})
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
            <label
              v-for="partId in partIds"
              :key="partId"
              class="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-(--ui-bg-elevated)/30"
            >
              <input
                type="checkbox"
                :checked="selectedPartIds.has(partId)"
                class="rounded"
                @change="togglePart(partId)"
              >
              <span class="font-mono">{{ partId }}</span>
            </label>
          </div>
        </div>

        <!-- Note text -->
        <div>
          <label class="text-xs font-semibold text-(--ui-text-highlighted) block mb-1">Note</label>
          <UTextarea
            v-model="noteText"
            placeholder="Enter note text..."
            :maxlength="1000"
            :rows="3"
            size="sm"
          />
          <div class="text-xs text-(--ui-text-muted) text-right mt-0.5">
            {{ noteText.length }}/1000
          </div>
        </div>

        <!-- No operator warning -->
        <p
          v-if="!operatorId"
          class="text-xs text-(--ui-error)"
        >
          No operator selected — select an operator to save notes.
        </p>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <UButton
            variant="ghost"
            label="Cancel"
            @click="handleCancel"
          />
          <UButton
            color="primary"
            label="Save Note"
            icon="i-lucide-save"
            :loading="saving"
            :disabled="!canSave"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
