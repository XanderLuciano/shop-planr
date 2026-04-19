<script setup lang="ts">
import type { AdvancementMode } from '~/types/domain'

const props = defineProps<{
  pathId: string
  currentMode: AdvancementMode
}>()

const emit = defineEmits<{
  updated: [mode: AdvancementMode]
}>()

const loading = ref(false)
const error = ref<string | null>(null)
const $api = useAuthFetch()

const selected = ref(props.currentMode)

watch(() => props.currentMode, (v) => {
  selected.value = v
})

async function handleChange(value: string) {
  const mode = value as AdvancementMode
  loading.value = true
  error.value = null
  try {
    await $api(`/api/paths/${encodeURIComponent(props.pathId)}/advancement-mode`, {
      method: 'PATCH',
      body: { advancementMode: mode },
    })
    selected.value = mode
    emit('updated', mode)
  } catch (e) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to update advancement mode'
    selected.value = props.currentMode
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-xs font-medium text-(--ui-text-muted) shrink-0">Advancement:</label>
    <USelect
      :model-value="selected"
      :items="ADVANCEMENT_MODE_OPTIONS"
      value-key="value"
      label-key="label"
      :disabled="loading"
      size="xs"
      class="w-36"
      @update:model-value="handleChange"
    />
    <p
      v-if="error"
      class="text-xs text-(--ui-error)"
    >
      {{ error }}
    </p>
  </div>
</template>
