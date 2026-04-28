<script setup lang="ts">
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
} = useWebhookEvents()

const { isAdmin: _isAdmin } = useAuth()

// Local form state
const endpointUrl = ref('')
const enabledTypes = ref<WebhookEventType[]>([])
const isActive = ref(false)
const configDirty = ref(false)

// Dispatch interval
let dispatchInterval: ReturnType<typeof setInterval> | null = null

// Event type options for the multi-select
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

async function saveConfig() {
  await updateConfig({
    endpointUrl: endpointUrl.value,
    enabledEventTypes: enabledTypes.value,
    isActive: isActive.value,
  })
  configDirty.value = false
}

async function toggleActive() {
  isActive.value = !isActive.value
  await saveConfig()
  if (isActive.value) {
    startDispatchLoop()
  } else {
    stopDispatchLoop()
  }
}

function startDispatchLoop() {
  if (dispatchInterval) return
  // Dispatch immediately, then every 10 seconds
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

// Status badge color
function statusColor(status: string): 'info' | 'success' | 'error' | 'neutral' {
  switch (status) {
    case 'queued': return 'info'
    case 'sent': return 'success'
    case 'failed': return 'error'
    default: return 'neutral'
  }
}

// Init
onMounted(async () => {
  await Promise.all([fetchConfig(), fetchEvents(), fetchStats()])
  syncFormFromConfig()
  // Auto-start dispatch loop if active
  if (config.value?.isActive) {
    startDispatchLoop()
  }
})

onUnmounted(() => {
  stopDispatchLoop()
})

// Auto-refresh events every 15s while page is open
const refreshInterval = setInterval(() => {
  fetchEvents()
  fetchStats()
}, 15000)

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Webhook Events
      </h1>
      <div class="flex items-center gap-2">
        <UBadge
          :color="isActive ? 'success' : 'neutral'"
          variant="subtle"
          size="lg"
        >
          {{ isActive ? 'Active' : 'Paused' }}
        </UBadge>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-3 gap-4">
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
    </div>

    <!-- Error banner -->
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
      :close-button="{ onClick: () => (error = null) }"
    />

    <!-- Configuration -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            Configuration
          </h2>
          <div class="flex items-center gap-2">
            <UButton
              :label="isActive ? 'Stop' : 'Start'"
              :color="isActive ? 'error' : 'success'"
              :icon="isActive ? 'i-lucide-pause' : 'i-lucide-play'"
              size="sm"
              @click="toggleActive"
            />
          </div>
        </div>
      </template>

      <div class="space-y-4">
        <UFormField label="Endpoint URL">
          <UInput
            v-model="endpointUrl"
            placeholder="https://example.com/webhook"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Enabled Event Types">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label
              v-for="item in eventTypeItems"
              :key="item.value"
              class="flex items-center gap-2 text-sm cursor-pointer"
            >
              <UCheckbox
                :model-value="enabledTypes.includes(item.value)"
                @update:model-value="(checked: boolean | 'indeterminate') => {
                  if (checked === true) {
                    enabledTypes.push(item.value)
                  }
                  else {
                    enabledTypes = enabledTypes.filter(t => t !== item.value)
                  }
                }"
              />
              {{ item.label }}
            </label>
          </div>
        </UFormField>

        <div class="flex items-center gap-2">
          <UButton
            label="Save Configuration"
            color="primary"
            :disabled="!configDirty"
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
    </UCard>

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-wrap">
      <UButton
        label="Dispatch Now"
        icon="i-lucide-send"
        color="primary"
        :loading="dispatching"
        :disabled="!config?.endpointUrl || !config?.isActive || stats.queued === 0"
        @click="dispatchQueued"
      />
      <UButton
        label="Retry All Failed"
        icon="i-lucide-refresh-cw"
        variant="soft"
        :disabled="stats.failed === 0"
        @click="retryAllFailed"
      />
      <UButton
        label="Clear All"
        icon="i-lucide-trash-2"
        variant="soft"
        color="error"
        :disabled="events.length === 0"
        @click="clearAllEvents"
      />
      <UButton
        label="Refresh"
        icon="i-lucide-rotate-cw"
        variant="ghost"
        :loading="loading"
        @click="() => { fetchEvents(); fetchStats() }"
      />
    </div>

    <!-- Event Queue -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">
          Event Queue
        </h2>
      </template>

      <div
        v-if="events.length === 0"
        class="text-center py-8 text-(--ui-text-muted)"
      >
        No events in the queue yet. Events will appear here as actions occur in the app.
      </div>

      <div
        v-else
        class="divide-y divide-(--ui-border)"
      >
        <div
          v-for="evt in events"
          :key="evt.id"
          class="py-3 flex items-start gap-3"
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

          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            @click="deleteEvent(evt.id)"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
