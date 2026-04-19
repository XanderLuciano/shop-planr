<script setup lang="ts">
import { nextTick } from 'vue'
import type { Job, Path } from '~/types/domain'
import { extractApiError } from '~/utils/apiError'

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
  applyTemplate,
  validate,
  submit,
  getFieldError,
  clearFieldError,
} = useJobForm(props.mode, props.existingJob)

const { templates, fetchTemplates } = useTemplates()
const { users: allUsers } = useAuth()
const { tags, fetchJobTags, setJobTags } = useJobTags()
const toast = useToast()

const selectedTagIds = ref<string[]>([])

// Active users for assignee dropdown
const assigneeItems = computed(() => {
  const unassigned = { label: 'Unassigned', value: SELECT_UNASSIGNED }
  const userOptions = allUsers.value
    .filter(u => u.active)
    .map(u => ({ label: u.displayName, value: u.id }))
  return [unassigned, ...userOptions]
})

// Per-path template selection state
const templateSelections = ref<Record<string, string>>({})

const dependencyTypeOptions = [
  { label: 'Physical', value: 'physical' },
  { label: 'Preferred', value: 'preferred' },
  { label: 'Completion Gate', value: 'completion_gate' },
]

onMounted(async () => {
  fetchTemplates()
  if (props.mode === 'edit' && props.existingJob) {
    await fetchJobTags(props.existingJob.id)
    selectedTagIds.value = tags.value.map(t => t.id)
  }
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
    try {
      await setJobTags(jobId, selectedTagIds.value)
    } catch (e) {
      // Tag assignment failing shouldn't block the job save — the job itself
      // was created successfully. Surface the failure as a toast so the user
      // knows to retry from the edit view, rather than silently swallowing it.
      toast.add({
        title: 'Tags not saved',
        description: extractApiError(e, 'Failed to assign tags to the new job.'),
        color: 'warning',
      })
    }
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
      <div>
        <label class="block text-sm font-medium text-(--ui-text-highlighted) mb-1">Tags</label>
        <TagSelector v-model="selectedTagIds" />
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
            <AdvancementModeField v-model="path.advancementMode" />
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

        <!-- Step grid — delegated to PathStepEditor -->
        <PathStepEditor
          :steps="path.steps"
          :assignee-items="assigneeItems"
          :dependency-type-options="dependencyTypeOptions"
          :get-field-error="(stepIdx: number, field: string) => getFieldError(`paths[${pathIndex}].steps[${stepIdx}].${field}`)"
          :clear-field-error="(stepIdx: number, field: string) => clearFieldError(`paths[${pathIndex}].steps[${stepIdx}].${field}`)"
          @update:steps="path.steps = $event"
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
