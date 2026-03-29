<script setup lang="ts">
import type { AuditFilters } from '~/composables/useAudit'

const PAGE_SIZE = 50

const { entries, loading, error, fetchEntries } = useAudit()
const hasMore = ref(true)
const loadingMore = ref(false)
const currentFilters = ref<AuditFilters>({})

async function loadEntries(reset = false) {
  if (reset) {
    hasMore.value = true
  }
  const result = await fetchEntries({
    limit: PAGE_SIZE,
    offset: reset ? 0 : undefined,
    filters: currentFilters.value,
  })
  if (result.length < PAGE_SIZE) hasMore.value = false
}

async function loadMore() {
  loadingMore.value = true
  try {
    const result = await fetchEntries({
      limit: PAGE_SIZE,
      offset: entries.value.length,
      filters: currentFilters.value,
    })
    if (result.length < PAGE_SIZE) hasMore.value = false
  } finally {
    loadingMore.value = false
  }
}

function onFiltersChanged(filters: AuditFilters) {
  currentFilters.value = filters
  loadEntries(true)
}

onMounted(async () => {
  const result = await fetchEntries({ limit: PAGE_SIZE })
  if (result.length < PAGE_SIZE) hasMore.value = false
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-5xl">
    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">Audit Trail</h1>

    <!-- Filters -->
    <AuditTrailFilters @update:filters="onFiltersChanged" />

    <!-- Error -->
    <div v-if="error" class="text-xs text-red-500 bg-red-500/10 rounded px-3 py-2">{{ error }}</div>

    <!-- Loading initial -->
    <div
      v-if="loading && !entries.length"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon name="i-lucide-loader-2" class="animate-spin size-4" />
      Loading audit entries...
    </div>

    <!-- Entries -->
    <div
      v-else
      class="border border-(--ui-border) rounded-md bg-(--ui-bg-elevated)/50 overflow-x-auto"
    >
      <AuditLog :entries="entries" />
    </div>

    <!-- Load more -->
    <div v-if="hasMore && entries.length" class="flex justify-center pt-1">
      <UButton
        label="Load More"
        variant="ghost"
        size="sm"
        icon="i-lucide-chevron-down"
        :loading="loadingMore"
        @click="loadMore"
      />
    </div>
  </div>
</template>
