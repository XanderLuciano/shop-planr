<script setup lang="ts">
import type { TemplateRoute } from '~/types/domain'

const props = defineProps<{
  template: TemplateRoute
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const loading = ref(false)
const error = ref<string | null>(null)

interface EditableStep {
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

const steps = ref<EditableStep[]>(
  props.template.steps.map((s): EditableStep => ({
    name: s.name,
    location: s.location ?? '',
    optional: s.optional,
    dependencyType: s.dependencyType,
  })),
)

const dependencyOptions = [
  { label: 'Physical', value: 'physical' },
  { label: 'Preferred', value: 'preferred' },
  { label: 'Completion Gate', value: 'completion_gate' },
]

function addStep() {
  steps.value.push({ name: '', location: '', optional: false, dependencyType: 'preferred' })
}

function removeStep(index: number) {
  steps.value.splice(index, 1)
}

function moveStep(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= steps.value.length) return
  const temp = steps.value[index]!
  steps.value[index] = steps.value[target]!
  steps.value[target] = temp
}

async function handleSave() {
  error.value = null
  const validSteps = steps.value.filter(s => s.name.trim())
  if (!validSteps.length) {
    error.value = 'At least one step is required'
    return
  }

  loading.value = true
  try {
    await $fetch(`/api/templates/${encodeURIComponent(props.template.id)}`, {
      method: 'PUT',
      body: {
        name: props.template.name,
        steps: validSteps.map((s, i) => ({
          name: s.name.trim(),
          location: s.location.trim() || undefined,
          order: i,
          optional: s.optional,
          dependencyType: s.dependencyType,
        })),
      },
    })
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to update template'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-semibold text-(--ui-text-highlighted)">
      Edit Template: {{ template.name }}
    </h4>

    <div class="space-y-2">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="flex items-center gap-2 border border-(--ui-border) rounded-md p-2"
      >
        <span class="text-xs text-(--ui-text-muted) w-6 shrink-0">{{ i + 1 }}.</span>

        <ProcessLocationDropdown
          v-model="step.name"
          type="process"
          class="flex-1"
        />

        <ProcessLocationDropdown
          v-model="step.location"
          type="location"
          class="flex-1"
        />

        <label class="flex items-center gap-1 text-xs shrink-0">
          <input v-model="step.optional" type="checkbox" class="rounded">
          Opt
        </label>

        <USelect
          v-model="step.dependencyType"
          :items="dependencyOptions"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-32 shrink-0"
        />

        <div class="flex gap-0.5 shrink-0">
          <UButton size="xs" variant="ghost" icon="i-lucide-chevron-up" :disabled="i === 0" @click="moveStep(i, -1)" />
          <UButton size="xs" variant="ghost" icon="i-lucide-chevron-down" :disabled="i === steps.length - 1" @click="moveStep(i, 1)" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="removeStep(i)" />
        </div>
      </div>
    </div>

    <UButton size="sm" variant="soft" label="Add Step" icon="i-lucide-plus" @click="addStep" />

    <p v-if="error" class="text-xs text-(--ui-error)">{{ error }}</p>

    <div class="flex items-center gap-2">
      <UButton size="sm" label="Save" :loading="loading" @click="handleSave" />
      <UButton size="sm" variant="ghost" label="Cancel" @click="emit('cancel')" />
    </div>
  </div>
</template>
