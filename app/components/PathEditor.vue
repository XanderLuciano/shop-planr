<script setup lang="ts">
import type { Path } from '~/server/types/domain'

const props = defineProps<{
  jobId: string
  path?: Path
}>()

const emit = defineEmits<{
  save: [path: Path]
  cancel: []
}>()

const { createPath, updatePath } = usePaths()

interface StepDraft {
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

const pathName = ref(props.path?.name ?? '')
const goalQuantity = ref(props.path?.goalQuantity ?? 1)
const steps = ref<StepDraft[]>(
  props.path?.steps.map(s => ({
    name: s.name,
    location: s.location ?? '',
    optional: s.optional ?? false,
    dependencyType: s.dependencyType ?? 'preferred',
  })) ?? [{ name: '', location: '', optional: false, dependencyType: 'preferred' }]
)
const saving = ref(false)
const error = ref('')

const dependencyOptions = [
  { label: 'Physical', value: 'physical' },
  { label: 'Preferred', value: 'preferred' },
  { label: 'Completion Gate', value: 'completion_gate' },
]

function addStep() {
  steps.value.push({ name: '', location: '', optional: false, dependencyType: 'preferred' })
}

function removeStep(index: number) {
  if (steps.value.length <= 1) return
  steps.value.splice(index, 1)
}

function moveStep(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= steps.value.length) return
  const temp = steps.value[index]!
  steps.value[index] = steps.value[target]!
  steps.value[target] = temp
}

async function onSave() {
  error.value = ''
  if (!pathName.value.trim()) {
    error.value = 'Path name is required'
    return
  }
  if (goalQuantity.value < 1) {
    error.value = 'Goal quantity must be at least 1'
    return
  }
  const validSteps = steps.value.filter(s => s.name.trim())
  if (!validSteps.length) {
    error.value = 'At least one step with a name is required'
    return
  }

  saving.value = true
  try {
    const stepData = validSteps.map(s => ({
      name: s.name.trim(),
      location: s.location.trim() || undefined,
      optional: s.optional,
      dependencyType: s.dependencyType,
    }))

    let result: Path
    if (props.path) {
      result = await updatePath(props.path.id, {
        name: pathName.value.trim(),
        goalQuantity: goalQuantity.value,
        steps: stepData
      })
    } else {
      result = await createPath({
        jobId: props.jobId,
        name: pathName.value.trim(),
        goalQuantity: goalQuantity.value,
        steps: stepData
      })
    }
    emit('save', result)
  } catch (e: any) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to save path'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50">
    <div class="text-xs font-semibold text-(--ui-text-highlighted)">
      {{ path ? 'Edit Path' : 'New Path' }}
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Path Name</label>
        <UInput v-model="pathName" size="sm" placeholder="e.g. Standard Route" class="w-full" />
      </div>
      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Goal Qty</label>
        <UInput v-model.number="goalQuantity" type="number" size="sm" :min="1" class="w-full" />
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="text-xs font-medium text-(--ui-text-muted)">Process Steps</label>
        <UButton icon="i-lucide-plus" size="xs" variant="ghost" label="Add Step" @click="addStep" />
      </div>
      <div class="space-y-2">
        <div v-for="(step, i) in steps" :key="i" class="flex items-center gap-2 border border-(--ui-border) rounded-md p-2">
          <span class="text-xs text-(--ui-text-muted) w-5 shrink-0 text-right">{{ i + 1 }}.</span>
          <ProcessLocationDropdown v-model="step.name" type="process" class="flex-1" />
          <ProcessLocationDropdown v-model="step.location" type="location" class="flex-1" />
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
          <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" :disabled="i === 0" @click="moveStep(i, -1)" />
          <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" :disabled="i === steps.length - 1" @click="moveStep(i, 1)" />
          <UButton icon="i-lucide-x" size="xs" variant="ghost" color="error" :disabled="steps.length <= 1" @click="removeStep(i)" />
        </div>
      </div>
    </div>

    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

    <div class="flex gap-2 justify-end">
      <UButton variant="ghost" size="xs" label="Cancel" @click="emit('cancel')" />
      <UButton size="xs" :label="path ? 'Update Path' : 'Create Path'" :loading="saving" @click="onSave" />
    </div>
  </div>
</template>
