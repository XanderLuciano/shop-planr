<script setup lang="ts">
import type { WorkQueueJob } from '~/server/types/computed'

const { loading, error, searchQuery, filteredJobs, totalParts, filteredParts, fetchAllWork } =
  usePartsView()

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = ref('')

watch(debouncedSearch, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

function handleSelectJob(job: WorkQueueJob) {
  navigateTo(`/parts/step/${job.stepId}`)
}

async function handleRetry() {
  await fetchAllWork()
}

onMounted(async () => {
  await fetchAllWork()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-5xl">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">Active Parts</h1>
    </div>

    <!-- Search -->
    <UInput
      v-model="debouncedSearch"
      size="sm"
      placeholder="Search jobs, paths, or steps..."
      icon="i-lucide-search"
      class="max-w-sm"
    />

    <!-- Error state -->
    <div v-if="error" class="flex items-center gap-2 text-xs text-(--ui-error)">
      <span>{{ error }}</span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        label="Retry"
        @click="handleRetry"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-(--ui-text-muted)">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading active parts...
    </div>

    <!-- Empty state (no active parts at all) -->
    <div
      v-else-if="totalParts === 0 && !error"
      class="text-center py-12 text-sm text-(--ui-text-muted)"
    >
      <UIcon name="i-lucide-inbox" class="size-8 mx-auto mb-2 opacity-40" />
      <p>No active parts awaiting action.</p>
    </div>

    <!-- Job list -->
    <WorkQueueList
      v-else
      :jobs="filteredJobs"
      :total-parts="totalParts"
      :filtered-parts="filteredParts"
      :search-active="searchQuery.trim().length > 0"
      @select-job="handleSelectJob"
    />
  </div>
</template>
