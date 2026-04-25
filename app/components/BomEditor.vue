<script setup lang="ts">
import type { BOM, Job, Tag } from '~/types/domain'

interface EntryDraft {
  _key: number
  jobId: string
  requiredQuantity: number
}

let nextKey = 0

type BomSavePayload = { name: string, entries: { jobId: string, requiredQuantity: number }[] }

const props = defineProps<{
  bom?: BOM
  jobs: readonly (Job & { tags: readonly Tag[] })[]
  prefillJobIds?: string[]
  prefillName?: string
}>()

const emit = defineEmits<{
  save: [payload: BomSavePayload]
  cancel: []
}>()

const name = ref(props.bom?.name ?? props.prefillName ?? '')
const entries = ref<EntryDraft[]>(
  props.bom?.entries.length
    ? props.bom.entries.map(e => ({
        _key: nextKey++,
        jobId: e.jobId,
        requiredQuantity: e.requiredQuantity,
      }))
    : props.prefillJobIds?.length
      ? props.prefillJobIds.map(id => ({ _key: nextKey++, jobId: id, requiredQuantity: 1 }))
      : [{ _key: nextKey++, jobId: '', requiredQuantity: 1 }],
)
const formError = ref('')

const usedJobIds = computed(() => new Set(entries.value.map(e => e.jobId).filter(Boolean)))

const availableTags = computed(() => {
  const tagMap = new Map<string, Tag>()
  for (const job of props.jobs) {
    for (const tag of job.tags) {
      if (!tagMap.has(tag.id)) tagMap.set(tag.id, tag)
    }
  }
  return [...tagMap.values()]
})

function addFromTag(tag: Tag) {
  const jobIds = props.jobs
    .filter(j => j.tags.some(t => t.id === tag.id))
    .map(j => j.id)
    .filter(id => !usedJobIds.value.has(id))

  if (!jobIds.length) return

  // Remove any empty placeholder rows first
  entries.value = entries.value.filter(e => e.jobId)

  for (const id of jobIds) {
    entries.value.push({ _key: nextKey++, jobId: id, requiredQuantity: 1 })
  }

  // Ensure at least one row if somehow everything was filtered
  if (!entries.value.length) {
    entries.value.push({ _key: nextKey++, jobId: '', requiredQuantity: 1 })
  }
}

function jobOptions(currentJobId: string) {
  return props.jobs
    .filter(j => j.id === currentJobId || !usedJobIds.value.has(j.id))
    .map(j => ({ label: j.name, value: j.id }))
}

function addEntry() {
  entries.value.push({ _key: nextKey++, jobId: '', requiredQuantity: 1 })
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
  for (const e of valid) {
    if (!Number.isFinite(e.requiredQuantity) || !Number.isInteger(e.requiredQuantity) || e.requiredQuantity < 1) {
      const job = props.jobs.find(j => j.id === e.jobId)
      formError.value = `Required quantity must be at least 1 for "${job?.name ?? e.jobId}"`
      return
    }
  }
  emit('save', {
    name: name.value.trim(),
    entries: valid.map(e => ({
      jobId: e.jobId,
      requiredQuantity: e.requiredQuantity,
    })),
  })
}

defineExpose({ submit: onSubmit })
</script>

<template>
  <div class="space-y-3">
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
        <UDropdownMenu
          v-if="availableTags.length"
          :modal="false"
          :items="[[{ label: 'Add jobs from tag', type: 'label', class: 'text-[10px] text-(--ui-text-dimmed) font-normal py-0' }], availableTags.map(t => ({ label: t.name, onSelect: () => addFromTag(t) }))]"
        >
          <UButton
            icon="i-lucide-tag"
            size="xs"
            variant="ghost"
            label="From Tag"
          />
        </UDropdownMenu>
      </div>
      <div class="space-y-2">
        <div
          v-for="(entry, i) in entries"
          :key="entry._key"
          class="flex items-center gap-2"
        >
          <div class="flex-[3] min-w-0">
            <USelectMenu
              v-model="entry.jobId"
              :items="jobOptions(entry.jobId)"
              size="sm"
              placeholder="Select a job..."
              value-key="value"
              class="w-full"
            />
          </div>
          <div class="w-16 shrink-0">
            <UInput
              v-model.number="entry.requiredQuantity"
              size="sm"
              type="number"
              :min="1"
              placeholder="Qty"
            />
          </div>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="error"
            class="shrink-0"
            :disabled="entries.length <= 1"
            @click="removeEntry(i)"
          />
        </div>
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          label="Add Entry"
          class="w-full"
          @click="addEntry"
        />
      </div>
    </div>

    <p
      v-if="formError"
      class="text-xs text-red-500"
    >
      {{ formError }}
    </p>
  </div>
</template>
