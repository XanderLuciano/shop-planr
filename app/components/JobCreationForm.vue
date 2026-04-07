<script setup lang="ts">
import { nextTick } from 'vue'
import type { Job, Path } from '~/types/domain'

const props = defineProps<{
  mode: 'create' | 'edit'
  existingJob?: Job & { paths: Path[] }
}>()

const emit = defineEmits<{
  saved: [jobId: string]
  cancel: []
}>()

const {
  jobDraft,
  pathDrafts,
  errors: _errors,
  submitting,
  submitError,
  addPath,
  removePath,
  addStep,
  removeStep,
  moveStep,
  applyTemplate,
  validate,
  submit,
  getFieldError,
  clearFieldError,
} = useJobForm(props.mode, props.existingJob)

const { templates, fetchTemplates } = useTemplates()
const { users: allUsers } = useAuth()

// Active users for assignee dropdown
const assigneeItems = computed(() => {
  const unassigned = { label: 'Unassigned', value: SELECT_UNASSIGNED }
  const userOptions = allUsers.value
    .filter(u => u.active)
    .map(u => ({ label: u.displayName, value: u.id }))
  return [unassigned, ...userOptions]
})

/** Map step.assignedTo ('' = unassigned) to USelect value (SELECT_UNASSIGNED sentinel) */
function assigneeToSelect(assignedTo: string): string {
  return assignedTo || SELECT_UNASSIGNED
}

/** Map USelect value back to step.assignedTo ('' for unassigned) */
function selectToAssignee(value: string): string {
  return value === SELECT_UNASSIGNED ? '' : value
}

// Per-path template selection state
const templateSelections = ref<Record<string, string>>({})

const advancementModeOptions = [
  { label: 'Strict', value: 'strict' },
  { label: 'Flexible', value: 'flexible' },
  { label: 'Per Step', value: 'per_step' },
]

const dependencyTypeOptions = [
  { label: 'Physical', value: 'physical' },
  { label: 'Preferred', value: 'preferred' },
  { label: 'Completion Gate', value: 'completion_gate' },
]

onMounted(() => {
  fetchTemplates()
})

function onTemplateSelect(pathClientId: string) {
  const templateId = templateSelections.value[pathClientId]
  if (!templateId) return
  const template = templates.value.find(t => t.id === templateId)
  if (template) {
    applyTemplate(pathClientId, template)
  }
  templateSelections.value[pathClientId] = SELECT_NONE
}

