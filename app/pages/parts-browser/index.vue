<script setup lang="ts">
const {
  parts,
  loading,
  error,
  searchQuery,
  filters,
  sortColumn,
  sortDirection,
  filteredParts,
  totalCount,
  filteredCount,
  fetchParts,
  setSort,
} = usePartBrowser()

// Debounced search
const searchInput = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

// Unique values for filter dropdowns (derived from fetched data)
const jobOptions = computed(() => {
  const names = [...new Set(parts.value.map(s => s.jobName))].sort()
  return [{ label: 'All Jobs', value: '__all__' }, ...names.map(n => ({ label: n, value: n }))]
})
const pathOptions = computed(() => {
  const names = [...new Set(parts.value.map(s => s.pathName))].sort()
  return [{ label: 'All Paths', value: '__all__' }, ...names.map(n => ({ label: n, value: n }))]
})
const stepOptions = computed(() => {
  const names = [...new Set(parts.value.map(s => s.currentStepName))].sort()
  return [{ label: 'All Steps', value: '__all__' }, ...names.map(n => ({ label: n, value: n }))]
})
const statusOptions = [
  { label: 'All Statuses', value: 'all' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
]
const assigneeOptions = computed(() => {
  const names = [...new Set(parts.value.map(s => s.assignedTo).filter((v): v is string => !!v))].sort()
  return [
    { label: 'All Assignees', value: '__all__' },
    { label: 'Unassigned', value: 'Unassigned' },
    ...names.map(n => ({ label: n, value: n })),
  ]
})

// Filter model refs
const selectedJob = ref('__all__')
const selectedPath = ref('__all__')
const selectedStep = ref('__all__')
const selectedStatus = ref('all')
const selectedAssignee = ref('__all__')

// Sync filter refs to composable filters
watch([selectedJob, selectedPath, selectedStep, selectedStatus, selectedAssignee], () => {
  filters.value = {
    jobName: selectedJob.value !== '__all__' ? selectedJob.value : undefined,
    pathName: selectedPath.value !== '__all__' ? selectedPath.value : undefined,
    stepName: selectedStep.value !== '__all__' ? selectedStep.value : undefined,
    status: (selectedStatus.value as any) || undefined,
    assignee: selectedAssignee.value !== '__all__' ? selectedAssignee.value : undefined,
  }
})

const filtersActive = computed(() =>
  searchQuery.value.trim().length > 0
  || selectedJob.value !== ''
  || selectedPath.value !== ''
  || selectedStep.value !== ''
  || selectedStatus.value !== 'all'
  || selectedAssignee.value !== '',
)

// Sort indicator helper
function sortIcon(col: string) {
  if (sortColumn.value !== col) return ''
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

const sortableColumns: { key: string, label: string }[] = [
  { key: 'id', label: 'Part' },
  { key: 'jobName', label: 'Job' },
  { key: 'currentStepName', label: 'Step' },
  { key: 'status', label: 'Status' },
  { key: 'assignedTo', label: 'Assignee' },
  { key: 'createdAt', label: 'Created' },
]

onMounted(() => {
  fetchParts()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-6xl">
    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
      Parts Browser
    </h1>

    <!-- Search + Filters row -->
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

    <!-- Count display -->
    <div v-if="filtersActive" class="text-xs text-(--ui-text-muted)">
      Showing {{ filteredCount }} of {{ totalCount }} parts
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading parts...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center gap-2 text-xs text-(--ui-error)">
      <span>{{ error }}</span>
      <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" label="Retry" @click="fetchParts" />
    </div>

    <!-- Table — desktop -->
    <div v-if="!loading && !error" class="hidden md:block border border-(--ui-border) rounded-md overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-(--ui-bg-elevated)/50 text-xs text-(--ui-text-muted)">
            <th
              v-for="col in sortableColumns"
              :key="col.key"
              class="px-3 py-2 text-left cursor-pointer hover:text-(--ui-text-highlighted) select-none"
              @click="setSort(col.key)"
            >
              {{ col.label }}
              <span v-if="sortColumn === col.key" class="ml-0.5">{{ sortIcon(col.key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--ui-border)">
          <tr
            v-for="s in filteredParts"
            :key="s.id"
            class="cursor-pointer hover:bg-(--ui-bg-elevated)/50 transition-colors"
            @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
          >
            <td class="px-3 py-2 font-medium text-(--ui-text-highlighted)">{{ s.id }}</td>
            <td class="px-3 py-2">{{ s.jobName }}</td>
            <td class="px-3 py-2">{{ s.currentStepName }}</td>
            <td class="px-3 py-2">
              <UBadge
                :color="s.status === 'completed' ? 'success' : 'warning'"
                variant="subtle"
                size="xs"
              >
                {{ s.status === 'completed' ? 'Completed' : 'In Progress' }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-(--ui-text-muted)">{{ s.assignedTo ?? 'Unassigned' }}</td>
            <td class="px-3 py-2 text-(--ui-text-muted)">{{ new Date(s.createdAt).toLocaleDateString() }}</td>
          </tr>
          <tr v-if="filteredParts.length === 0">
            <td colspan="6" class="px-3 py-8 text-center text-(--ui-text-muted)">
              No parts found.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cards — mobile -->
    <div v-if="!loading && !error" class="md:hidden space-y-2">
      <div v-if="filteredParts.length === 0" class="text-sm text-(--ui-text-muted) py-8 text-center">
        No parts found.
      </div>
      <div
        v-for="s in filteredParts"
        :key="s.id"
        class="p-3 rounded-lg border border-(--ui-border) hover:bg-(--ui-bg-elevated)/50 cursor-pointer space-y-1.5"
        role="link"
        tabindex="0"
        @click="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
        @keydown.enter.prevent="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
        @keydown.space.prevent="navigateTo(`/parts-browser/${encodeURIComponent(s.id)}`)"
      >
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm font-medium text-(--ui-text-highlighted)">{{ s.id }}</span>
          <UBadge
            :color="s.status === 'completed' ? 'success' : 'warning'"
            variant="subtle"
            size="xs"
          >
            {{ s.status === 'completed' ? 'Completed' : 'In Progress' }}
          </UBadge>
        </div>
        <div class="text-xs text-(--ui-text-muted)">{{ s.jobName }}</div>
        <div class="flex items-center justify-between text-xs">
          <span>{{ s.currentStepName }}</span>
          <span class="text-(--ui-text-muted)">{{ s.assignedTo ?? 'Unassigned' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
