<script setup lang="ts">
const { query, results, isSearching, search } = useDocsSearch()

function onSearchInput(value: string) {
  search(value)
}

function navigateToResult(path: string) {
  query.value = ''
  results.value = []
  navigateTo(path)
}

const showDropdown = computed(() => query.value.trim().length > 0)
const showNoResults = computed(
  () => showDropdown.value && !isSearching.value && results.value.length === 0,
)
</script>

<template>
  <div class="relative">
    <UInput
      v-model="query"
      icon="i-lucide-search"
      size="sm"
      placeholder="Search docs..."
      :loading="isSearching"
      trailing
      class="w-full"
      @update:model-value="onSearchInput"
    />

    <!-- Results dropdown -->
    <div
      v-if="showDropdown"
      class="absolute z-50 mt-1 w-full rounded-md border border-(--ui-border) bg-(--ui-bg) shadow-lg"
    >
      <!-- Loading state -->
      <div
        v-if="isSearching && results.length === 0"
        class="px-3 py-4 text-center"
      >
        <span class="text-sm text-(--ui-text-muted)">Searching…</span>
      </div>

      <!-- No results -->
      <div
        v-else-if="showNoResults"
        class="flex flex-col items-center gap-1 px-3 py-4 text-center"
      >
        <UIcon
          name="i-lucide-search-x"
          class="size-5 text-(--ui-text-dimmed)"
        />
        <span class="text-sm text-(--ui-text-muted)">No results found</span>
      </div>

      <!-- Results list -->
      <ul
        v-else-if="results.length"
        class="max-h-64 overflow-y-auto py-1"
      >
        <li
          v-for="result in results"
          :key="result.path"
        >
          <button
            class="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-(--ui-bg-elevated) cursor-pointer"
            @click="navigateToResult(result.path)"
          >
            <span class="text-sm font-medium text-(--ui-text-highlighted)">{{ result.title }}</span>
            <span class="text-xs text-(--ui-text-muted) font-mono truncate">{{ result.path }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
