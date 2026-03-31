<script setup lang="ts">
import type { JiraTicket } from '~/types/jira'
import type { TemplateRoute } from '~/types/domain'
import type { TableColumn } from '@nuxt/ui'

const { tickets, loading, error, fromCache, fetchTickets, linkTicket, refreshTickets } = useJira()
const { settings } = useSettings()
const { templates, fetchTemplates } = useTemplates()
const { jobs, fetchJobs } = useJobs()

// Link modal state
const showLinkModal = ref(false)
const selectedTicket = ref<JiraTicket | null>(null)
const selectedTemplateId = ref<string | undefined>(undefined)
const overrideQuantity = ref<number | undefined>(undefined)
const linking = ref(false)
const linkError = ref('')

// Computed: is Jira enabled?
const jiraEnabled = computed(() => settings.value?.jiraConnection?.enabled ?? false)

// Computed: filter out tickets already linked to jobs
const linkedTicketKeys = computed(() => {
  const keys = new Set<string>()
  for (const job of jobs.value) {
    if (job.jiraTicketKey) {
      keys.add(job.jiraTicketKey)
    }
  }
  return keys
})

const unlinkedTickets = computed(() =>
  tickets.value.filter(t => !linkedTicketKeys.value.has(t.key))
)

// Table columns
const columns: TableColumn<JiraTicket>[] = [
  { accessorKey: 'key', header: 'Key' },
  { accessorKey: 'summary', header: 'Summary' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'priority', header: 'Priority' },
  { accessorKey: 'assignee', header: 'Assignee' },
  { accessorKey: 'partNumber', header: 'Part Number' },
  { accessorKey: 'goalQuantity', header: 'Qty' },
  { accessorKey: 'actions', header: '' },
]

function openLinkModal(ticket: JiraTicket) {
  selectedTicket.value = ticket
  selectedTemplateId.value = undefined
  overrideQuantity.value = ticket.goalQuantity ?? undefined
  linkError.value = ''
  showLinkModal.value = true
}

async function confirmLink() {
  if (!selectedTicket.value) return
  linking.value = true
  linkError.value = ''
  try {
    await linkTicket({
      ticketKey: selectedTicket.value.key,
      templateId: selectedTemplateId.value && selectedTemplateId.value !== '__none__' ? selectedTemplateId.value : undefined,
      goalQuantity: overrideQuantity.value || undefined
    })
    showLinkModal.value = false
    selectedTicket.value = null
    // Re-fetch jobs so the filter updates
    await fetchJobs()
  } catch (e: any) {
    linkError.value = e?.data?.message ?? e?.message ?? 'Failed to link ticket'
  } finally {
    linking.value = false
  }
}

