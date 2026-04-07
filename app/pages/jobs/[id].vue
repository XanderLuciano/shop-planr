<script setup lang="ts">
import type { Job, Path, ShopUser, StepNote, ProcessStep } from '~/types/domain'
import type { JobProgress, StepDistribution } from '~/types/computed'

const route = useRoute()
const jobId = route.params.id as string

const { getJob, updateJob, deleteJob } = useJobs()
const { isAdmin } = useAuth()
const toast = useToast()
const { getPath: fetchPathDetail } = usePaths()
const { templates, fetchTemplates, applyTemplate } = useTemplates()
const { settings } = useSettings()
const { pushDescriptionTable, pushCommentSummary } = useJira()

// Active users for step assignment dropdowns
const activeUsers = ref<ShopUser[]>([])

async function loadActiveUsers() {
  try {
    activeUsers.value = await $fetch<ShopUser[]>('/api/users')
  } catch {
    activeUsers.value = []
  }
}

const job = ref<Job | null>(null)
const paths = ref<Path[]>([])
const progress = ref<JobProgress | null>(null)
const loading = ref(true)
const error = ref('')

// Tab state
const activeTab = ref('routing')
const tabs = [
  { label: 'Job Routing', value: 'routing', icon: 'i-lucide-route' },
  { label: 'Parts', value: 'parts', icon: 'i-lucide-hash' },
]

// Path distributions keyed by path ID
const distributions = ref<Record<string, StepDistribution[]>>({})
const pathCompletedCounts = ref<Record<string, number>>({})

// Notes keyed by step ID
const pathNotes = ref<Record<string, StepNote[]>>({})
const showNotesForPath = ref<string | null>(null)
const showNoteFormStep = ref<string | null>(null)

// Step config panel
const configStepId = ref<string | null>(null)
const configStep = ref<ProcessStep | null>(null)

// UI state
const showPathEditor = ref(false)
const editingPathId = ref<string | null>(null)
const showTemplateApply = ref(false)
const applyingTemplate = ref(false)
const applyError = ref('')
const selectedTemplateId = ref('')
const applyGoalQty = ref(1)

// Inline goal quantity editing
const editingGoalQty = ref(false)
const goalQtyDraft = ref(0)
const goalQtySaving = ref(false)

// Jira push state
const pushingDescription = ref(false)
const pushingComment = ref(false)
const jiraPushMessage = ref('')
const jiraPushError = ref(false)

const jiraPushAvailable = computed(() =>
  !!job.value?.jiraTicketKey
  && !!settings.value?.jiraConnection?.enabled
  && !!settings.value?.jiraConnection?.pushEnabled,
)

// Delete state
const showDeleteModal = ref(false)
const deleting = ref(false)

const canDelete = computed(() => {
  if (!progress.value) return false
  return paths.value.length === 0 && progress.value.totalParts === 0
})

function onStepClick(_pathId: string, payload: { stepId: string, stepName: string, stepOrder: number }) {
  // Navigate to step view for this step (advancement), passing referrer context
  navigateTo(`/parts/step/${encodeURIComponent(payload.stepId)}?from=${encodeURIComponent(`/jobs/${jobId}`)}`)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onStepConfigure(_pathId: string, payload: { stepId: string }) {
  // Find the step to show config panel
  const p = paths.value.find(pp => pp.id === _pathId)
  const step = p?.steps.find(s => s.id === payload.stepId)
  if (step) {
    configStepId.value = step.id
    configStep.value = step
  }
}

function closeStepConfig() {
  configStepId.value = null
  configStep.value = null
}

async function onStepConfigUpdated() {
  closeStepConfig()
  await loadJob()
}

async function loadJob() {
  loading.value = true
  error.value = ''
  try {
    const detail = await getJob(jobId)
    job.value = detail
    paths.value = [...detail.paths]
    progress.value = detail.progress
    await loadAllDistributions()
  } catch (e) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to load job'
  } finally {
    loading.value = false
  }
}

