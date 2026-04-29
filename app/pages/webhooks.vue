<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { WebhookEventType, DeliveryDetail, QueuedDeliveryView } from '~/types/domain'
import { WEBHOOK_EVENT_TYPES } from '~/types/domain'
import { formatDateTime } from '~/utils/dateFormatting'

// ---- Composables ----
const {
  registrations,
  loading,
  error,
  fetchRegistrations,
  createRegistration,
  updateRegistration,
  deleteRegistration,
} = useWebhookRegistrations()

const {
  events,
  loading: eventsLoading,
  error: eventsError,
  fetchEvents,
  deleteEvent,
  clearAllEvents,
} = useWebhookEvents()

const {
  dispatching,
  error: deliveryError,
  dispatchQueued,
  dispatchSingle,
  replayEvent,
  retryFailed,
  updateDeliveryStatus,
  cancelDelivery,
} = useWebhookDeliveries()

const $api = useAuthFetch()
const { isAdmin } = useAuth()

// ---- Tabs ----
const tabItems: TabsItem[] = [
  { label: 'Registrations', icon: 'i-lucide-webhook', value: 'registrations' },
  { label: 'Event Log', icon: 'i-lucide-list', value: 'event-log' },
]

// ---- Registration form state ----
const showForm = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formUrl = ref('')
const formEventTypes = ref<WebhookEventType[]>([])
const formError = ref('')
const saving = ref(false)

// ---- Delete confirmation state ----
const showDeleteConfirm = ref(false)
const deletingRegistration = ref<{ id: string, name: string } | null>(null)
const deleting = ref(false)

// ---- Computed ----
const isEditing = computed(() => editingId.value !== null)
const formValid = computed(() => formName.value.trim().length > 0 && formUrl.value.trim().length > 0)
const allSelected = computed(() => formEventTypes.value.length === WEBHOOK_EVENT_TYPES.length)

function formatEventType(type: string): string {
  return type
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---- Subscribe to all ----
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

// ---- Form actions ----
function resetForm() {
  formName.value = ''
  formUrl.value = ''
  formEventTypes.value = []
  formError.value = ''
  editingId.value = null
  showForm.value = false
}

function openAddForm() {
  resetForm()
  showForm.value = true
}

function openEditForm(reg: { id: string, name: string, url: string, eventTypes: readonly string[] }) {
  editingId.value = reg.id
  formName.value = reg.name
  formUrl.value = reg.url
  formEventTypes.value = [...reg.eventTypes] as WebhookEventType[]
  formError.value = ''
  showForm.value = true
}

async function submitForm() {
  if (!formValid.value || saving.value) return
  formError.value = ''
  saving.value = true

  try {
    if (isEditing.value) {
      await updateRegistration(editingId.value!, {
        name: formName.value.trim(),
        url: formUrl.value.trim(),
        eventTypes: [...formEventTypes.value],
      })
    } else {
      await createRegistration({
        name: formName.value.trim(),
        url: formUrl.value.trim(),
        eventTypes: [...formEventTypes.value],
      })
    }
    resetForm()
  } catch (e: unknown) {
    formError.value = extractApiError(e, isEditing.value ? 'Failed to update registration' : 'Failed to create registration')
  } finally {
    saving.value = false
  }
}

// ---- Delete actions ----
function confirmDelete(reg: { id: string, name: string }) {
  deletingRegistration.value = { id: reg.id, name: reg.name }
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deletingRegistration.value || deleting.value) return
  deleting.value = true
  try {
    await deleteRegistration(deletingRegistration.value.id)
    showDeleteConfirm.value = false
    deletingRegistration.value = null
  } catch {
    // Error is handled by the composable
  } finally {
    deleting.value = false
  }
}

// ---- Event Log state ----
const expandedEvents = ref<Set<string>>(new Set())
const eventDeliveries = ref<Map<string, DeliveryDetail[]>>(new Map())
const loadingDeliveries = ref<Set<string>>(new Set())
const actionLoading = ref<Set<string>>(new Set())
let dispatchInterval: ReturnType<typeof setInterval> | null = null

// ---- Event Log computed ----
const combinedError = computed(() => error.value || eventsError.value || deliveryError.value)

// ---- Event Log helpers ----
function formatTimestamp(iso: string): string {
  return formatDateTime(iso)
}

