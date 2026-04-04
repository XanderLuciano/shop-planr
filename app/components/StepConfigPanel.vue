<script setup lang="ts">
const props = defineProps<{
  stepId: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}>()

const emit = defineEmits<{
  updated: []
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const localOptional = ref(props.optional)
const localDependencyType = ref(props.dependencyType)

watch(() => props.optional, (v) => { localOptional.value = v })
watch(() => props.dependencyType, (v) => { localDependencyType.value = v })

const dependencyOptions = [
  { label: '🔒 Physical', value: 'physical' },
  { label: '→ Preferred', value: 'preferred' },
  { label: '🚧 Completion Gate', value: 'completion_gate' },
]

const depIcon = computed(() => {
  switch (localDependencyType.value) {
    case 'physical': return 'i-lucide-lock'
    case 'preferred': return 'i-lucide-arrow-right'
    case 'completion_gate': return 'i-lucide-shield-check'
    default: return 'i-lucide-arrow-right'
  }
})

async function saveChanges() {
  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/steps/${encodeURIComponent(props.stepId)}/config`, {
      method: 'PATCH',
      body: {
        optional: localOptional.value,
        dependencyType: localDependencyType.value,
      },
    })
    emit('updated')
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to update step config'
  } finally {
    loading.value = false
  }
}

const hasChanges = computed(() =>
  localOptional.value !== props.optional || localDependencyType.value !== props.dependencyType,
)
</script>

<template>
  <div class="space-y-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-semibold text-(--ui-text-highlighted) flex items-center gap-1.5">
        <UIcon
          :name="depIcon"
          class="size-4"
        />
        Step Configuration
      </h4>
    </div>

    <div class="flex items-center gap-3">
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input
          v-model="localOptional"
          type="checkbox"
          class="rounded"
        >
        <span class="text-(--ui-text-highlighted)">Optional</span>
      </label>
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Dependency Type</label>
      <USelect
        v-model="localDependencyType"
        :items="dependencyOptions"
        value-key="value"
        label-key="label"
        size="sm"
        class="w-full"
      />
    </div>

    <p
      v-if="error"
      class="text-xs text-(--ui-error)"
    >
      {{ error }}
    </p>

    <UButton
      v-if="hasChanges"
      size="sm"
      label="Save"
      :loading="loading"
      @click="saveChanges"
    />
  </div>
</template>
