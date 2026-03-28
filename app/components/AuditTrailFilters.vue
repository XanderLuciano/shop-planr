<script setup lang="ts">
import type { AuditAction } from '~/server/types/domain'
import type { AuditFilters } from '~/composables/useAudit'

const emit = defineEmits<{
  'update:filters': [filters: AuditFilters]
}>()

const actionTypes: { label: string, value: AuditAction | '__all__' }[] = [
  { label: 'All Actions', value: '__all__' },
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

const selectedAction = ref<AuditAction | '__all__'>('__all__')
const userId = ref('')
const partId = ref('')
const jobId = ref('')
const startDate = ref('')
const endDate = ref('')

function emitFilters() {
  const filters: AuditFilters = {}
  if (selectedAction.value && selectedAction.value !== '__all__') filters.action = selectedAction.value as AuditAction
  if (userId.value.trim()) filters.userId = userId.value.trim()
  if (partId.value.trim()) filters.partId = partId.value.trim()
  if (jobId.value.trim()) filters.jobId = jobId.value.trim()
  if (startDate.value) filters.startDate = startDate.value
  if (endDate.value) filters.endDate = endDate.value
  emit('update:filters', filters)
}

function clearFilters() {
  selectedAction.value = '__all__'
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
  <div class="flex flex-wrap items-end gap-3 p-3 border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/30">
    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Action Type</label>
      <USelect
        v-model="selectedAction"
        :items="actionTypes"
        value-key="value"
        label-key="label"
        size="xs"
        class="w-44"
      />
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">User</label>
      <UInput v-model="userId" placeholder="User ID..." size="xs" class="w-32" />
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Part</label>
      <UInput v-model="partId" placeholder="Part ID..." size="xs" class="w-32" />
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Job</label>
      <UInput v-model="jobId" placeholder="Job ID..." size="xs" class="w-32" />
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">Start Date</label>
      <UInput v-model="startDate" type="date" size="xs" class="w-36" />
    </div>

    <div>
      <label class="text-xs font-medium text-(--ui-text-muted) block mb-1">End Date</label>
      <UInput v-model="endDate" type="date" size="xs" class="w-36" />
    </div>

    <UButton size="xs" variant="ghost" label="Clear" @click="clearFilters" />
  </div>
</template>
