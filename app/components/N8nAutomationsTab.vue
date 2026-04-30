<script setup lang="ts">
import type { WebhookEventType, N8nWorkflowDefinition } from '~/types/domain'
import { WEBHOOK_EVENT_TYPES } from '~/types/domain'

const { isAdmin } = useAuth()

const {
  automations,
  loading,
  error,
  n8nStatus,
  fetchAutomations,
  fetchN8nStatus,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  deployAutomation,
} = useN8nAutomations()

// ---- Form state ----
const showForm = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formDescription = ref('')
const formEventTypes = ref<WebhookEventType[]>([])
const formWorkflow = ref<N8nWorkflowDefinition>({ nodes: [], connections: {} })
const formEnabled = ref(false)
const formError = ref('')
const saving = ref(false)
const deploying = ref<string | null>(null)

// ---- Delete state ----
const showDeleteConfirm = ref(false)
const deletingAutomation = ref<{ id: string, name: string } | null>(null)
const deleting = ref(false)

// ---- Computed ----
const isEditing = computed(() => editingId.value !== null)
const formValid = computed(() => formName.value.trim().length > 0 && formEventTypes.value.length > 0)

// ---- Form actions ----
function resetForm() {
  formName.value = ''
  formDescription.value = ''
  formEventTypes.value = []
  formWorkflow.value = { nodes: [], connections: {} }
  formEnabled.value = false
  formError.value = ''
  editingId.value = null
  showForm.value = false
}

function openAddForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(auto: { id: string, name: string, description: string, eventTypes: WebhookEventType[], workflowJson: N8nWorkflowDefinition, enabled: boolean }) {
  editingId.value = auto.id
  formName.value = auto.name
  formDescription.value = auto.description
  formEventTypes.value = [...auto.eventTypes]
  formWorkflow.value = JSON.parse(JSON.stringify(auto.workflowJson))
  formEnabled.value = auto.enabled
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  if (!formValid.value || saving.value) return
  formError.value = ''
  saving.value = true

  try {
    if (isEditing.value) {
      await updateAutomation(editingId.value!, {
        name: formName.value.trim(),
        description: formDescription.value.trim(),
        eventTypes: [...formEventTypes.value],
        workflowJson: formWorkflow.value,
        enabled: formEnabled.value,
      })
    } else {
      await createAutomation({
        name: formName.value.trim(),
        description: formDescription.value.trim(),
        eventTypes: [...formEventTypes.value],
        workflowJson: formWorkflow.value,
        enabled: formEnabled.value,
      })
    }
    resetForm()
  } catch (e: unknown) {
    formError.value = extractApiError(e, isEditing.value ? 'Failed to update automation' : 'Failed to create automation')
  } finally {
    saving.value = false
  }
}

// ---- Delete ----
function confirmDelete(auto: { id: string, name: string }) {
  deletingAutomation.value = { id: auto.id, name: auto.name }
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deletingAutomation.value || deleting.value) return
  deleting.value = true
  try {
    await deleteAutomation(deletingAutomation.value.id)
    showDeleteConfirm.value = false
    deletingAutomation.value = null
  } catch {
    // Error handled by composable
  } finally {
    deleting.value = false
  }
}

// ---- Deploy ----
async function handleDeploy(id: string) {
  deploying.value = id
  try {
    await deployAutomation(id)
  } catch {
    // Error handled by composable
  } finally {
    deploying.value = null
  }
}

// ---- Toggle enabled ----
async function toggleEnabled(auto: { id: string, enabled: boolean }) {
  try {
    await updateAutomation(auto.id, { enabled: !auto.enabled })
  } catch {
    // Error handled by composable
  }
}

// ---- Event type checkbox helpers ----
const allSelected = computed(() => formEventTypes.value.length === WEBHOOK_EVENT_TYPES.length)

function toggleSubscribeAll(checked: boolean | 'indeterminate') {
  if (checked === true) {
    formEventTypes.value = [...WEBHOOK_EVENT_TYPES]
  } else {
    formEventTypes.value = []
  }
}

