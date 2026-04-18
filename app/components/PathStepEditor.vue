<script setup lang="ts">
import type { StepDraft } from '~/composables/useJobForm'
import { createStepDraft } from '~/composables/useJobForm'

interface PathStepEditorProps {
  steps: StepDraft[]
  assigneeItems: { label: string, value: string }[]
  dependencyTypeOptions: { label: string, value: string }[]
  getFieldError?: (stepIndex: number, field: string) => string | undefined
  clearFieldError?: (stepIndex: number, field: string) => void
}

const props = defineProps<PathStepEditorProps>()

const emit = defineEmits<{
  'update:steps': [steps: StepDraft[]]
}>()

const { isMobile } = useMobileBreakpoint()

/** Map step.assignedTo ('' = unassigned) to USelect value (SELECT_UNASSIGNED sentinel) */
function assigneeToSelect(assignedTo: string): string {
  return assignedTo || SELECT_UNASSIGNED
}

/** Map USelect value back to step.assignedTo ('' for unassigned) */
function selectToAssignee(value: string): string {
  return value === SELECT_UNASSIGNED ? '' : value
}

function handleAddStep() {
  const newStep = createStepDraft()
  emit('update:steps', [...props.steps, newStep])
}

function handleRemoveStep(clientId: string) {
  if (props.steps.length <= 1) return
  emit('update:steps', props.steps.filter(s => s._clientId !== clientId))
}

function handleMoveStep(clientId: string, direction: -1 | 1) {
  const idx = props.steps.findIndex(s => s._clientId === clientId)
  const target = idx + direction
  if (target < 0 || target >= props.steps.length) return
  const copy = [...props.steps]
  ;[copy[idx], copy[target]] = [copy[target]!, copy[idx]!]
  emit('update:steps', copy)
}

function handleFieldChange(clientId: string, field: keyof StepDraft, value: unknown) {
  const copy = props.steps.map(s =>
    s._clientId === clientId ? { ...s, [field]: value } : s,
  )
  emit('update:steps', copy)
}

function onFieldInput(stepIndex: number, field: string, clientId: string, fieldKey: keyof StepDraft, value: unknown) {
  props.clearFieldError?.(stepIndex, field)
  handleFieldChange(clientId, fieldKey, value)
}

function getStepErrors(stepIndex: number): { field: string, message: string }[] {
  const errors: { field: string, message: string }[] = []
  if (!props.getFieldError) return errors
  for (const field of ['name', 'location', 'assignedTo', 'dependencyType']) {
    const msg = props.getFieldError(stepIndex, field)
    if (msg) errors.push({ field, message: msg })
  }
  return errors
}
</script>