async function loadAllDistributions() {
  const results = await Promise.allSettled(
    paths.value.map(p =>
      fetchPathDetail(p.id).then(d => ({ id: p.id, distribution: d.distribution, completedCount: d.completedCount })),
    ),
  )
  const map: Record<string, StepDistribution[]> = {}
  const counts: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map[r.value.id] = r.value.distribution
      counts[r.value.id] = r.value.completedCount
    }
  }
  distributions.value = map
  pathCompletedCounts.value = counts
}

async function loadPathNotes(pathId: string) {
  const path = paths.value.find(p => p.id === pathId)
  if (!path) return
  const allNotes: StepNote[] = []
  for (const step of path.steps) {
    try {
      const notes = await $fetch<StepNote[]>(`/api/notes/step/${step.id}`)
      allNotes.push(...notes)
    } catch { /* skip */ }
  }
  allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  pathNotes.value = { ...pathNotes.value, [pathId]: allNotes }
}

function togglePathNotes(pathId: string) {
  if (showNotesForPath.value === pathId) {
    showNotesForPath.value = null
  } else {
    showNotesForPath.value = pathId
    loadPathNotes(pathId)
  }
  showNoteFormStep.value = null
}

function onNoteCreated(pathId: string) {
  showNoteFormStep.value = null
  loadPathNotes(pathId)
}

function startEditGoalQty() {
  goalQtyDraft.value = job.value?.goalQuantity ?? 1
  editingGoalQty.value = true
}

async function saveGoalQty() {
  if (!job.value || goalQtyDraft.value < 1) return
  goalQtySaving.value = true
  try {
    await updateJob(job.value.id, { name: job.value.name, goalQuantity: goalQtyDraft.value })
    editingGoalQty.value = false
    await loadJob()
  } catch (e) {
    error.value = e?.data?.message ?? e?.message ?? 'Failed to update goal quantity'
  } finally {
    goalQtySaving.value = false
  }
}

function onPathSaved() {
  showPathEditor.value = false
  editingPathId.value = null
  loadJob()
}

function onPathDeleted() {
  loadJob()
}

function startEditPath(pathId: string) {
  editingPathId.value = pathId
  showPathEditor.value = false
}

function onAdvancementModeUpdated() {
  loadJob()
}

function getPathPartCount(pathId: string): number {
  const dist = distributions.value[pathId]
  if (!dist) return 0
  return dist.reduce((sum, d) => sum + d.partCount, 0)
}

const totalCompleted = computed(() => progress.value?.completedParts ?? 0)
const totalInProgress = computed(() => progress.value?.inProgressParts ?? 0)

async function onApplyTemplate() {
  if (!selectedTemplateId.value) return
  applyingTemplate.value = true
  applyError.value = ''
  try {
    await applyTemplate(selectedTemplateId.value, {
      jobId,
      goalQuantity: applyGoalQty.value,
    })
    showTemplateApply.value = false
    selectedTemplateId.value = ''
    applyGoalQty.value = job.value?.goalQuantity ?? 1
    await loadJob()
  } catch (e) {
    applyError.value = e?.data?.message ?? e?.message ?? 'Failed to apply template'
  } finally {
    applyingTemplate.value = false
  }
}

async function onPushDescription() {
  pushingDescription.value = true
  jiraPushMessage.value = ''
  jiraPushError.value = false
  try {
    const result = await pushDescriptionTable(jobId)
    jiraPushMessage.value = result.success ? 'Status table pushed to Jira description' : (result.error ?? 'Push failed')
    jiraPushError.value = !result.success
  } catch (e) {
    jiraPushMessage.value = e?.data?.message ?? e?.message ?? 'Push failed'
    jiraPushError.value = true
  } finally {
    pushingDescription.value = false
  }
}

async function onPushComment() {
  pushingComment.value = true
  jiraPushMessage.value = ''
  jiraPushError.value = false
  try {
    const result = await pushCommentSummary(jobId)
    jiraPushMessage.value = result.success ? 'Comment summary pushed to Jira' : (result.error ?? 'Push failed')
    jiraPushError.value = !result.success
  } catch (e) {
    jiraPushMessage.value = e?.data?.message ?? e?.message ?? 'Push failed'
    jiraPushError.value = true
  } finally {
    pushingComment.value = false
  }
}