onMounted(async () => {
  if (jiraEnabled.value) {
    await Promise.all([fetchTickets(), fetchTemplates(), fetchJobs()])
  }
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-6xl">
    <!-- Jira disabled state -->
    <template v-if="!jiraEnabled">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Jira Integration
      </h1>
      <div class="py-12 text-center space-y-3">
        <UIcon
          name="i-lucide-plug-zap"
          class="size-10 text-(--ui-text-muted) mx-auto"
        />
        <p class="text-sm text-(--ui-text-muted)">
          Jira integration is currently disabled.
        </p>
        <NuxtLink to="/settings">
          <UButton
            size="sm"
            variant="outline"
            label="Go to Settings to enable Jira"
            icon="i-lucide-settings"
          />
        </NuxtLink>
      </div>
    </template>

    <!-- Jira enabled state -->
    <template v-else>
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
          Jira Dashboard
        </h1>
        <UButton
          icon="i-lucide-refresh-cw"
          label="Refresh"
          size="sm"
          variant="outline"
          :loading="loading"
          @click="refreshTickets"
        />
      </div>

      <!-- Error banner -->
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="fromCache ? 'Connection issue — showing cached data' : 'Connection Error'"
        :description="error"
        icon="i-lucide-alert-triangle"
      />

      <!-- Loading -->
      <div
        v-if="loading && !tickets.length"
        class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin size-4"
        />
        Fetching Jira tickets...
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!unlinkedTickets.length && !loading"
        class="py-8 text-center text-sm text-(--ui-text-muted)"
      >
        No unlinked Jira tickets found. All open tickets are already linked to jobs, or there are no open tickets.
      </div>

      <!-- Ticket table -->
      <div
        v-else
        class="space-y-2"
      >
        <p class="text-xs text-(--ui-text-muted)">
          {{ unlinkedTickets.length }} open ticket{{ unlinkedTickets.length !== 1 ? 's' : '' }} not yet linked to a job
        </p>
        <UTable
          :data="unlinkedTickets as JiraTicket[]"
          :columns="columns"
          class="text-xs"
        >
          <template #key-cell="{ row }">
            <span class="font-mono text-xs font-medium text-(--ui-color-primary-500)">{{ row.original.key }}</span>
          </template>
          <template #summary-cell="{ row }">
            <span class="text-xs truncate max-w-xs block">{{ row.original.summary }}</span>
          </template>
          <template #status-cell="{ row }">
            <UBadge
              size="xs"
              variant="subtle"
              color="neutral"
            >
              {{ row.original.status || '—' }}
            </UBadge>
          </template>
          <template #priority-cell="{ row }">
            <span class="text-xs">{{ row.original.priority || '—' }}</span>
          </template>
          <template #assignee-cell="{ row }">
            <span class="text-xs">{{ row.original.assignee || '—' }}</span>
          </template>
          <template #partNumber-cell="{ row }">
            <span class="text-xs font-mono">{{ row.original.partNumber || '—' }}</span>
          </template>
          <template #goalQuantity-cell="{ row }">
            <span class="text-xs">{{ row.original.goalQuantity ?? '—' }}</span>
          </template>
          <template #actions-cell="{ row }">
            <UButton
              icon="i-lucide-link"
              label="Link to Job"
              size="xs"
              variant="soft"
              @click="openLinkModal(row.original)"
            />
          </template>
        </UTable>
      </div>
    </template>

    <!-- Link modal -->
    <USlideover v-model:open="showLinkModal">
      <template #title>
        Link Ticket to Job
      </template>
      <template #body>
        <div
          v-if="selectedTicket"
          class="space-y-4 p-1"
        >
          <!-- Ticket info -->
          <div class="space-y-1.5">
            <div class="text-xs text-(--ui-text-muted)">
              Ticket
            </div>
            <div class="text-sm font-medium text-(--ui-text-highlighted)">
              {{ selectedTicket.key }} — {{ selectedTicket.summary }}
            </div>
            <div
              v-if="selectedTicket.partNumber"
              class="text-xs text-(--ui-text-muted)"
            >
              Part: <span class="font-mono">{{ selectedTicket.partNumber }}</span>
            </div>
          </div>

          <USeparator />

          <!-- Template selector -->
          <div class="space-y-1">
            <label class="text-xs font-medium text-(--ui-text-muted)">Apply Template (optional)</label>
            <USelect
              v-model="selectedTemplateId"
              :items="[{ label: 'No template', value: '__none__' }, ...templates.map(t => ({ label: t.name, value: t.id }))]"
              size="sm"
              placeholder="Select a template..."
            />
            <p class="text-xs text-(--ui-text-dimmed)">
              Optionally apply a route template to create a path on the new job.
            </p>
          </div>

          <!-- Goal quantity override -->
          <div class="space-y-1">
            <label class="text-xs font-medium text-(--ui-text-muted)">Goal Quantity</label>
            <UInput
              v-model.number="overrideQuantity"
              type="number"
              size="sm"
              :min="1"
              placeholder="Goal quantity"
              class="max-w-32"
            />
            <p class="text-xs text-(--ui-text-dimmed)">
              Override the quantity from the Jira ticket, or leave as-is.
            </p>
          </div>

          <p
            v-if="linkError"
            class="text-xs text-red-500"
          >
            {{ linkError }}
          </p>

          <div class="flex gap-2 justify-end pt-2">
            <UButton
              variant="ghost"
              size="sm"
              label="Cancel"
              @click="showLinkModal = false"
            />
            <UButton
              size="sm"
              label="Create Job"
              icon="i-lucide-check"
              :loading="linking"
              @click="confirmLink"
            />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