function deliverySummaryText(summary: { total: number, queued: number, delivering: number, delivered: number, failed: number, canceled: number }): string {
  if (summary.total === 0) return 'No deliveries'
  const parts: string[] = []
  if (summary.delivered > 0) parts.push(`${summary.delivered} delivered`)
  if (summary.failed > 0) parts.push(`${summary.failed} failed`)
  if (summary.queued > 0) parts.push(`${summary.queued} queued`)
  if (summary.delivering > 0) parts.push(`${summary.delivering} delivering`)
  if (summary.canceled > 0) parts.push(`${summary.canceled} canceled`)
  return `${summary.total} Webhook${summary.total !== 1 ? 's' : ''}: ${parts.join(', ')}`
}

function statusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'neutral' {
  switch (status) {
    case 'delivered': return 'success'
    case 'failed': return 'error'
    case 'queued': return 'warning'
    case 'delivering': return 'info'
    case 'canceled': return 'neutral'
    default: return 'neutral'
  }
}

function summaryBadgeColor(summary: { failed: number, queued: number, delivered: number, total: number }): 'success' | 'error' | 'warning' | 'neutral' {
  if (summary.failed > 0) return 'error'
  if (summary.queued > 0) return 'warning'
  if (summary.delivered > 0 && summary.delivered === summary.total) return 'success'
  return 'neutral'
}

// ---- Event expand/collapse ----
async function toggleEventExpand(eventId: string) {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value = new Set([...expandedEvents.value].filter(id => id !== eventId))
    return
  }

  expandedEvents.value = new Set([...expandedEvents.value, eventId])

  // Fetch deliveries for this event if not already loaded
  if (!eventDeliveries.value.has(eventId)) {
    loadingDeliveries.value = new Set([...loadingDeliveries.value, eventId])
    try {
      const deliveries = await $api<DeliveryDetail[]>(`/api/webhooks/events/${encodeURIComponent(eventId)}/deliveries`)
      eventDeliveries.value = new Map([...eventDeliveries.value, [eventId, deliveries]])
    } catch {
      // Silently handle — the expand will show empty
    } finally {
      loadingDeliveries.value = new Set([...loadingDeliveries.value].filter(id => id !== eventId))
    }
  }
}

// ---- Event-level actions ----
async function handleReplayAll(eventId: string) {
  actionLoading.value = new Set([...actionLoading.value, `replay-${eventId}`])
  try {
    await replayEvent(eventId)
    await refreshEventLog()
    // Refresh expanded deliveries if open
    if (expandedEvents.value.has(eventId)) {
      await refreshEventDeliveries(eventId)
    }
  } finally {
    actionLoading.value = new Set([...actionLoading.value].filter(id => id !== `replay-${eventId}`))
  }
}

async function handleRetryFailed(eventId: string) {
  actionLoading.value = new Set([...actionLoading.value, `retry-${eventId}`])
  try {
    await retryFailed(eventId)
    await refreshEventLog()
    if (expandedEvents.value.has(eventId)) {
      await refreshEventDeliveries(eventId)
    }
  } finally {
    actionLoading.value = new Set([...actionLoading.value].filter(id => id !== `retry-${eventId}`))
  }
}

async function handleDeleteEvent(eventId: string) {
  await deleteEvent(eventId)
  expandedEvents.value = new Set([...expandedEvents.value].filter(id => id !== eventId))
  eventDeliveries.value.delete(eventId)
}

// ---- Delivery-level actions ----
async function handleRetryDelivery(deliveryId: string, eventId: string) {
  actionLoading.value = new Set([...actionLoading.value, `delivery-${deliveryId}`])
  try {
    await updateDeliveryStatus(deliveryId, 'queued')
    await refreshEventLog()
    await refreshEventDeliveries(eventId)
  } finally {
    actionLoading.value = new Set([...actionLoading.value].filter(id => id !== `delivery-${deliveryId}`))
  }
}

async function handleCancelDelivery(deliveryId: string, eventId: string) {
  actionLoading.value = new Set([...actionLoading.value, `delivery-${deliveryId}`])
  try {
    await cancelDelivery(deliveryId)
    await refreshEventLog()
    await refreshEventDeliveries(eventId)
  } finally {
    actionLoading.value = new Set([...actionLoading.value].filter(id => id !== `delivery-${deliveryId}`))
  }
}

async function handleFireDelivery(delivery: DeliveryDetail, eventId: string) {
  actionLoading.value = new Set([...actionLoading.value, `delivery-${delivery.id}`])
  try {
    // Build a minimal QueuedDeliveryView for dispatchSingle
    const evt = events.value.find(e => e.id === eventId)
    if (!evt) return
    const queuedView: QueuedDeliveryView = {
      id: delivery.id,
      eventId,
      registrationId: delivery.registrationId,
      registrationName: delivery.registrationName,
      registrationUrl: delivery.registrationUrl,
      eventType: evt.eventType,
      payload: evt.payload,
      summary: evt.summary,
      eventCreatedAt: evt.createdAt,
    }
    await dispatchSingle(queuedView)
    await refreshEventLog()
    await refreshEventDeliveries(eventId)
  } finally {
    actionLoading.value = new Set([...actionLoading.value].filter(id => id !== `delivery-${delivery.id}`))
  }
}

