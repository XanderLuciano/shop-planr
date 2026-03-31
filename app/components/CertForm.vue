<script setup lang="ts">
import type { Certificate } from '~/types/domain'

const props = defineProps<{
  cert?: Certificate
}>()

const emit = defineEmits<{
  submit: [data: { type: 'material' | 'process', name: string, metadata?: Record<string, unknown> }]
}>()

const certType = ref<'material' | 'process'>(props.cert?.type ?? 'material')
const certName = ref(props.cert?.name ?? '')
const metadataEntries = ref<{ key: string, value: string }[]>(
  props.cert?.metadata
    ? Object.entries(props.cert.metadata).map(([key, value]) => ({ key, value: String(value) }))
    : []
)

const typeOptions = [
  { label: 'Material', value: 'material' },
  { label: 'Process', value: 'process' }
]

function addMetadataEntry() {
  metadataEntries.value.push({ key: '', value: '' })
}

function removeMetadataEntry(index: number) {
  metadataEntries.value.splice(index, 1)
}

function onSubmit() {
  if (!certName.value.trim()) return

  const validEntries = metadataEntries.value.filter(e => e.key.trim())
  const metadata: Record<string, unknown> = {}
  for (const entry of validEntries) {
    metadata[entry.key.trim()] = entry.value.trim()
  }

  emit('submit', {
    type: certType.value,
    name: certName.value.trim(),
    metadata: validEntries.length ? metadata : undefined
  })
}
</script>

<template>
  <form
    class="space-y-2"
    @submit.prevent="onSubmit"
  >
    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Type</label>
        <USelect
          v-model="certType"
          :items="typeOptions"
          size="sm"
          value-key="value"
        />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Name</label>
        <UInput
          v-model="certName"
          size="sm"
          placeholder="Certificate name"
        />
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs font-medium text-(--ui-text-muted)">Metadata (optional)</label>
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          label="Add Field"
          @click="addMetadataEntry"
        />
      </div>
      <div
        v-if="metadataEntries.length"
        class="space-y-1"
      >
        <div
          v-for="(entry, i) in metadataEntries"
          :key="i"
          class="flex items-center gap-1.5"
        >
          <UInput
            v-model="entry.key"
            size="sm"
            placeholder="Key"
            class="flex-1"
          />
          <UInput
            v-model="entry.value"
            size="sm"
            placeholder="Value"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="error"
            @click="removeMetadataEntry(i)"
          />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <UButton
        type="submit"
        size="xs"
        label="Save Certificate"
        :disabled="!certName.trim()"
      />
    </div>
  </form>
</template>
