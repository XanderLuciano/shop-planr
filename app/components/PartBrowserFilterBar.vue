<script setup lang="ts">
import type { PartBrowserFilters } from '~/composables/usePartBrowser'
import type { EnrichedPart } from '~/types/computed'

const props = defineProps<{
  parts: readonly Readonly<EnrichedPart>[]
}>()

const searchInput = defineModel<string>('search', { default: '' })
const selectedJob = defineModel<string>('job', { default: SELECT_ALL })
const selectedPath = defineModel<string>('path', { default: SELECT_ALL })
const selectedStep = defineModel<string>('step', { default: SELECT_ALL })
const selectedStatus = defineModel<PartBrowserFilters['status'] | undefined>('status', { default: 'all' })
const selectedAssignee = defineModel<string>('assignee', { default: SELECT_ALL })

const { users } = useAuth()

const userDisplayMap = computed(() => {
  const map = new Map<string, string>()
  for (const u of users.value) {
    map.set(u.id, u.displayName)
  }
  return map
})

const jobOptions = computed(() => {
  const names = [...new Set(props.parts.map(s => s.jobName))].sort()
  return [{ label: 'All Jobs', value: SELECT_ALL }, ...names.map(n => ({ label: n, value: n }))]
})
const pathOptions = computed(() => {
  const names = [...new Set(props.parts.map(s => s.pathName))].sort()
  return [{ label: 'All Paths', value: SELECT_ALL }, ...names.map(n => ({ label: n, value: n }))]
})
const stepOptions = computed(() => {
  const names = [...new Set(props.parts.map(s => s.currentStepName))].sort()
  return [{ label: 'All Steps', value: SELECT_ALL }, ...names.map(n => ({ label: n, value: n }))]
})
const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Scrapped', value: 'scrapped' },
]
const assigneeOptions = computed(() => {
  const ids = [...new Set(props.parts.map(s => s.assignedTo).filter((v): v is string => !!v))].sort()
  return [
    { label: 'All Assignees', value: SELECT_ALL },
    { label: 'Unassigned', value: 'Unassigned' },
    ...ids.map(id => ({ label: userDisplayMap.value.get(id) ?? id, value: id })),
  ]
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-2">
    <UInput
      v-model="searchInput"
      size="sm"
      placeholder="Search by part ID..."
      icon="i-lucide-search"
      class="w-full md:w-56"
    />
    <select
      v-model="selectedJob"
      class="text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1.5 text-(--ui-text-highlighted)"
    >
      <option v-for="o in jobOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <select
      v-model="selectedPath"
      class="text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1.5 text-(--ui-text-highlighted)"
    >
      <option v-for="o in pathOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <select
      v-model="selectedStep"
      class="text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1.5 text-(--ui-text-highlighted)"
    >
      <option v-for="o in stepOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <select
      v-model="selectedStatus"
      class="text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1.5 text-(--ui-text-highlighted)"
    >
      <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <select
      v-model="selectedAssignee"
      class="text-xs rounded-md border border-(--ui-border) bg-(--ui-bg) px-2 py-1.5 text-(--ui-text-highlighted)"
    >
      <option v-for="o in assigneeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>