function toggleEventType(type: WebhookEventType, checked: boolean | 'indeterminate') {
  if (checked === true) {
    if (!formEventTypes.value.includes(type)) {
      formEventTypes.value = [...formEventTypes.value, type]
    }
  } else {
    formEventTypes.value = formEventTypes.value.filter(t => t !== type)
  }
}

// ---- Init ----
onMounted(async () => {
  await Promise.all([fetchAutomations(), fetchN8nStatus()])
})
</script>

<template>
  <div class="space-y-5 pt-4">
    <!-- n8n Connection Status -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-(--ui-text-muted)">
          {{ automations.length }} automation{{ automations.length !== 1 ? 's' : '' }}
        </span>
        <UBadge
          v-if="n8nStatus"
          :color="n8nStatus.connected ? 'success' : 'warning'"
          variant="subtle"
          size="xs"
        >
          <UIcon
            :name="n8nStatus.connected ? 'i-lucide-plug' : 'i-lucide-plug-zap'"
            class="size-3 mr-1"
          />
          {{ n8nStatus.connected ? 'n8n Connected' : 'n8n Not Connected' }}
        </UBadge>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="isAdmin && !showForm"
          label="New Automation"
          icon="i-lucide-plus"
          size="sm"
          @click="openAddForm"
        />
      </div>
    </div>

    <!-- n8n not configured info -->
    <UAlert
      v-if="n8nStatus && !n8nStatus.connected"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
    >
      <template #title>
        n8n Instance Not Connected
      </template>
      <template #description>
        <p class="text-sm">
          Set <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded text-xs">N8N_BASE_URL</code> and
          <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded text-xs">N8N_API_KEY</code> in your environment
          to connect to your n8n instance. You can still design automations — they'll be deployed when n8n is connected.
        </p>
        <p
          v-if="n8nStatus.error"
          class="text-xs mt-1 opacity-70"
        >
          {{ n8nStatus.error }}
        </p>
      </template>
    </UAlert>

    <!-- Error banner -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!-- Automation form (add / edit) -->
    <div
      v-if="showForm"
      class="border border-(--ui-border) rounded-lg p-4 space-y-4 bg-(--ui-bg-elevated)/50"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
          {{ isEditing ? 'Edit Automation' : 'New Automation' }}
        </h3>
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          size="xs"
          @click="resetForm"
        />
      </div>

      <!-- Name -->
      <UFormField label="Name">
        <UInput
          v-model="formName"
          placeholder="e.g. Notify Slack on Part Advance"
          class="w-full"
        />
      </UFormField>

      <!-- Description -->
      <UFormField label="Description">
        <UTextarea
          v-model="formDescription"
          placeholder="What does this automation do?"
          :rows="2"
          class="w-full"
        />
      </UFormField>

      <!-- Event types -->
      <UFormField label="Trigger Events">
        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm font-medium cursor-pointer pb-1 border-b border-(--ui-border)">
            <UCheckbox
              :model-value="allSelected"
              @update:model-value="toggleSubscribeAll"
            />
            All events
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label
              v-for="evtType in WEBHOOK_EVENT_TYPES"
              :key="evtType"
              class="flex items-center gap-2 text-sm cursor-pointer"
            >
              <UCheckbox
                :model-value="formEventTypes.includes(evtType)"
                @update:model-value="(checked: boolean | 'indeterminate') => toggleEventType(evtType, checked)"
              />
              {{ formatEventType(evtType) }}
            </label>
          </div>
        </div>
      </UFormField>

      <!-- Enabled toggle -->
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <UCheckbox v-model="formEnabled" />
        <span class="font-medium">Enable automation</span>
      </label>

      <!-- Workflow Editor -->
      <UFormField label="Workflow">
        <N8nWorkflowEditor
          v-model="formWorkflow"
          :event-types="formEventTypes"
        />
      </UFormField>

      <!-- Form error -->
      <p
        v-if="formError"
        class="text-xs text-red-500"
      >
        {{ formError }}
      </p>

      <!-- Form actions -->
      <div class="flex items-center gap-2">
        <UButton
          :label="isEditing ? 'Save Changes' : 'Create Automation'"
          color="primary"
          :disabled="!formValid || saving"
          :loading="saving"
          @click="submitForm"
        />
        <UButton
          label="Cancel"
          variant="ghost"
          @click="resetForm"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="loading && automations.length === 0"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8 justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading automations...
    </div>

    <!-- Automation list -->
    <div class="border border-(--ui-border) rounded-lg">
      <div
        v-if="automations.length === 0 && !loading && !showForm"
        class="text-center py-12 text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-workflow"
          class="size-8 mb-2"
        />
        <p>No automations yet.</p>
        <p class="text-xs mt-1">
          Create one to transform webhook events and send them to external services via n8n.
        </p>
      </div>
      <div
        v-else-if="automations.length > 0"
        class="divide-y divide-(--ui-border)"
      >
        <div
          v-for="auto in automations"
          :key="auto.id"
          class="py-3 px-4 flex items-start gap-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm text-(--ui-text-highlighted)">
                {{ auto.name }}
              </span>
              <UBadge
                :color="auto.enabled ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
              >
                {{ auto.enabled ? 'Active' : 'Disabled' }}
              </UBadge>
              <UBadge
                v-if="auto.n8nWorkflowId"
                color="info"
                variant="subtle"
                size="xs"
              >
                Deployed
              </UBadge>
            </div>
            <p
              v-if="auto.description"
              class="text-xs text-(--ui-text-muted) mt-0.5"
            >
              {{ auto.description }}
            </p>
            <div class="mt-1 flex items-center gap-1 flex-wrap">
              <UBadge
                variant="subtle"
                color="neutral"
                size="xs"
              >
                {{ auto.eventTypes.length }} event{{ auto.eventTypes.length !== 1 ? 's' : '' }}
              </UBadge>
              <UBadge
                variant="subtle"
                color="neutral"
                size="xs"
              >
                {{ auto.workflowJson.nodes.length }} node{{ auto.workflowJson.nodes.length !== 1 ? 's' : '' }}
              </UBadge>
            </div>
          </div>

          <div
            v-if="isAdmin"
            class="flex items-center gap-1 shrink-0"
          >
            <UButton
              :icon="auto.enabled ? 'i-lucide-pause' : 'i-lucide-play'"
              variant="ghost"
              size="xs"
              :title="auto.enabled ? 'Disable' : 'Enable'"
              @click="toggleEnabled(auto)"
            />
            <UButton
              icon="i-lucide-rocket"
              variant="ghost"
              size="xs"
              title="Deploy to n8n"
              :loading="deploying === auto.id"
              :disabled="deploying === auto.id || !n8nStatus?.connected"
              @click="handleDeploy(auto.id)"
            />
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              size="xs"
              title="Edit automation"
              @click="openEditForm(auto)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              title="Delete automation"
              @click="confirmDelete(auto)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- How it works -->
    <div class="p-3 bg-(--ui-bg-elevated) rounded-lg space-y-2">
      <p class="text-sm font-medium text-(--ui-text-highlighted)">
        How Automations Work
      </p>
      <ul class="text-sm text-(--ui-text-muted) list-disc list-inside space-y-1">
        <li>Automations use <strong>n8n</strong> as a workflow engine to transform and route Shop Planr events to external services.</li>
        <li>Design your workflow visually: add transform nodes (Set Fields, Code) and destination nodes (Slack, Jira, HTTP, Email).</li>
        <li>When a matching event fires, Shop Planr sends the payload to n8n, which executes your workflow pipeline.</li>
        <li>Deploy automations to your n8n instance with one click. Edit and redeploy anytime.</li>
        <li>n8n handles credentials, retries, and error handling for external service connections.</li>
      </ul>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Delete Automation
            </h3>
          </template>
          <p class="text-sm text-(--ui-text-muted)">
            Are you sure you want to delete <span class="font-medium text-(--ui-text-highlighted)">{{ deletingAutomation?.name }}</span>?
          </p>
          <p class="text-sm text-(--ui-text-muted) mt-2">
            This will not remove the workflow from your n8n instance — you'll need to delete it there separately.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="showDeleteConfirm = false"
              />
              <UButton
                label="Delete Automation"
                color="error"
                :loading="deleting"
                :disabled="deleting"
                @click="executeDelete"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
