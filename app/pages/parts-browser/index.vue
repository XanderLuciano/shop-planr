<script setup lang="ts">
import type { PartBrowserFilters } from '~/composables/usePartBrowser'
import type { EnrichedPart } from '~/types/computed'

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

// Filter bar model refs
const searchInput = ref('')
const selectedJob = ref(SELECT_ALL)
const selectedPath = ref(SELECT_ALL)
const selectedStep = ref(SELECT_ALL)
const selectedStatus = ref<PartBrowserFilters['status'] | undefined>('all')
const selectedAssignee = ref(SELECT_ALL)

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

// Sync filter refs to composable
watch([selectedJob, selectedPath, selectedStep, selectedStatus, selectedAssignee], () => {
  filters.value = {
    jobName: selectedAllOrUndefined(selectedJob.value),
    pathName: selectedAllOrUndefined(selectedPath.value),
    stepName: selectedAllOrUndefined(selectedStep.value),
    status: selectedStatus.value || undefined,
    assignee: selectedAllOrUndefined(selectedAssignee.value),
  }
})

const filtersActive = computed(() =>
  searchQuery.value.trim().length > 0
  || selectedJob.value !== SELECT_ALL
  || selectedPath.value !== SELECT_ALL
  || selectedStep.value !== SELECT_ALL
  || selectedStatus.value !== 'all'
  || selectedAssignee.value !== SELECT_ALL,
)

function handleSelect(part: EnrichedPart) {
  navigateTo(`/parts-browser/${encodeURIComponent(part.id)}`)
}

onMounted(() => {
  fetchParts()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-6xl">
    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
      Parts Browser
    </h1>

    <PartBrowserFilterBar
      v-model:search="searchInput"
      v-model:job="selectedJob"
      v-model:path="selectedPath"
      v-model:step="selectedStep"
      v-model:status="selectedStatus"
      v-model:assignee="selectedAssignee"
      :parts="parts"
    />

    <div
      v-if="filtersActive"
      class="text-xs text-(--ui-text-muted)"
    >
      Showing {{ filteredCount }} of {{ totalCount }} parts
    </div>

    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted) py-8"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading parts...
    </div>

    <div
      v-else-if="error"
      class="flex items-center gap-2 text-xs text-(--ui-error)"
    >
      <span>{{ error }}</span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        label="Retry"
        @click="fetchParts"
      />
    </div>

    <template v-if="!loading && !error">
      <PartBrowserTable
        :parts="filteredParts"
        :sort-column="sortColumn"
        :sort-direction="sortDirection"
        @sort="(key: string) => setSort(key as keyof EnrichedPart)"
        @select="handleSelect"
      />
      <PartBrowserCards
        :parts="filteredParts"
        @select="handleSelect"
      />
    </template>
  </div>
</template>
