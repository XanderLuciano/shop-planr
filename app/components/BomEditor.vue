<script setup lang="ts">
import type { BOM, Job, Tag } from '~/types/domain'

interface EntryDraft {
  jobId: string
  requiredQuantity: number
}

type BomSavePayload = { name: string, entries: EntryDraft[] }

const props = defineProps<{
  bom?: BOM
  jobs: readonly (Job & { tags: readonly Tag[] })[]
  prefillJobIds?: string[]
}>()

const emit = defineEmits<{
  save: [payload: BomSavePayload]
  cancel: []
}>()

const name = ref(props.bom?.name ?? '')
const entries = ref<EntryDraft[]>(
  props.bom?.entries.length
    ? props.bom.entries.map(e => ({
        jobId: e.jobId,
        requiredQuantity: e.requiredQuantity,
      }))
    : props.prefillJobIds?.length
      ? props.prefillJobIds.map(id => ({ jobId: id, requiredQuantity: 1 }))
      : [{ jobId: '', requiredQuantity: 1 }],
)
const formError = ref('')

const usedJobIds = computed(() => new Set(entries.value.map(e => e.jobId).filter(Boolean)))

function jobOptions(currentJobId: string) {
  return props.jobs
    .filter(j => j.id === currentJobId || !usedJobIds.value.has(j.id))
    .map(j => ({ label: j.name, value: j.id }))
}

function addEntry() {
  entries.value.push({ jobId: '', requiredQuantity: 1 })
}

function removeEntry(index: number) {
  if (entries.value.length <= 1) return
  entries.value.splice(index, 1)
}

function onSubmit() {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'BOM name is required'
    return
  }
  const valid = entries.value.filter(e => e.jobId)
  if (!valid.length) {
    formError.value = 'At least one job entry is required'
    return
  }
  emit('save', {
    name: name.value.trim(),
    entries: valid.map(e => ({
      jobId: e.jobId,
      requiredQuantity: e.requiredQuantity,
    })),
  })
}
</script>

<template>
  <div class="space-y-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
    <div class="text-xs font-semibold text-(--ui-text-highlighted)">
      {{ bom ? 'Edit BOM' : 'New BOM' }}
    </div>

    <div>
      <label class="block text-xs text-(--ui-text-muted) mb-0.5">BOM Name</label>
      <UInput
        v-model="name"
        size="sm"
        placeholder="e.g. Main Assembly"
        class="max-w-sm"
      />
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs font-medium text-(--ui-text-muted)">Entries</label>
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          label="Add Entry"
          @click="addEntry"
        />
      </div>
      <div class="space-y-2">
        <div
          v-for="(entry, i) in entries"
          :key="i"
          class="flex items-end gap-2 p-2 border border-(--ui-border-muted) rounded"
        >
          <div class="flex-1">
            <label class="block text-xs text-(--ui-text-muted) mb-0.5">Job</label>
            <USelectMenu
              v-model="entry.jobId"
              :items="jobOptions(entry.jobId)"
              size="sm"
              placeholder="Select a job..."
              value-key="value"
            />
          </div>
          <div class="w-24">
            <label class="block text-xs text-(--ui-text-muted) mb-0.5">Qty</label>
            <UInput
              v-model.number="entry.requiredQuantity"
              size="sm"
              type="number"
              :min="1"
              placeholder="1"
            />
          </div>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="error"
            :disabled="entries.length <= 1"
            @click="removeEntry(i)"
          />
        </div>
      </div>
    </div>

    <p
      v-if="formError"
      class="text-xs text-red-500"
    >
      {{ formError }}
    </p>

    <div class="flex gap-2 justify-end">
      <UButton
        variant="ghost"
        size="xs"
        label="Cancel"
        @click="emit('cancel')"
      />
      <UButton
        size="xs"
        :label="bom ? 'Update BOM' : 'Create BOM'"
        @click="onSubmit"
      />
    </div>
  </div>
</template>