// ---- Refresh helpers ----
async function refreshEventLog() {
  await fetchEvents()
}

async function refreshEventDeliveries(eventId: string) {
  try {
    const deliveries = await $api<DeliveryDetail[]>(`/api/webhooks/events/${encodeURIComponent(eventId)}/deliveries`)
    eventDeliveries.value = new Map([...eventDeliveries.value, [eventId, deliveries]])
  } catch {
    // Silently handle
  }
}

// ---- Dispatch loop ----
function startDispatchLoop() {
  if (dispatchInterval) return
  dispatchInterval = setInterval(async () => {
    if (!dispatching.value) {
      await dispatchQueued()
      await fetchEvents()
    }
  }, 5000)
}

function stopDispatchLoop() {
  if (dispatchInterval) {
    clearInterval(dispatchInterval)
    dispatchInterval = null
  }
}

// ---- Init ----
onMounted(async () => {
  await fetchRegistrations()
  await fetchEvents()
  startDispatchLoop()
})

onUnmounted(() => {
  stopDispatchLoop()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Webhooks
      </h1>
    </div>

    <!-- Error banner -->
    <UAlert
      v-if="combinedError"
      color="error"
      variant="subtle"
      :title="combinedError"
    />

    <!-- Tabs -->
    <UTabs
      :items="tabItems"
      default-value="registrations"
      class="w-full"
      :ui="{ list: 'w-full', trigger: 'flex-1 justify-center' }"
    >
      <template #content="{ item }">
        <div class="min-h-[24rem] min-w-0">
          <!-- ==================== REGISTRATIONS TAB ==================== -->
          <div
            v-if="item.value === 'registrations'"
            class="space-y-5 pt-4"
          >
            <!-- Add Registration button -->
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-(--ui-text-muted)">
                {{ registrations.length }} registration{{ registrations.length !== 1 ? 's' : '' }}
              </span>
              <UButton
                v-if="isAdmin && !showForm"
                label="Add Registration"
                icon="i-lucide-plus"
                size="sm"
                @click="openAddForm"
              />
            </div>

            <!-- Registration form (add / edit) -->
            <div
              v-if="showForm"
              class="border border-(--ui-border) rounded-lg p-4 space-y-4 bg-(--ui-bg-elevated)/50"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-(--ui-text-highlighted)">
                  {{ isEditing ? 'Edit Registration' : 'New Registration' }}
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
                  placeholder="e.g. Production Tracker"
                  class="w-full"
                />
                <template
                  v-if="formName.length === 0 && showForm"
                  #hint
                >
                  <span class="text-xs text-(--ui-text-muted)">Required</span>
                </template>
              </UFormField>

              <!-- URL -->
              <UFormField label="Endpoint URL">
                <UInput
                  v-model="formUrl"
                  placeholder="https://example.com/webhook"
                  class="w-full"
                />
                <template
                  v-if="formUrl.length === 0 && showForm"
                  #hint
                >
                  <span class="text-xs text-(--ui-text-muted)">Required</span>
                </template>
              </UFormField>

              <!-- Event types -->
              <UFormField label="Event Types">
                <div class="space-y-2">
                  <!-- Subscribe to all -->
                  <label class="flex items-center gap-2 text-sm font-medium cursor-pointer pb-1 border-b border-(--ui-border)">
                    <UCheckbox
                      :model-value="allSelected"
                      @update:model-value="toggleSubscribeAll"
                    />
                    Subscribe to all
                  </label>

                  <!-- Individual event types -->
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
                  :label="isEditing ? 'Save Changes' : 'Create Registration'"
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
              v-if="loading && registrations.length === 0"
              class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8 justify-center"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="animate-spin size-4"
              />
              Loading registrations...
            </div>

            <!-- Registration list -->
            <div class="border border-(--ui-border) rounded-lg">
              <div
                v-if="registrations.length === 0 && !loading"
                class="text-center py-8 text-(--ui-text-muted)"
              >
                No webhook registrations yet. Add one to start receiving events.
              </div>
              <div
                v-else
                class="divide-y divide-(--ui-border)"
              >
                <div
                  v-for="reg in registrations"
                  :key="reg.id"
                  class="py-3 px-4 flex items-start gap-3"
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm text-(--ui-text-highlighted)">
                      {{ reg.name }}
                    </div>
                    <div class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
                      {{ reg.url }}
                    </div>
                    <div class="mt-1">
                      <UBadge
                        variant="subtle"
                        color="neutral"
                        size="xs"
                      >
                        {{ reg.eventTypes.length }} event{{ reg.eventTypes.length !== 1 ? 's' : '' }}
                      </UBadge>
                    </div>
                  </div>

                  <div
                    v-if="isAdmin"
                    class="flex items-center gap-1 shrink-0"
                  >
                    <UButton
                      icon="i-lucide-pencil"
                      variant="ghost"
                      size="xs"
                      title="Edit registration"
                      @click="openEditForm(reg)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      variant="ghost"
                      color="error"
                      size="xs"
                      title="Delete registration"
                      @click="confirmDelete(reg)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ==================== EVENT LOG TAB ==================== -->
          <div
            v-if="item.value === 'event-log'"
            class="space-y-5 pt-4"
          >
            <!-- Event log error banner -->
            <UAlert
              v-if="eventsError || deliveryError"
              color="error"
              variant="subtle"
              :title="eventsError || deliveryError || 'An error occurred'"
            />

            <!-- Event log toolbar -->
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-(--ui-text-muted)">
                  {{ events.length }} event{{ events.length !== 1 ? 's' : '' }}
                </span>
                <UBadge
                  v-if="dispatching"
                  variant="subtle"
                  color="info"
                  size="xs"
                >
                  <UIcon
                    name="i-lucide-loader-2"
                    class="animate-spin size-3 mr-1"
                  />
                  Dispatching
                </UBadge>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  label="Refresh"
                  icon="i-lucide-refresh-cw"
                  variant="ghost"
                  size="xs"
                  :loading="eventsLoading"
                  @click="refreshEventLog"
                />
                <UButton
                  v-if="isAdmin && events.length > 0"
                  label="Clear All"
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  @click="clearAllEvents"
                />
              </div>
            </div>

            <!-- Loading state -->
            <div
              v-if="eventsLoading && events.length === 0"
              class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8 justify-center"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="animate-spin size-4"
              />
              Loading events...
            </div>

            <!-- Empty state -->
            <div
              v-else-if="events.length === 0"
              class="text-center py-12 text-(--ui-text-muted)"
            >
              <UIcon
                name="i-lucide-inbox"
                class="size-8 mb-2"
              />
              <p>No webhook events recorded yet.</p>
            </div>

            <!-- Event list -->
            <div
              v-else
              class="border border-(--ui-border) rounded-lg divide-y divide-(--ui-border)"
            >
              <div
                v-for="evt in events"
                :key="evt.id"
              >
                <!-- Event row (clickable to expand) -->
                <div
                  class="py-3 px-4 cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors"
                  @click="toggleEventExpand(evt.id)"
                >
                  <div class="flex items-start gap-3">
                    <!-- Expand icon -->
                    <UIcon
                      :name="expandedEvents.has(evt.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="size-4 mt-0.5 shrink-0 text-(--ui-text-muted)"
                    />

                    <!-- Event info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-sm text-(--ui-text-highlighted)">
                          {{ formatEventType(evt.eventType) }}
                        </span>
                        <UBadge
                          v-if="evt.deliverySummary.total > 0"
                          :color="summaryBadgeColor(evt.deliverySummary)"
                          variant="subtle"
                          size="xs"
                        >
                          {{ deliverySummaryText(evt.deliverySummary) }}
                        </UBadge>
                        <UBadge
                          v-else
                          color="neutral"
                          variant="subtle"
                          size="xs"
                        >
                          No deliveries
                        </UBadge>
                      </div>
                      <p class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
                        {{ evt.summary }}
                      </p>
                      <p class="text-xs text-(--ui-text-dimmed) mt-0.5">
                        {{ formatTimestamp(evt.createdAt) }}
                      </p>
                    </div>

                    <!-- Event-level actions -->
                    <div
                      v-if="isAdmin"
                      class="flex items-center gap-1 shrink-0"
                      @click.stop
                    >
                      <UButton
                        v-if="evt.deliverySummary.total > 0"
                        label="Replay all"
                        icon="i-lucide-repeat"
                        variant="ghost"
                        size="xs"
                        :loading="actionLoading.has(`replay-${evt.id}`)"
                        :disabled="actionLoading.has(`replay-${evt.id}`)"
                        title="Create new deliveries for all matching registrations"
                        @click="handleReplayAll(evt.id)"
                      />
                      <UButton
                        v-if="evt.deliverySummary.failed > 0"
                        label="Retry failed"
                        icon="i-lucide-rotate-ccw"
                        variant="ghost"
                        color="warning"
                        size="xs"
                        :loading="actionLoading.has(`retry-${evt.id}`)"
                        :disabled="actionLoading.has(`retry-${evt.id}`)"
                        title="Re-queue only failed deliveries"
                        @click="handleRetryFailed(evt.id)"
                      />
                      <UButton
                        icon="i-lucide-trash-2"
                        variant="ghost"
                        color="error"
                        size="xs"
                        title="Delete event"
                        @click="handleDeleteEvent(evt.id)"
                      />
                    </div>
                  </div>
                </div>

                <!-- Expanded delivery details -->
                <div
                  v-if="expandedEvents.has(evt.id)"
                  class="bg-(--ui-bg-elevated)/30 border-t border-(--ui-border)"
                >
                  <!-- Loading deliveries -->
                  <div
                    v-if="loadingDeliveries.has(evt.id)"
                    class="flex items-center gap-2 text-xs text-(--ui-text-muted) py-4 px-8 justify-center"
                  >
                    <UIcon
                      name="i-lucide-loader-2"
                      class="animate-spin size-3"
                    />
                    Loading deliveries...
                  </div>

                  <!-- No deliveries -->
                  <div
                    v-else-if="!eventDeliveries.get(evt.id)?.length"
                    class="text-xs text-(--ui-text-muted) py-4 px-8 text-center"
                  >
                    No delivery records for this event.
                  </div>

                  <!-- Delivery rows -->
                  <div
                    v-else
                    class="divide-y divide-(--ui-border)/50"
                  >
                    <div
                      v-for="delivery in eventDeliveries.get(evt.id)"
                      :key="delivery.id"
                      class="py-2.5 px-8 flex items-start gap-3"
                    >
                      <!-- Delivery info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-medium text-(--ui-text-highlighted)">
                            {{ delivery.registrationName }}
                          </span>
                          <UBadge
                            :color="statusColor(delivery.status)"
                            variant="subtle"
                            size="xs"
                          >
                            {{ delivery.status }}
                          </UBadge>
                        </div>
                        <p class="text-xs text-(--ui-text-muted) mt-0.5 truncate">
                          {{ delivery.registrationUrl }}
                        </p>
                        <p
                          v-if="delivery.error"
                          class="text-xs text-red-500 mt-0.5"
                        >
                          {{ delivery.error }}
                        </p>
                      </div>

                      <!-- Delivery-level actions -->
                      <div
                        v-if="isAdmin"
                        class="flex items-center gap-1 shrink-0"
                      >
                        <!-- Retry: failed → queued -->
                        <UButton
                          v-if="delivery.status === 'failed'"
                          label="Retry"
                          icon="i-lucide-rotate-ccw"
                          variant="ghost"
                          size="xs"
                          :loading="actionLoading.has(`delivery-${delivery.id}`)"
                          :disabled="actionLoading.has(`delivery-${delivery.id}`)"
                          title="Re-queue this delivery"
                          @click="handleRetryDelivery(delivery.id, evt.id)"
                        />
                        <!-- Cancel: queued → canceled -->
                        <UButton
                          v-if="delivery.status === 'queued'"
                          label="Cancel"
                          icon="i-lucide-x"
                          variant="ghost"
                          color="error"
                          size="xs"
                          :loading="actionLoading.has(`delivery-${delivery.id}`)"
                          :disabled="actionLoading.has(`delivery-${delivery.id}`)"
                          title="Cancel this delivery"
                          @click="handleCancelDelivery(delivery.id, evt.id)"
                        />
                        <!-- Fire: immediately dispatch a queued delivery -->
                        <UButton
                          v-if="delivery.status === 'queued'"
                          label="Fire"
                          icon="i-lucide-zap"
                          variant="ghost"
                          color="warning"
                          size="xs"
                          :loading="actionLoading.has(`delivery-${delivery.id}`)"
                          :disabled="actionLoading.has(`delivery-${delivery.id}`)"
                          title="Immediately dispatch this delivery"
                          @click="handleFireDelivery(delivery, evt.id)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UTabs>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">
              Delete Registration
            </h3>
          </template>
          <p class="text-sm text-(--ui-text-muted)">
            Are you sure you want to delete <span class="font-medium text-(--ui-text-highlighted)">{{ deletingRegistration?.name }}</span>?
          </p>
          <p class="text-sm text-(--ui-text-muted) mt-2">
            Any queued deliveries for this registration will be canceled. Delivered and failed records will be preserved as history.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                label="Cancel"
                variant="ghost"
                @click="showDeleteConfirm = false"
              />
              <UButton
                label="Delete Registration"
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