async function handleSubmit() {
  const result = validate()
  if (!result.valid) {
    await nextTick()
    const firstErrorEl = document.querySelector('[data-error]')
    if (firstErrorEl) {
      firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }

  try {
    const jobId = await submit()
    emit('saved', jobId)
  } catch {
    // submitError is already set by the composable
  }
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Submit error banner -->
    <UAlert
      v-if="submitError"
      color="error"
      variant="subtle"
      :title="'Submission Error'"
      :description="submitError"
      icon="i-lucide-alert-triangle"
    />

    <!-- Job-level fields -->
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
        Job Details
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-(--ui-text-highlighted) mb-1">Job Name</label>
          <UInput
            v-model="jobDraft.name"
            placeholder="Enter job name"
            :color="getFieldError('job.name') ? 'error' : undefined"
            @update:model-value="clearFieldError('job.name')"
          />
          <p
            v-if="getFieldError('job.name')"
            data-error
            class="text-xs text-(--ui-error) mt-1"
          >
            {{ getFieldError('job.name') }}
          </p>
        </div>
        <div>
          <label class="block text-sm font-medium text-(--ui-text-highlighted) mb-1">Goal Quantity</label>
          <UInput
            v-model.number="jobDraft.goalQuantity"
            type="number"
            :min="1"
            placeholder="1"
            :color="getFieldError('job.goalQuantity') ? 'error' : undefined"
            @update:model-value="clearFieldError('job.goalQuantity')"
          />
          <p
            v-if="getFieldError('job.goalQuantity')"
            data-error
            class="text-xs text-(--ui-error) mt-1"
          >
            {{ getFieldError('job.goalQuantity') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Paths section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-(--ui-text-highlighted) flex items-center gap-2">
          Paths
          <UBadge
            v-if="pathDrafts.length"
            variant="subtle"
            size="sm"
          >
            {{ pathDrafts.length }}
          </UBadge>
        </h3>
        <UButton
          icon="i-lucide-plus"
          label="Add Path"
          size="sm"
          @click="addPath"
        />
      </div>

      <p
        v-if="!pathDrafts.length"
        class="text-sm text-(--ui-text-muted)"
      >
        No paths defined yet. Click "Add Path" to add a routing path.
      </p>

      <!-- Path cards -->
      <div
        v-for="(path, pathIndex) in pathDrafts"
        :key="path._clientId"
        class="border border-(--ui-border) rounded-lg p-4 space-y-4"
      >
        <!-- Path header -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-(--ui-text-muted) mb-1">Path Name</label>
              <UInput
                v-model="path.name"
                placeholder="Path name"
                size="sm"
                :color="getFieldError(`paths[${pathIndex}].name`) ? 'error' : undefined"
                @update:model-value="clearFieldError(`paths[${pathIndex}].name`)"
              />
              <p
                v-if="getFieldError(`paths[${pathIndex}].name`)"
                data-error
                class="text-xs text-(--ui-error) mt-1"
              >
                {{ getFieldError(`paths[${pathIndex}].name`) }}
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-(--ui-text-muted) mb-1">Goal Quantity</label>
              <UInput
                v-model.number="path.goalQuantity"
                type="number"
                :min="1"
                size="sm"
                :color="getFieldError(`paths[${pathIndex}].goalQuantity`) ? 'error' : undefined"
                @update:model-value="clearFieldError(`paths[${pathIndex}].goalQuantity`)"
              />
              <p
                v-if="getFieldError(`paths[${pathIndex}].goalQuantity`)"
                data-error
                class="text-xs text-(--ui-error) mt-1"
              >
                {{ getFieldError(`paths[${pathIndex}].goalQuantity`) }}
              </p>
            </div>
            <div>
              <label class="block text-xs font-medium text-(--ui-text-muted) mb-1 flex items-center gap-1">
                Advancement Mode
                <UTooltip :ui="{ content: 'h-auto py-2 px-3', text: 'whitespace-normal' }">
                  <UIcon
                    name="i-lucide-info"
                    class="size-3.5 text-(--ui-text-dimmed) cursor-help"
                  />
                  <template #content>
                    <div class="text-xs space-y-1 max-w-64">
                      <p><span class="font-semibold">Strict:</span> Parts must follow steps in exact order.</p>
                      <p><span class="font-semibold">Flexible:</span> Parts can skip ahead, but skipped steps become deferred.</p>
                      <p><span class="font-semibold">Per Step:</span> Each step's dependency type controls advancement.</p>
                    </div>
                  </template>
                </UTooltip>
              </label>
              <USelect
                v-model="path.advancementMode"
                :items="advancementModeOptions"
                size="sm"
                class="w-full"
              />
            </div>
          </div>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="removePath(path._clientId)"
          />
        </div>

        <!-- Apply Template -->
        <div
          v-if="templates.length > 0"
          class="flex items-center gap-2"
        >
          <USelect
            :model-value="templateSelections[path._clientId] || SELECT_NONE"
            :items="[{ label: 'Apply Template...', value: SELECT_NONE, disabled: true }, ...templates.map(t => ({ label: `${t.name} (${t.steps.length} steps)`, value: t.id }))]"
            size="sm"
            class="w-64"
            @update:model-value="(v: string) => { if (v !== SELECT_NONE) { templateSelections[path._clientId] = v; onTemplateSelect(path._clientId) } }"
          />
        </div>

        <!-- Steps validation error -->
        <p
          v-if="getFieldError(`paths[${pathIndex}].steps`)"
          data-error
          class="text-xs text-(--ui-error)"
        >
          {{ getFieldError(`paths[${pathIndex}].steps`) }}
        </p>

        <!-- Step rows -->
        <div class="space-y-2">
          <div class="text-xs font-medium text-(--ui-text-muted) grid grid-cols-[2rem_1fr_1fr_1fr_5rem_9rem_4.5rem_2rem] gap-2 px-1">
            <span>#</span>
            <span>Process</span>
            <span>Location</span>
            <span>Assignee</span>
            <span class="flex items-center gap-0.5">
              Optional
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
            <span class="flex items-center gap-0.5">
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
            <span>Move</span>
            <span />
          </div>

          <div
            v-for="(step, stepIndex) in path.steps"
            :key="step._clientId"
            class="grid grid-cols-[2rem_1fr_1fr_1fr_5rem_9rem_4.5rem_2rem] gap-2 items-start"
          >
            <!-- Step order number -->
            <span class="text-sm text-(--ui-text-muted) pt-1.5 text-center">{{ stepIndex + 1 }}</span>

            <!-- Process name -->
            <div>
              <ProcessLocationDropdown
                :model-value="step.name"
                type="process"
                @update:model-value="(v: string) => { step.name = v; clearFieldError(`paths[${pathIndex}].steps[${stepIndex}].name`) }"
              />
              <p
                v-if="getFieldError(`paths[${pathIndex}].steps[${stepIndex}].name`)"
                data-error
                class="text-xs text-(--ui-error) mt-0.5"
              >
                {{ getFieldError(`paths[${pathIndex}].steps[${stepIndex}].name`) }}
              </p>
            </div>

            <!-- Location -->
            <div>
              <ProcessLocationDropdown
                :model-value="step.location"
                type="location"
                @update:model-value="(v: string) => { step.location = v }"
              />
            </div>

            <!-- Assignee -->
            <USelect
              :model-value="assigneeToSelect(step.assignedTo)"
              :items="assigneeItems"
              size="sm"
              @update:model-value="(v: string) => { step.assignedTo = selectToAssignee(v) }"
            />

            <!-- Optional checkbox -->
            <div class="flex items-center justify-center pt-1.5">
              <input
                v-model="step.optional"
                type="checkbox"
                class="rounded"
              >
            </div>

            <!-- Dependency type -->
            <USelect
              v-model="step.dependencyType"
              :items="dependencyTypeOptions"
              size="sm"
            />

            <!-- Move up/down -->
            <div class="flex items-center gap-0.5">
              <UButton
                icon="i-lucide-arrow-up"
                variant="ghost"
                size="xs"
                :disabled="stepIndex === 0"
                @click="moveStep(path._clientId, step._clientId, -1)"
              />
              <UButton
                icon="i-lucide-arrow-down"
                variant="ghost"
                size="xs"
                :disabled="stepIndex === path.steps.length - 1"
                @click="moveStep(path._clientId, step._clientId, 1)"
              />
            </div>

            <!-- Remove step -->
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="error"
              size="xs"
              :disabled="path.steps.length <= 1"
              @click="removeStep(path._clientId, step._clientId)"
            />
          </div>
        </div>

        <!-- Add Step button -->
        <UButton
          icon="i-lucide-plus"
          label="Add Step"
          variant="outline"
          size="xs"
          @click="addStep(path._clientId)"
        />
      </div>
    </div>

    <!-- Submit / Cancel -->
    <div class="flex items-center gap-3 pt-4 border-t border-(--ui-border)">
      <UButton
        :label="mode === 'create' ? 'Create Job' : 'Save Changes'"
        :loading="submitting"
        :disabled="submitting"
        @click="handleSubmit"
      />
      <UButton
        label="Cancel"
        variant="outline"
        :disabled="submitting"
        @click="handleCancel"
      />
    </div>
  </div>
</template>