async function confirmDelete() {
  deleting.value = true
  try {
    await deleteJob(jobId)
    navigateTo('/jobs')
  } catch (e) {
    toast.add({
      title: 'Cannot delete job',
      description: e?.data?.message ?? e?.message ?? 'Failed to delete job',
      color: 'error',
    })
  } finally {
    deleting.value = false
    showDeleteModal.value = false
  }
}

onMounted(() => {
  loadJob()
  loadActiveUsers()
  fetchTemplates()
})
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Back link -->
    <NuxtLink
      to="/jobs"
      class="inline-flex items-center gap-1 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="size-3"
      />
      Back to Jobs
    </NuxtLink>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading job...
    </div>

    <!-- Error -->
    <div
      v-else-if="error && !job"
      class="text-sm text-red-500 py-8"
    >
      {{ error }}
    </div>

    <template v-else-if="job">
      <!-- Job Header -->
      <div class="space-y-2">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
              {{ job.name }}
            </h1>
            <div class="flex items-center gap-3 text-xs text-(--ui-text-muted) mt-0.5">
              <span class="flex items-center gap-1">
                Goal:
                <template v-if="editingGoalQty">
                  <UInput
                    v-model.number="goalQtyDraft"
                    type="number"
                    :min="1"
                    size="xs"
                    class="w-16"
                    @keyup.enter="saveGoalQty"
                    @keyup.escape="editingGoalQty = false"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-check"
                    :loading="goalQtySaving"
                    @click="saveGoalQty"
                  />
                  <UButton
                    size="xs"
                    variant="ghost"
                    icon="i-lucide-x"
                    @click="editingGoalQty = false"
                  />
                </template>
                <template v-else>
                  <strong
                    class="text-(--ui-text-highlighted) cursor-pointer hover:underline"
                    @click="startEditGoalQty"
                  >{{ job.goalQuantity }}</strong>
                </template>
              </span>
              <span v-if="job.jiraTicketKey">Jira: {{ job.jiraTicketKey }}</span>
              <span v-if="job.jiraPartNumber">Part #: {{ job.jiraPartNumber }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              label="Edit"
              @click="navigateTo(`/jobs/edit/${encodeURIComponent(jobId)}`)"
            />
            <UButton
              v-if="isAdmin"
              icon="i-lucide-trash-2"
              size="xs"
              variant="soft"
              color="error"
              label="Delete"
              :disabled="!canDelete"
              @click="showDeleteModal = true"
            />
          </div>
        </div>

        <!-- Progress -->
        <div
          v-if="progress"
          class="space-y-1"
        >
          <ProgressBar
            :completed="totalCompleted"
            :goal="job.goalQuantity"
            :in-progress="totalInProgress"
          />
          <div class="flex gap-3 text-xs text-(--ui-text-muted)">
            <span>{{ totalCompleted }} completed</span>
            <span>{{ totalInProgress }} in progress</span>
            <span v-if="progress.scrappedParts">{{ progress.scrappedParts }} scrapped</span>
            <span>{{ progress.totalParts }} total parts</span>
          </div>
        </div>
      </div>

      <p
        v-if="error"
        class="text-xs text-red-500"
      >
        {{ error }}
      </p>

      <!-- Jira Push Section -->
      <div
        v-if="jiraPushAvailable"
        class="space-y-2 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-upload"
            class="size-3.5 text-(--ui-text-muted)"
          />
          <span class="text-xs font-semibold text-(--ui-text-highlighted)">Push to Jira</span>
          <UBadge
            size="xs"
            variant="subtle"
            color="neutral"
          >
            {{ job.jiraTicketKey }}
          </UBadge>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="soft"
            label="Push Status Table"
            icon="i-lucide-table"
            :loading="pushingDescription"
            @click="onPushDescription"
          />
          <UButton
            size="xs"
            variant="soft"
            label="Push Comment Summary"
            icon="i-lucide-message-square"
            :loading="pushingComment"
            @click="onPushComment"
          />
        </div>
        <p
          v-if="jiraPushMessage"
          class="text-xs"
          :class="jiraPushError ? 'text-red-500' : 'text-green-500'"
        >
          {{ jiraPushMessage }}
        </p>
      </div>

      <!-- Tab bar -->
      <div class="flex gap-1 border-b border-(--ui-border)">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="activeTab === tab.value
            ? 'border-(--ui-color-primary-500) text-(--ui-text-highlighted)'
            : 'border-transparent text-(--ui-text-muted) hover:text-(--ui-text-highlighted)'"
          @click="activeTab = tab.value"
        >
          <UIcon
            :name="tab.icon"
            class="size-3.5"
          />
          {{ tab.label }}
        </button>
      </div>

      <!-- Job Routing Tab -->
      <div
        v-if="activeTab === 'routing'"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-(--ui-text-highlighted)">
            Paths
          </h2>
          <div class="flex gap-1.5">
            <UButton
              v-if="!showTemplateApply && !showPathEditor && templates.length"
              icon="i-lucide-copy"
              size="xs"
              variant="soft"
              color="neutral"
              label="From Template"
              @click="showTemplateApply = true; applyGoalQty = job?.goalQuantity ?? 1"
            />
            <UButton
              v-if="!showPathEditor && !showTemplateApply"
              icon="i-lucide-plus"
              size="xs"
              variant="soft"
              label="Add Path"
              @click="showPathEditor = true"
            />
          </div>
        </div>

        <!-- Apply template form -->
        <div
          v-if="showTemplateApply"
          class="space-y-2 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50"
        >
          <div class="text-xs font-semibold text-(--ui-text-highlighted)">
            Apply Template
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs text-(--ui-text-muted) mb-0.5">Template</label>
              <USelect
                v-model="selectedTemplateId"
                :items="templates.map(t => ({ label: `${t.name} (${t.steps.length} steps)`, value: t.id }))"
                size="sm"
                placeholder="Select template"
                class="w-full"
              />
            </div>
            <div>
              <label class="block text-xs text-(--ui-text-muted) mb-0.5">Goal Qty</label>
              <UInput
                v-model.number="applyGoalQty"
                type="number"
                size="sm"
                :min="1"
                class="w-full"
              />
            </div>
          </div>
          <p
            v-if="applyError"
            class="text-xs text-red-500"
          >
            {{ applyError }}
          </p>
          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              size="xs"
              label="Cancel"
              @click="showTemplateApply = false; applyError = ''"
            />
            <UButton
              size="xs"
              label="Apply"
              :loading="applyingTemplate"
              :disabled="!selectedTemplateId"
              @click="onApplyTemplate"
            />
          </div>
        </div>

        <!-- New path editor -->
        <PathEditor
          v-if="showPathEditor"
          :job-id="jobId"
          @save="onPathSaved"
          @cancel="showPathEditor = false"
        />

        <!-- No paths -->
        <p
          v-if="!paths.length && !showPathEditor"
          class="text-xs text-(--ui-text-muted) py-2"
        >
          No paths defined yet. Add a path to start routing parts.
        </p>

        <!-- Step config panel (shown when a step is clicked) -->
        <div
          v-if="configStep"
          class="space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-(--ui-text-highlighted)">Configure: {{ configStep.name }}</span>
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-x"
              @click="closeStepConfig"
            />
          </div>
          <StepConfigPanel
            :step-id="configStep.id"
            :optional="configStep.optional"
            :dependency-type="configStep.dependencyType"
            @updated="onStepConfigUpdated"
          />
        </div>

        <!-- Path cards -->
        <div
          v-for="p in paths"
          :key="p.id"
          class="border border-(--ui-border) rounded-md"
        >
          <!-- Path editing -->
          <div
            v-if="editingPathId === p.id"
            class="p-2"
          >
            <PathEditor
              :job-id="jobId"
              :path="p"
              @save="onPathSaved"
              @cancel="editingPathId = null"
            />
          </div>

          <template v-else>
            <!-- Path header -->
            <div class="flex items-center justify-between px-3 py-2 bg-(--ui-bg-elevated)/50">
              <div>
                <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ p.name }}</span>
                <span class="text-xs text-(--ui-text-muted) ml-2">Goal: {{ p.goalQuantity }} · {{ p.steps.length }} steps</span>
              </div>
              <div class="flex items-center gap-1">
                <PathDeleteButton
                  v-if="isAdmin"
                  :path-id="p.id"
                  :path-name="p.name"
                  :part-count="getPathPartCount(p.id)"
                  @deleted="onPathDeleted"
                />
                <UButton
                  icon="i-lucide-pencil"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  @click="startEditPath(p.id)"
                />
              </div>
            </div>

            <!-- Advancement mode selector -->
            <div class="px-3 py-1.5 border-t border-(--ui-border)/50">
              <AdvancementModeSelector
                :path-id="p.id"
                :current-mode="p.advancementMode"
                @updated="onAdvancementModeUpdated"
              />
            </div>

            <!-- Step tracker -->
            <div
              v-if="distributions[p.id]"
              class="px-3 py-2"
            >
              <StepTracker
                :path="p"
                :distribution="distributions[p.id]!"
                :completed-count="pathCompletedCounts[p.id] ?? 0"
                :users="activeUsers"
                @step-click="onStepClick(p.id, $event)"
              />
            </div>

            <!-- Notes section -->
            <div class="px-3 py-1.5 border-t border-(--ui-border)/50">
              <button
                class="flex items-center gap-1.5 text-xs text-(--ui-text-muted) hover:text-(--ui-text-highlighted) transition-colors cursor-pointer"
                @click="togglePathNotes(p.id)"
              >
                <UIcon
                  name="i-lucide-message-square"
                  class="size-3"
                />
                Notes
                <UBadge
                  v-if="pathNotes[p.id]?.length"
                  size="xs"
                  variant="subtle"
                  color="warning"
                >
                  {{ pathNotes[p.id]!.length }}
                </UBadge>
                <UIcon
                  :name="showNotesForPath === p.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="size-3"
                />
              </button>

              <div
                v-if="showNotesForPath === p.id"
                class="mt-2 space-y-2"
              >
                <div
                  v-if="p.steps.length"
                  class="flex items-center gap-2 flex-wrap"
                >
                  <span class="text-xs text-(--ui-text-muted)">Add note at:</span>
                  <UButton
                    v-for="step in p.steps"
                    :key="step.id"
                    size="xs"
                    :variant="showNoteFormStep === step.id ? 'solid' : 'soft'"
                    color="neutral"
                    :label="step.name"
                    @click="showNoteFormStep = showNoteFormStep === step.id ? null : step.id"
                  />
                </div>
                <div
                  v-if="showNoteFormStep"
                  class="p-2 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30"
                >
                  <StepNoteForm
                    :job-id="jobId"
                    :path-id="p.id"
                    :step-id="showNoteFormStep"
                    :part-ids="[]"
                    :jira-ticket-key="job?.jiraTicketKey"
                    :jira-push-enabled="jiraPushAvailable"
                    @created="onNoteCreated(p.id)"
                  />
                </div>
                <StepNoteList :notes="pathNotes[p.id] ?? []" />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Parts Tab -->
      <div v-if="activeTab === 'parts'">
        <JobPartsTab
          :job-id="jobId"
          :paths="paths"
          :goal-quantity="job.goalQuantity"
        />
      </div>
    </template>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold text-(--ui-text-highlighted)">
            Delete Job
          </h3>
          <p class="text-sm text-(--ui-text-muted)">
            Are you sure you want to delete <span class="font-semibold text-(--ui-text-highlighted)">{{ job?.name }}</span>? This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton
              variant="ghost"
              label="Cancel"
              @click="showDeleteModal = false"
            />
            <UButton
              color="error"
              label="Delete"
              icon="i-lucide-trash-2"
              :loading="deleting"
              @click="confirmDelete"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
