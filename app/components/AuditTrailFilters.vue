<script setup lang="ts">
import type { AuditAction } from '~/types/domain'
import type { AuditFilters } from '~/composables/useAudit'

const emit = defineEmits<{
  'update:filters': [filters: AuditFilters]
}>()

const actionTypes: { label: string, value: AuditAction | SelectAll }[] = [
  { label: 'All Actions', value: SELECT_ALL },
  { label: 'Cert Attached', value: 'cert_attached' },
  { label: 'Part Created', value: 'part_created' },
  { label: 'Part Advanced', value: 'part_advanced' },
  { label: 'Part Completed', value: 'part_completed' },
  { label: 'Part Scrapped', value: 'part_scrapped' },
  { label: 'Part Force Completed', value: 'part_force_completed' },
  { label: 'Note Created', value: 'note_created' },
  { label: 'Step Override Created', value: 'step_override_created' },
  { label: 'Step Override Reversed', value: 'step_override_reversed' },
  { label: 'Step Deferred', value: 'step_deferred' },
  { label: 'Step Skipped', value: 'step_skipped' },
  { label: 'Deferred Step Completed', value: 'deferred_step_completed' },
  { label: 'Step Waived', value: 'step_waived' },
  { label: 'BOM Edited', value: 'bom_edited' },
]

const selectedAction = ref<AuditAction | SelectAll>(SELECT_ALL)
const userId = ref('')
const partId = ref('')
const jobId = ref('')
const startDate = ref('')
const endDate = ref('')

const { isMobile } = useMobileBreakpoint()
// On mobile the panel collapses to a button until tapped; desktop stays open.
const expanded = ref(false)

const activeFilterCount = computed(() => {
  let n = 0
  if (selectedAction.value !== SELECT_ALL) n++
  if (userId.value.trim()) n++
  if (partId.value.trim()) n++
  if (jobId.value.trim()) n++
  if (startDate.value) n++
  if (endDate.value) n++
  return n
})

const panelVisible = computed(() => !isMobile.value || expanded.value)

function emitFilters() {
  const filters: AuditFilters = {}
  if (selectedAction.value && selectedAction.value !== SELECT_ALL) filters.action = selectedAction.value as AuditAction
  if (userId.value.trim()) filters.userId = userId.value.trim()
  if (partId.value.trim()) filters.partId = partId.value.trim()
  if (jobId.value.trim()) filters.jobId = jobId.value.trim()
  if (startDate.value) filters.startDate = startDate.value
  if (endDate.value) filters.endDate = endDate.value
  emit('update:filters', filters)
}

function clearFilters() {
  selectedAction.value = SELECT_ALL
  userId.value = ''
  partId.value = ''
  jobId.value = ''
  startDate.value = ''
  endDate.value = ''
  emitFilters()
}

watch([selectedAction, userId, partId, jobId, startDate, endDate], emitFilters)
</script>

<template>
  <div class="space-y-2">
    <!-- Mobile toggle header -->
    <div
      v-if="isMobile"
      class="flex items-center justify-between gap-2"
    >
      <UButton
        variant="soft"
        color="neutral"
        size="sm"
        icon="i-lucide-sliders-horizontal"
        :label="expanded ? 'Hide Filters' : 'Filters'"
        data-testid="audit-filters-toggle"
        @click="expanded = !expanded"
      >
        <template
          v-if="activeFilterCount > 0"
          #trailing
        >
          <UBadge
            :label="String(activeFilterCount)"
            size="sm"
            color="primary"
            variant="solid"
          />
        </template>
      </UButton>
      <UButton
        v-if="activeFilterCount > 0"
        variant="ghost"
        size="sm"
        color="neutral"
        label="Clear"
        icon="i-lucide-x"
        data-testid="audit-filters-clear-mobile"
        @click="clearFilters"
      />
    </div>

    <!-- Filter panel -->
    <div
      v-if="panelVisible"
      class="p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30 grid gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-end"
      data-testid="audit-filters-panel"
    >
      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Action Type</label>
        <USelect
          v-model="selectedAction"
          :items="actionTypes"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-full md:w-44"
        />
      </div>

      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">User</label>
        <UInput
          v-model="userId"
          placeholder="User ID..."
          size="xs"
          class="w-full md:w-32"
        />
      </div>

      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Part</label>
        <UInput
          v-model="partId"
          placeholder="Part ID..."
          size="xs"
          class="w-full md:w-32"
        />
      </div>

      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Job</label>
        <UInput
          v-model="jobId"
          placeholder="Job ID..."
          size="xs"
          class="w-full md:w-32"
        />
      </div>

      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Start Date</label>
        <UInput
          v-model="startDate"
          type="date"
          size="xs"
          class="w-full md:w-36"
        />
      </div>

      <div>
        <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">End Date</label>
        <UInput
          v-model="endDate"
          type="date"
          size="xs"
          class="w-full md:w-36"
        />
      </div>

      <UButton
        v-if="!isMobile"
        size="xs"
        variant="ghost"
        label="Clear"
        data-testid="audit-filters-clear-desktop"
        @click="clearFilters"
      />
    </div>
  </div>
</template>
