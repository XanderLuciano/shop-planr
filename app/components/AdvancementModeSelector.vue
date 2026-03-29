<script setup lang="ts">
const props = defineProps<{
  pathId: string
  currentMode: 'strict' | 'flexible' | 'per_step'
}>()

const emit = defineEmits<{
  updated: [mode: 'strict' | 'flexible' | 'per_step']
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const modeOptions = [
  { label: 'Strict', value: 'strict', description: 'Sequential only — N → N+1' },
  { label: 'Flexible', value: 'flexible', description: 'Any future step with warnings' },
  { label: 'Per Step', value: 'per_step', description: 'Based on step dependency types' },
]

const selected = ref(props.currentMode)

watch(
  () => props.currentMode,
  (v) => {
    selected.value = v
  }
)

async function handleChange(value: string) {
  const mode = value as 'strict' | 'flexible' | 'per_step'
  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/paths/${encodeURIComponent(props.pathId)}/advancement-mode`, {
      method: 'PATCH',
      body: { advancementMode: mode },
    })
    selected.value = mode
    emit('updated', mode)
  } catch (e: any) {
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
      :items="modeOptions"
      value-key="value"
      label-key="label"
      :disabled="loading"
      size="xs"
      class="w-36"
      @update:model-value="handleChange"
    />
    <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>
  </div>
</template>
