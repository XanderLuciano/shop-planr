<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { WebhookEventType } from '~/types/domain'
import { WEBHOOK_EVENT_TYPES } from '~/types/domain'

const {
  config,
  events,
  stats,
  loading,
  dispatching,
  error,
  fetchConfig,
  updateConfig,
  fetchEvents,
  fetchStats,
  retryAllFailed,
  deleteEvent,
  clearAllEvents,
  dispatchQueued,
  dispatchSingle,
} = useWebhookEvents()

const { isAdmin } = useAuth()
const $api = useAuthFetch()

// ---- Tabs ----
const tabItems: TabsItem[] = [
  { label: 'Queue', icon: 'i-lucide-list', value: 'queue', ui: { label: 'hidden sm:inline' } },
  { label: 'Configuration', icon: 'i-lucide-settings', value: 'config', ui: { label: 'hidden sm:inline' } },
  { label: 'Developer', icon: 'i-lucide-flask-conical', value: 'developer', ui: { label: 'hidden sm:inline' } },
]

// ---- Config form state ----
const endpointUrl = ref('')
const enabledTypes = ref<WebhookEventType[]>([])
const isActive = ref(false)
const configDirty = ref(false)
const showClearConfirm = ref(false)

// ---- Test event state ----
const testEventType = ref<WebhookEventType>('part_advanced')
const sendingTest = ref(false)

// Event type options for checkboxes and select
const eventTypeItems = WEBHOOK_EVENT_TYPES.map(t => ({
  label: formatEventLabel(t),
  value: t,
}))

