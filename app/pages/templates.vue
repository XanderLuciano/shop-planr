<script setup lang="ts">
import type { TemplateRoute } from '~/server/types/domain'

const { templates, loading, fetchTemplates, createTemplate, deleteTemplate } = useTemplates()

// UI state
const showForm = ref(false)
const deleting = ref<string | null>(null)
const formError = ref('')
const formSaving = ref(false)
const editingTemplateId = ref<string | null>(null)

// Form state
interface StepDraft {
  name: string
  location: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

const templateName = ref('')
const steps = ref<StepDraft[]>([
  { name: '', location: '', optional: false, dependencyType: 'preferred' },
])

const dependencyOptions = [
  { label: 'Physical', value: 'physical' },
  { label: 'Preferred', value: 'preferred' },
  { label: 'Completion Gate', value: 'completion_gate' },
]

function resetForm() {
  templateName.value = ''
  steps.value = [{ name: '', location: '', optional: false, dependencyType: 'preferred' }]
  formError.value = ''
  formSaving.value = false
}

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

async function onSubmit() {
  formError.value = ''
  if (!templateName.value.trim()) {
    formError.value = 'Template name is required'
    return
  }
  const validSteps = steps.value.filter((s) => s.name.trim())
  if (!validSteps.length) {
    formError.value = 'At least one step with a name is required'
    return
  }

  formSaving.value = true
  try {
    await createTemplate({
      name: templateName.value.trim(),
      steps: validSteps.map((s) => ({
        name: s.name.trim(),
        location: s.location.trim() || undefined,
        optional: s.optional,
        dependencyType: s.dependencyType,
      })),
    })
    showForm.value = false
    resetForm()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Failed to create template'
  } finally {
    formSaving.value = false
  }
}

async function onDelete(template: TemplateRoute) {
  deleting.value = template.id
  try {
    await deleteTemplate(template.id)
  } catch {
    // silently handle
  } finally {
    deleting.value = null
  }
}

function onEditSaved() {
  editingTemplateId.value = null
  fetchTemplates()
}

function stepPreview(template: TemplateRoute): string {
  return [...template.steps]
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
    .map((s: { name: string }) => s.name)
    .join(' → ')
}

onMounted(() => {
  fetchTemplates()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-4xl">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">Templates</h1>
      <UButton
        v-if="!showForm"
        icon="i-lucide-plus"
        label="New Template"
        size="sm"
        @click="showForm = true"
      />
    </div>

    <!-- Create form -->
    <div
      v-if="showForm"
      class="space-y-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
    >
      <div class="text-xs font-semibold text-(--ui-text-highlighted)">New Template</div>

      <div>
        <label class="block text-xs text-(--ui-text-muted) mb-0.5">Template Name</label>
        <UInput
          v-model="templateName"
          size="sm"
          placeholder="e.g. Standard Machining Route"
          class="max-w-sm"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-(--ui-text-muted)">Process Steps</label>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            label="Add Step"
            @click="addStep"
          />
        </div>
        <div class="space-y-2">
          <div
            v-for="(step, i) in steps"
            :key="i"
            class="flex items-center gap-2 border border-(--ui-border) rounded-md p-2"
          >
            <span class="text-xs text-(--ui-text-muted) w-5 shrink-0 text-right">{{ i + 1 }}.</span>
            <ProcessLocationDropdown v-model="step.name" type="process" class="flex-1" />
            <ProcessLocationDropdown v-model="step.location" type="location" class="flex-1" />
            <label class="flex items-center gap-1 text-xs shrink-0">
              <input v-model="step.optional" type="checkbox" class="rounded" />
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
            <UButton
              icon="i-lucide-chevron-up"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="i === 0"
              @click="moveStep(i, -1)"
            />
            <UButton
              icon="i-lucide-chevron-down"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="i === steps.length - 1"
              @click="moveStep(i, 1)"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              :disabled="steps.length <= 1"
              @click="removeStep(i)"
            />
          </div>
        </div>
      </div>

      <p v-if="formError" class="text-xs text-red-500">{{ formError }}</p>

      <div class="flex gap-2 justify-end">
        <UButton
          variant="ghost"
          size="xs"
          label="Cancel"
          @click="
            showForm = false
            resetForm()
          "
        />
        <UButton size="xs" label="Create Template" :loading="formSaving" @click="onSubmit" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-(--ui-text-muted)">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading templates...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!templates.length && !showForm"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      No templates yet. Create a template to quickly set up common production routes.
    </div>

    <!-- Template list -->
    <div v-else class="space-y-2">
      <div
        v-for="t in templates"
        :key="t.id"
        class="border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
      >
        <div class="flex items-center justify-between px-3 py-2">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-(--ui-text-highlighted)">{{ t.name }}</div>
            <div class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
              {{ t.steps.length }} steps · {{ stepPreview(t) }}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="editingTemplateId = editingTemplateId === t.id ? null : t.id"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="error"
              :loading="deleting === t.id"
              @click="onDelete(t)"
            />
          </div>
        </div>

        <!-- Edit form -->
        <div v-if="editingTemplateId === t.id" class="px-3 pb-3 border-t border-(--ui-border)">
          <TemplateEditor :template="t" @saved="onEditSaved" @cancel="editingTemplateId = null" />
        </div>
      </div>
    </div>
  </div>
</template>