<template>
  <div class="space-y-2">
    <!-- Desktop layout -->
    <template v-if="!isMobile">
      <!-- Column headers -->
      <div class="flex items-center gap-2 text-xs font-medium text-(--ui-text-muted) px-2">
        <span class="w-7 shrink-0 text-center">#</span>
        <span class="flex-1 min-w-0">Process</span>
        <span class="flex-1 min-w-0">Location</span>
        <span class="w-36 shrink-0">Assignee</span>
        <span class="w-8 shrink-0 text-center flex items-center justify-center gap-0.5">
          Opt
          <UTooltip
            text="When checked, this step can be skipped without blocking part completion."
            :ui="{ content: 'h-auto py-2 px-3', text: 'whitespace-normal' }"
          >
            <UIcon
              name="i-lucide-info"
              class="size-3 text-(--ui-text-dimmed) cursor-help"
            />
          </UTooltip>
        </span>
        <span class="w-36 shrink-0 flex items-center gap-0.5">
          Dependency
          <UTooltip :ui="{ content: 'h-auto py-2 px-3', text: 'whitespace-normal' }">
            <UIcon
              name="i-lucide-info"
              class="size-3 text-(--ui-text-dimmed) cursor-help"
            />
            <template #content>
              <div class="text-xs space-y-1 max-w-64">
                <p><span class="font-semibold">Physical:</span> Previous step must complete first.</p>
                <p><span class="font-semibold">Preferred:</span> Recommended order, but skippable in flexible mode.</p>
                <p><span class="font-semibold">Completion Gate:</span> Must complete before part finishes, but can be deferred.</p>
              </div>
            </template>
          </UTooltip>
        </span>
        <span class="w-14 shrink-0 text-center">↕</span>
        <span class="w-7 shrink-0 text-center">✕</span>
      </div>

      <!-- Step cards -->
      <div
        v-for="(step, stepIndex) in steps"
        :key="step._clientId"
        class="border border-(--ui-border) rounded-md p-2"
      >
        <!-- Zone 1: primary flex row -->
        <div class="flex items-center gap-2">
          <!-- Step badge -->
          <span class="w-7 shrink-0 text-center text-xs font-medium text-(--ui-text-muted)">
            {{ stepIndex + 1 }}
          </span>

          <!-- Process -->
          <div class="flex-1 min-w-0">
            <ProcessLocationDropdown
              :model-value="step.name"
              type="process"
              @update:model-value="(v: string) => onFieldInput(stepIndex, 'name', step._clientId, 'name', v)"
            />
          </div>

          <!-- Location -->
          <div class="flex-1 min-w-0">
            <ProcessLocationDropdown
              :model-value="step.location"
              type="location"
              @update:model-value="(v: string) => onFieldInput(stepIndex, 'location', step._clientId, 'location', v)"
            />
          </div>

          <!-- Assignee -->
          <USelect
            :model-value="assigneeToSelect(step.assignedTo)"
            :items="assigneeItems"
            size="sm"
            class="w-36 shrink-0"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'assignedTo', step._clientId, 'assignedTo', selectToAssignee(v))"
          />

          <!-- Optional checkbox -->
          <div class="w-8 shrink-0 flex items-center justify-center h-8">
            <input
              :checked="step.optional"
              type="checkbox"
              class="rounded"
              @change="onFieldInput(stepIndex, 'optional', step._clientId, 'optional', !step.optional)"
            >
          </div>

          <!-- Dependency type -->
          <USelect
            :model-value="step.dependencyType"
            :items="dependencyTypeOptions"
            size="sm"
            class="w-36 shrink-0"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'dependencyType', step._clientId, 'dependencyType', v)"
          />

          <!-- Move up/down -->
          <div class="w-14 shrink-0 flex items-center gap-0.5 justify-center">
            <UButton
              icon="i-lucide-chevron-up"
              variant="ghost"
              size="xs"
              :disabled="stepIndex === 0"
              @click="handleMoveStep(step._clientId, -1)"
            />
            <UButton
              icon="i-lucide-chevron-down"
              variant="ghost"
              size="xs"
              :disabled="stepIndex === steps.length - 1"
              @click="handleMoveStep(step._clientId, 1)"
            />
          </div>

          <!-- Remove -->
          <UButton
            icon="i-lucide-x"
            variant="ghost"
            color="error"
            size="xs"
            class="w-7 shrink-0"
            :disabled="steps.length <= 1"
            @click="handleRemoveStep(step._clientId)"
          />
        </div>

        <!-- Zone 2: validation errors -->
        <div
          v-if="getStepErrors(stepIndex).length"
          class="mt-1 pl-9 space-y-0.5"
        >
          <p
            v-for="err in getStepErrors(stepIndex)"
            :key="err.field"
            class="text-xs text-(--ui-error)"
          >
            {{ err.message }}
          </p>
        </div>
      </div>
    </template>

    <!-- Mobile layout -->
    <template v-if="isMobile">
      <div
        v-for="(step, stepIndex) in steps"
        :key="step._clientId"
        class="border border-(--ui-border) rounded-md p-3 space-y-2"
      >
        <!-- Card header: step number -->
        <div class="text-xs font-semibold text-(--ui-text-highlighted)">
          Step {{ stepIndex + 1 }}
        </div>

        <!-- Process -->
        <div>
          <label class="block text-xs text-(--ui-text-muted) mb-0.5">Process</label>
          <ProcessLocationDropdown
            :model-value="step.name"
            type="process"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'name', step._clientId, 'name', v)"
          />
          <p
            v-if="getFieldError?.(stepIndex, 'name')"
            class="text-xs text-(--ui-error) mt-0.5"
          >
            {{ getFieldError?.(stepIndex, 'name') }}
          </p>
        </div>

        <!-- Location -->
        <div>
          <label class="block text-xs text-(--ui-text-muted) mb-0.5">Location</label>
          <ProcessLocationDropdown
            :model-value="step.location"
            type="location"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'location', step._clientId, 'location', v)"
          />
          <p
            v-if="getFieldError?.(stepIndex, 'location')"
            class="text-xs text-(--ui-error) mt-0.5"
          >
            {{ getFieldError?.(stepIndex, 'location') }}
          </p>
        </div>

        <!-- Assignee -->
        <div>
          <label class="block text-xs text-(--ui-text-muted) mb-0.5">Assignee</label>
          <USelect
            :model-value="assigneeToSelect(step.assignedTo)"
            :items="assigneeItems"
            size="sm"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'assignedTo', step._clientId, 'assignedTo', selectToAssignee(v))"
          />
          <p
            v-if="getFieldError?.(stepIndex, 'assignedTo')"
            class="text-xs text-(--ui-error) mt-0.5"
          >
            {{ getFieldError?.(stepIndex, 'assignedTo') }}
          </p>
        </div>

        <!-- Optional + Dependency row -->
        <div class="flex items-center gap-2">
          <input
            :checked="step.optional"
            type="checkbox"
            class="rounded"
            @change="onFieldInput(stepIndex, 'optional', step._clientId, 'optional', !step.optional)"
          >
          <span class="text-xs text-(--ui-text-muted)">Optional</span>
          <USelect
            :model-value="step.dependencyType"
            :items="dependencyTypeOptions"
            size="sm"
            class="flex-1"
            @update:model-value="(v: string) => onFieldInput(stepIndex, 'dependencyType', step._clientId, 'dependencyType', v)"
          />
          <p
            v-if="getFieldError?.(stepIndex, 'dependencyType')"
            class="text-xs text-(--ui-error) mt-0.5"
          >
            {{ getFieldError?.(stepIndex, 'dependencyType') }}
          </p>
        </div>

        <!-- Footer: move + remove buttons -->
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-up"
            variant="ghost"
            size="xs"
            :disabled="stepIndex === 0"
            @click="handleMoveStep(step._clientId, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            variant="ghost"
            size="xs"
            :disabled="stepIndex === steps.length - 1"
            @click="handleMoveStep(step._clientId, 1)"
          />
          <UButton
            icon="i-lucide-x"
            label="Remove"
            variant="ghost"
            color="error"
            size="xs"
            :disabled="steps.length <= 1"
            @click="handleRemoveStep(step._clientId)"
          />
        </div>
      </div>
    </template>

    <!-- Add Step button -->
    <UButton
      icon="i-lucide-plus"
      label="Add Step"
      variant="outline"
      size="xs"
      :class="isMobile ? 'w-full' : ''"
      @click="handleAddStep"
    />
  </div>
</template>
