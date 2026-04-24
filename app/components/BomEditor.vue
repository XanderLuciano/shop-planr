<script setup lang="ts">
import type { BOM, BomEntry, Job } from '~/types/domain'

type BomEntryPayload = Pick<BomEntry, 'partType' | 'requiredQuantityPerBuild'> & { contributingJobIds: string[] }
type BomSavePayload = { name: string, entries: BomEntryPayload[] }

interface EntryDraft {
  partType: string
  requiredQuantityPerBuild: number | null
  contributingJobIds: string[]
}

const props = defineProps<{
  bom?: BOM
  jobs: readonly Job[]
}>()

const emit = defineEmits<{
  save: [payload: BomSavePayload]
  cancel: []
}>()

const name = ref(props.bom?.name ?? '')
const entries = ref<EntryDraft[]>(
  props.bom?.entries.length
    ? props.bom.entries.map(e => ({
        partType: e.partType,
        requiredQuantityPerBuild: e.requiredQuantityPerBuild,
        contributingJobIds: [...e.contributingJobIds],
      }))
    : [{ partType: '', requiredQuantityPerBuild: null, contributingJobIds: [] }],
)
const formError = ref('')

function addEntry() {
  entries.value.push({ partType: '', requiredQuantityPerBuild: null, contributingJobIds: [] })
}

function removeEntry(index: number) {
  if (entries.value.length <= 1) return
  entries.value.splice(index, 1)
}

function jobOptions() {
  return props.jobs.map(j => ({ label: j.name, value: j.id }))
}

function onSubmit() {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'BOM name is required'
    return
  }
  const valid = entries.value.filter(e => e.partType.trim())
  if (!valid.length) {
    formError.value = 'At least one entry with a part type is required'
    return
  }
  for (const e of valid) {
    if (!e.requiredQuantityPerBuild || e.requiredQuantityPerBuild < 1) {
      formError.value = `Required quantity must be at least 1 for "${e.partType}"`
      return
    }
  }
  emit('save', {
    name: name.value.trim(),
    entries: valid.map(e => ({
      partType: e.partType.trim(),
      requiredQuantityPerBuild: e.requiredQuantityPerBuild!,
      contributingJobIds: e.contributingJobIds,
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
          class="p-2 border border-(--ui-border-muted) rounded space-y-1.5"
        >
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <label class="block text-xs text-(--ui-text-muted) mb-0.5">Part Type</label>
              <UInput
                v-model="entry.partType"
                size="sm"
                placeholder="e.g. Bracket"
              />
            </div>
            <div class="w-32">
              <label class="block text-xs text-(--ui-text-muted) mb-0.5">Qty / Build</label>
              <UInput
                v-model.number="entry.requiredQuantityPerBuild"
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
              class="mt-4"
              :disabled="entries.length <= 1"
              @click="removeEntry(i)"
            />
          </div>
          <div>
            <label class="block text-xs text-(--ui-text-muted) mb-0.5">Contributing Jobs</label>
            <USelectMenu
              v-model="entry.contributingJobIds"
              :items="jobOptions()"
              multiple
              size="sm"
              placeholder="Select jobs..."
              value-key="value"
            />
          </div>
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