function formatEventLabel(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Sync local form from config
function syncFormFromConfig() {
  if (config.value) {
    endpointUrl.value = config.value.endpointUrl
    enabledTypes.value = [...config.value.enabledEventTypes]
    isActive.value = config.value.isActive
    configDirty.value = false
  }
}

watch(config, syncFormFromConfig)

// Track dirty state
watch([endpointUrl, enabledTypes, isActive], () => {
  if (!config.value) return
  configDirty.value
    = endpointUrl.value !== config.value.endpointUrl
      || JSON.stringify(enabledTypes.value) !== JSON.stringify(config.value.enabledEventTypes)
      || isActive.value !== config.value.isActive
}, { deep: true })

// ---- Guarded actions ----
const { execute: saveConfig, loading: savingConfig } = useGuardedAction(async () => {
  await updateConfig({
    endpointUrl: endpointUrl.value,
    enabledEventTypes: enabledTypes.value,
    isActive: isActive.value,
  })
  configDirty.value = false
})

const { execute: toggleActive, loading: togglingActive } = useGuardedAction(async () => {
  isActive.value = !isActive.value
  await saveConfig()
  if (isActive.value) {
    startDispatchLoop()
  } else {
    stopDispatchLoop()
  }
})

const { execute: handleRetryAll, loading: retryingAll } = useGuardedAction(async () => {
  await retryAllFailed()
})

const { execute: handleClearAll, loading: clearingAll } = useGuardedAction(async () => {
  await clearAllEvents()
  showClearConfirm.value = false
})

const { execute: handleDeleteEvent } = useGuardedAction(async (id: string) => {
  await deleteEvent(id)
})

const { execute: handleDispatch } = useGuardedAction(async () => {
  await dispatchQueued()
})

const { execute: handleRefresh, loading: refreshing } = useGuardedAction(async () => {
  await Promise.all([fetchEvents(), fetchStats()])
})

async function sendTestEvent() {
  sendingTest.value = true
  try {
    await $api('/api/webhooks/events/test', {
      method: 'POST',
      body: { eventType: testEventType.value },
    })
    await Promise.all([fetchEvents(), fetchStats()])
  } catch (e: unknown) {
    error.value = extractApiError(e, 'Failed to send test event')
  } finally {
    sendingTest.value = false
  }
}

// ---- Developer reference data ----
const eventPayloadDocs: { type: WebhookEventType, description: string, fields: { name: string, type: string, description: string }[] }[] = [
  {
    type: 'part_advanced',
    description: 'Fired when a part is advanced to the next process step.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user who performed the action' },
      { name: 'partId', type: 'string', description: 'Serial number ID (e.g. SN-00042)' },
      { name: 'targetStepId', type: 'string', description: 'ID of the step the part was advanced to' },
      { name: 'fromStep', type: 'string', description: 'Name of the previous step' },
      { name: 'toStep', type: 'string', description: 'Name of the new step' },
      { name: 'skip', type: 'boolean', description: 'Whether intermediate steps were skipped' },
      { name: 'newStatus', type: 'string', description: 'Part status after advancement (in_progress)' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'part_completed',
    description: 'Fired when a part finishes its final process step.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'targetStepId', type: 'string', description: 'ID of the final step' },
      { name: 'newStatus', type: 'string', description: 'Always "completed"' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'part_created',
    description: 'Fired when a new part (serial number) is created.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'New serial number ID' },
      { name: 'jobId', type: 'string', description: 'Parent job ID' },
      { name: 'jobName', type: 'string', description: 'Parent job name' },
      { name: 'pathId', type: 'string', description: 'Route path ID' },
      { name: 'pathName', type: 'string', description: 'Route path name' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'part_scrapped',
    description: 'Fired when a part is marked as scrap.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'reason', type: 'string', description: 'Scrap reason code (e.g. dimensional_failure)' },
      { name: 'explanation', type: 'string?', description: 'Optional free-text explanation' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'part_force_completed',
    description: 'Fired when a part is force-completed with remaining steps incomplete.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'reason', type: 'string?', description: 'Optional reason for force completion' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'step_skipped',
    description: 'Fired when a process step is skipped for a part.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'stepId', type: 'string', description: 'Skipped step ID' },
      { name: 'stepName', type: 'string', description: 'Skipped step name' },
      { name: 'reason', type: 'string?', description: 'Optional reason' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'step_deferred',
    description: 'Fired when a required step is deferred to be completed later.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'stepId', type: 'string', description: 'Deferred step ID' },
      { name: 'stepName', type: 'string', description: 'Deferred step name' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'step_waived',
    description: 'Fired when a deferred step is waived by an approver.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'partId', type: 'string', description: 'Serial number ID' },
      { name: 'stepId', type: 'string', description: 'Waived step ID' },
      { name: 'stepName', type: 'string', description: 'Waived step name' },
      { name: 'reason', type: 'string', description: 'Waiver justification' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'job_created',
    description: 'Fired when a new production job is created.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'jobId', type: 'string', description: 'New job ID' },
      { name: 'jobName', type: 'string', description: 'Job name' },
      { name: 'goalQuantity', type: 'number', description: 'Target quantity' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'job_deleted',
    description: 'Fired when a job is deleted.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'jobId', type: 'string', description: 'Deleted job ID' },
      { name: 'jobName', type: 'string', description: 'Deleted job name' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'path_deleted',
    description: 'Fired when a route path is deleted (admin cascade delete).',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'pathId', type: 'string', description: 'Deleted path ID' },
      { name: 'pathName', type: 'string', description: 'Deleted path name' },
      { name: 'jobId', type: 'string', description: 'Parent job ID' },
      { name: 'deletedPartIds', type: 'string[]', description: 'IDs of parts cascade-deleted with the path' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'note_created',
    description: 'Fired when a defect note is created on a process step.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'noteId', type: 'string', description: 'Note ID' },
      { name: 'stepId', type: 'string', description: 'Step the note is attached to' },
      { name: 'stepName', type: 'string', description: 'Step name' },
      { name: 'partIds', type: 'string[]', description: 'Affected part IDs' },
      { name: 'text', type: 'string', description: 'Note content' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
  {
    type: 'cert_attached',
    description: 'Fired when a quality certificate is attached to a part at a step.',
    fields: [
      { name: 'user', type: 'string', description: 'Display name of the user' },
      { name: 'certId', type: 'string', description: 'Certificate ID' },
      { name: 'certName', type: 'string', description: 'Certificate name' },
      { name: 'certType', type: 'string', description: 'Certificate type (material or process)' },
      { name: 'partId', type: 'string', description: 'Part the cert is attached to' },
      { name: 'stepId', type: 'string', description: 'Step where the cert was attached' },
      { name: 'stepName', type: 'string', description: 'Step name' },
      { name: 'time', type: 'string', description: 'ISO 8601 timestamp' },
    ],
  },
]

// Status badge color
function statusColor(status: string): 'info' | 'success' | 'error' | 'neutral' | 'warning' {
  switch (status) {
    case 'queued': return 'info'
    case 'sent': return 'success'
    case 'failed': return 'error'
    case 'cancelled': return 'warning'
    default: return 'neutral'
  }
}

// ---- Dispatch loop (page-scoped) ----
let dispatchInterval: ReturnType<typeof setInterval> | null = null

function startDispatchLoop() {
  if (dispatchInterval) return
  dispatchQueued()
  dispatchInterval = setInterval(() => {
    dispatchQueued()
  }, 10000)
}

function stopDispatchLoop() {
  if (dispatchInterval) {
    clearInterval(dispatchInterval)
    dispatchInterval = null
  }
}

// ---- Init ----
onMounted(async () => {
  await Promise.all([fetchConfig(), fetchEvents(), fetchStats()])
  syncFormFromConfig()
  if (config.value?.isActive) {
    startDispatchLoop()
  }
})

let refreshInterval: ReturnType<typeof setInterval> | null = null

onUnmounted(() => {
  stopDispatchLoop()
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

// Auto-refresh events every 15s while page is open
onMounted(() => {
  refreshInterval = setInterval(() => {
    fetchEvents()
    fetchStats()
  }, 15000)
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Webhooks
      </h1>
      <UBadge
        :color="isActive ? 'success' : 'neutral'"
        variant="subtle"
        size="lg"
      >
        {{ isActive ? 'Active' : 'Paused' }}
      </UBadge>
    </div>

    <!-- Error banner (shared across tabs) -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
      :close-button="{ onClick: () => (error = null) }"
    />

    <!-- Tabs -->
    <UTabs
      :items="tabItems"
      default-value="queue"
      class="w-full"
      :ui="{ list: 'w-full', trigger: 'flex-1 justify-center' }"
    >
      <template #content="{ item }">
        <div class="min-h-[24rem] min-w-0">
          <!-- ==================== QUEUE TAB ==================== -->
          <div
            v-if="item.value === 'queue'"
            class="space-y-5 pt-4"
          >
            <!-- Stats cards -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-(--ui-text-highlighted)">
                    {{ stats.queued }}
                  </div>
                  <div class="text-sm text-(--ui-text-muted)">
                    Queued
                  </div>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-500">
                    {{ stats.sent }}
                  </div>
                  <div class="text-sm text-(--ui-text-muted)">
                    Sent
                  </div>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-red-500">
                    {{ stats.failed }}
                  </div>
                  <div class="text-sm text-(--ui-text-muted)">
                    Failed
                  </div>
                </div>
              </UCard>
              <UCard>
                <div class="text-center">
                  <div class="text-2xl font-bold text-amber-500">
                    {{ stats.cancelled }}
                  </div>
                  <div class="text-sm text-(--ui-text-muted)">
                    Cancelled
                  </div>
                </div>
              </UCard>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 flex-wrap">
              <UButton
                v-if="isAdmin"
                :label="isActive ? 'Stop Dispatch' : 'Start Dispatch'"
                :color="isActive ? 'error' : 'success'"
                :icon="isActive ? 'i-lucide-pause' : 'i-lucide-play'"
                :loading="togglingActive"
                :disabled="togglingActive"
                @click="toggleActive"
              />
              <UButton
                label="Dispatch Now"
                icon="i-lucide-send"
                color="primary"
                variant="soft"
                :loading="dispatching"
                :disabled="!config?.endpointUrl || !config?.isActive || stats.queued === 0 || dispatching"
                @click="handleDispatch"
              />
              <UButton
                v-if="isAdmin"
                label="Retry Failed"
                icon="i-lucide-refresh-cw"
                variant="soft"
                :disabled="stats.failed === 0 || retryingAll"
                :loading="retryingAll"
                @click="handleRetryAll"
              />
              <UButton
                v-if="isAdmin"
                label="Clear All"
                icon="i-lucide-trash-2"
                variant="soft"
                color="error"
                :disabled="events.length === 0 || clearingAll"
                :loading="clearingAll"
                @click="showClearConfirm = true"
              />
              <UButton
                label="Refresh"
                icon="i-lucide-rotate-cw"
                variant="ghost"
                :loading="loading || refreshing"
                :disabled="refreshing"
                @click="handleRefresh"
              />
            </div>

            <!-- Event list — always-present border box keeps Queue tab full width -->
            <div class="border border-(--ui-border) rounded-lg">
              <div
                v-if="events.length === 0"
                class="text-center py-8 text-(--ui-text-muted)"
              >
                No events in the queue yet. Events appear here as actions occur in the app.
              </div>
              <div
                v-else
                class="divide-y divide-(--ui-border)"
              >
                <div
                  v-for="evt in events"
                  :key="evt.id"
                  class="py-3 px-4 flex items-start gap-3"
                >
                  <UBadge
                    :color="statusColor(evt.status)"
                    variant="subtle"
                    size="sm"
                    class="mt-0.5 shrink-0"
                  >
                    {{ evt.status }}
                  </UBadge>

                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">
                      {{ evt.summary }}
                    </div>
                    <div class="text-xs text-(--ui-text-muted) mt-0.5">
                      {{ formatEventLabel(evt.eventType) }} · {{ new Date(evt.createdAt).toLocaleString() }}
                      <span v-if="evt.sentAt"> · Sent {{ new Date(evt.sentAt).toLocaleString() }}</span>
                      <span
                        v-if="evt.lastError"
                        class="text-red-500"
                      > · {{ evt.lastError }}</span>
                      <span v-if="evt.retryCount > 0"> · {{ evt.retryCount }} retries</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1 shrink-0">
                    <UButton
                      v-if="evt.status === 'queued' || evt.status === 'failed' || evt.status === 'cancelled'"
                      icon="i-lucide-send"
                      variant="ghost"
                      size="xs"
                      title="Dispatch this event now"
                      @click="dispatchSingle(evt)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      variant="ghost"
                      color="error"
                      size="xs"
                      @click="handleDeleteEvent(evt.id)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ==================== CONFIG TAB ==================== -->
          <div
            v-if="item.value === 'config'"
            class="space-y-5 pt-4"
          >
            <div class="space-y-4">
              <UFormField label="Endpoint URL">
                <UInput
                  v-model="endpointUrl"
                  placeholder="https://example.com/webhook"
                  class="w-full"
                  :disabled="!isAdmin"
                />
              </UFormField>

              <UFormField label="Enabled Event Types">
                <p class="text-xs text-(--ui-text-muted) mb-2">
                  Controls which queued events get auto-dispatched to your endpoint. All events are always recorded to the queue. Changing this only affects future dispatches — use the send button on individual events to manually fire past ones.
                </p>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label
                    v-for="evtItem in eventTypeItems"
                    :key="evtItem.value"
                    class="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <UCheckbox
                      :model-value="enabledTypes.includes(evtItem.value)"
                      :disabled="!isAdmin"
                      @update:model-value="(checked: boolean | 'indeterminate') => {
                        if (checked === true) {
                          enabledTypes.push(evtItem.value)
                        }
                        else {
                          enabledTypes = enabledTypes.filter(t => t !== evtItem.value)
                        }
                      }"
                    />
                    {{ evtItem.label }}
                  </label>
                </div>
              </UFormField>

              <div
                v-if="isAdmin"
                class="flex items-center gap-2"
              >
                <UButton
                  label="Save Configuration"
                  color="primary"
                  :disabled="!configDirty || savingConfig"
                  :loading="savingConfig"
                  @click="saveConfig"
                />
                <UButton
                  v-if="configDirty"
                  label="Reset"
                  variant="ghost"
                  @click="syncFormFromConfig"
                />
              </div>
            </div>
          </div>

          <!-- ==================== DEVELOPER TAB ==================== -->
          <div
            v-if="item.value === 'developer'"
            class="space-y-6 pt-4 min-w-0"
          >
            <!-- Send Test Event -->
            <div>
              <h3 class="text-base font-semibold mb-2">
                Send Test Event
              </h3>
              <p class="text-sm text-(--ui-text-muted) mb-3">
                Queue a test event with realistic sample data. Useful for verifying your endpoint receives and parses events correctly.
              </p>
              <div class="flex items-end gap-3">
                <UFormField
                  label="Event Type"
                  class="flex-1"
                >
                  <USelect
                    v-model="testEventType"
                    :items="eventTypeItems"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  label="Send Test"
                  icon="i-lucide-flask-conical"
                  color="primary"
                  variant="soft"
                  :loading="sendingTest"
                  :disabled="sendingTest"
                  @click="sendTestEvent"
                />
              </div>
            </div>

            <USeparator />

            <!-- HTTP format overview -->
            <div>
              <h3 class="text-base font-semibold mb-2">
                Dispatched HTTP Format
              </h3>
              <p class="text-sm text-(--ui-text-muted) mb-3">
                Each event is sent as a POST request to your configured endpoint with this shape:
              </p>
              <pre class="text-xs bg-(--ui-bg-elevated) rounded-lg p-4 overflow-x-auto max-w-[calc(100vw-3rem)] sm:max-w-none"><code>{
  "event": "part_advanced",        // event type identifier
  "summary": "SN-00042 advanced…", // human-readable one-liner
  "timestamp": "2024-01-15T…",     // ISO 8601 — when the event was created
  // …plus all payload fields spread at the top level
  "user": "Jane Doe",
  "partId": "SN-00042",
  "fromStep": "Machining",
  "toStep": "Inspection"
}</code></pre>
              <p class="text-xs text-(--ui-text-muted) mt-2">
                <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded">event</code>,
                <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded">summary</code>, and
                <code class="bg-(--ui-bg-elevated) px-1 py-0.5 rounded">timestamp</code>
                are always present. All other fields come from the event-specific payload below.
              </p>
            </div>

            <USeparator />

            <!-- Per-event-type payload docs -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-base font-semibold">
                  Event Payloads
                </h3>
              </div>
              <div class="space-y-4">
                <div
                  v-for="doc in eventPayloadDocs"
                  :key="doc.type"
                  class="border border-(--ui-border) rounded-lg overflow-hidden"
                >
                  <div class="bg-(--ui-bg-elevated) px-4 py-2 flex items-center gap-2">
                    <code class="text-sm font-mono font-semibold">{{ doc.type }}</code>
                    <span class="text-xs text-(--ui-text-muted)">{{ doc.description }}</span>
                  </div>
                  <div class="overflow-x-auto max-w-[calc(100vw-3rem)] sm:max-w-none">
                    <table class="min-w-[28rem] w-full text-sm">
                      <thead>
                        <tr class="border-b border-(--ui-border) text-left">
                          <th class="px-4 py-2 font-medium text-(--ui-text-muted)">
                            Field
                          </th>
                          <th class="px-4 py-2 font-medium text-(--ui-text-muted)">
                            Type
                          </th>
                          <th class="px-4 py-2 font-medium text-(--ui-text-muted)">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="field in doc.fields"
                          :key="field.name"
                          class="border-b border-(--ui-border) last:border-b-0"
                        >
                          <td class="px-4 py-1.5">
                            <code class="text-xs font-mono">{{ field.name }}</code>
                          </td>
                          <td class="px-4 py-1.5 text-(--ui-text-muted)">
                            <code class="text-xs">{{ field.type }}</code>
                          </td>
                          <td class="px-4 py-1.5 text-(--ui-text-muted)">
                            {{ field.description }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- Batch note -->
            <div class="p-3 bg-(--ui-bg-elevated) rounded-lg">
              <p class="text-sm text-(--ui-text-muted)">
                <span class="font-medium text-(--ui-text-highlighted)">Batch operations:</span>
                When multiple parts are advanced at once (e.g. via the work queue), a single
                <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">part_advanced</code> event is emitted with
                <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">partIds</code> (string array) instead of
                <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">partId</code>, plus
                <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">advancedCount</code> and
                <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">failedCount</code> fields.
              </p>
            </div>

            <!-- Integration tips -->
            <div class="p-3 bg-(--ui-bg-elevated) rounded-lg space-y-2">
              <p class="text-sm font-medium text-(--ui-text-highlighted)">
                Integration tips
              </p>
              <ul class="text-sm text-(--ui-text-muted) list-disc list-inside space-y-1">
                <li>Dispatch runs while the webhooks page is open — events are sent automatically when dispatch is active.</li>
                <li>Events are dispatched client-side from the browser, so your endpoint must be reachable from the user's network.</li>
                <li>All events are always recorded to the queue. The "Enabled Event Types" config controls which get auto-dispatched.</li>
                <li>Changing enabled types only affects future auto-dispatches. Use the per-event send button to manually fire past events.</li>
                <li>Use the <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">event</code> field to route/filter in your handler.</li>
                <li>Failed events can be retried — your endpoint should be idempotent.</li>
                <li>The OpenAPI spec at <code class="text-xs bg-(--ui-bg) px-1 py-0.5 rounded">/_scalar</code> documents all webhook API routes.</li>
              </ul>
            </div>
          </div>
        </div>
      </template>
    </UTabs>

    <!-- Clear All Confirmation Modal -->
    <UModal v-model:open="showClearConfirm">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Clear All Events
            </h3>
          </template>
          <p class="text-sm text-(--ui-text-muted)">
            This will permanently delete all {{ events.length }} webhook events from the queue. This action cannot be undone.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="showClearConfirm = false"
              />
              <UButton
                label="Clear All Events"
                color="error"
                :loading="clearingAll"
                :disabled="clearingAll"
                @click="handleClearAll"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
