<script setup lang="ts">
import type { WorkQueueJob, WorkQueueGroup } from '~/types/computed'
import type { DropdownMenuItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()

const {
  operatorId,
  operatorName,
  activeUsers,
  loading: identityLoading,
  selectOperator,
  clearOperator,
  init: initIdentity,
} = useOperatorIdentity()

const {
  groupBy,
  filters,
  searchQuery,
  loading: queueLoading,
  error: queueError,
  filteredGroups,
  totalParts,
  activeFilterCount,
  availableLocations,
  availableSteps,
  presets,
  activePresetId,
  setGroupBy,
  setFilter,
  clearFilters,
  syncFromUrl,
  syncToUrl,
  init: initFilters,
  fetchGroupedWork,
  savePreset,
  loadPreset,
  deletePreset,
} = useWorkQueueFilters()

// Debounced search: the filter bar emits immediately, but we debounce
// before setting it on the composable's searchQuery
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = ref('')

watch(debouncedSearch, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

// Keep composable searchQuery in sync with local debounced input
// (e.g. when syncFromUrl or loadPreset sets searchQuery externally)
watch(searchQuery, (val) => {
  if (debouncedSearch.value !== val) {
    debouncedSearch.value = val
  }
})

// Sorted groups: selected operator first (when groupType is 'user'), then others, unassigned last
const sortedGroups = computed<WorkQueueGroup[]>(() => {
  const groups = filteredGroups.value
  if (!operatorId.value) return groups

  // Only highlight/sort when grouped by user
  if (groupBy.value !== 'user') return groups

  const selected: WorkQueueGroup[] = []
  const others: WorkQueueGroup[] = []
  const unassigned: WorkQueueGroup[] = []

  for (const g of groups) {
    if (g.groupKey === operatorId.value) selected.push(g)
    else if (g.groupKey === null) unassigned.push(g)
    else others.push(g)
  }

  return [...selected, ...others, ...unassigned]
})

// Total filtered parts across all visible groups
const filteredParts = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.totalParts, 0),
)

// Dynamic group type label for summary bar
const groupTypeLabel = computed(() => {
  switch (groupBy.value) {
    case 'user': return 'operator'
    case 'location': return 'location'
    case 'step': return 'step'
    default: return 'group'
  }
})

// Operator dropdown items
const operatorMenuItems = computed<DropdownMenuItem[][]>(() => {
  if (!activeUsers.value.length) {
    return [[{ label: 'No operators available', disabled: true }]]
  }
  return [
    activeUsers.value.map((user: { id: string, displayName: string }) => ({
      label: user.displayName,
      icon: user.id === operatorId.value ? 'i-lucide-check' : 'i-lucide-user',
      onSelect() {
        handleSelectOperator(user.id)
      },
    })),
  ]
})

function handleSelectOperator(userId: string) {
  selectOperator(userId)
  router.replace({ query: { ...route.query, operator: userId } })
}

function handleClearOperator() {
  clearOperator()
  const { operator: _, ...rest } = route.query
  router.replace({ query: rest })
}

function handleStepClick(job: WorkQueueJob) {
  navigateTo(`/parts/step/${job.stepId}`)
}

async function handleRetry() {
  await fetchGroupedWork({ groupBy: groupBy.value })
}

function handleClearFilters() {
  clearFilters()
  debouncedSearch.value = ''
}

function handleUpdateFilters(f: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(f)) {
    setFilter(key as any, value)
  }
}

function formatLocation(loc?: string): string {
  return loc ? `📍 ${loc}` : ''
}

function formatStepInfo(job: WorkQueueJob): string {
  const parts = [job.jobName, job.pathName, `Step ${job.stepOrder + 1}/${job.totalSteps}`]
  return parts.join(' · ')
}

// Group icon based on groupType
function groupIcon(group: WorkQueueGroup): string {
  switch (group.groupType) {
    case 'user': return group.groupKey ? 'i-lucide-user' : 'i-lucide-clipboard-list'
    case 'location': return group.groupKey ? 'i-lucide-map-pin' : 'i-lucide-help-circle'
    case 'step': return 'i-lucide-layers'
    default: return 'i-lucide-folder'
  }
}

// Whether to highlight a group as "selected"
function isSelectedGroup(group: WorkQueueGroup): boolean {
  return group.groupType === 'user' && group.groupKey === operatorId.value && !!operatorId.value
}

// Whether any filters are active (including search)
const hasActiveFilters = computed(() => activeFilterCount.value > 0 || searchQuery.value.trim().length > 0)

onMounted(async () => {
  // Check URL query for operator param first
  const urlOperator = route.query.operator as string | undefined

  // Init identity (fetches users, restores from localStorage)
  await initIdentity()

  // URL param takes precedence over localStorage
  if (urlOperator) {
    const found = activeUsers.value.find((u: { id: string }) => u.id === urlOperator)
    if (found) {
      selectOperator(found.id)
    } else {
      // Stale operator in URL — clear it
      const { operator: _, ...rest } = route.query
      router.replace({ query: rest })
    }
  }

  // Restore filter state from URL (after operator identity init)
  syncFromUrl()

  // Fetch with the correct groupBy from URL
  await initFilters()
})
</script>

<template>
  <div class="p-4 space-y-3 max-w-5xl">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Work Queue
      </h1>

      <!-- Operator selector -->
      <div class="flex items-center gap-2">
        <UDropdownMenu
          :items="operatorMenuItems"
          size="sm"
          :content="{ align: 'end' }"
        >
          <UButton
            size="sm"
            :variant="operatorId ? 'ghost' : 'soft'"
            :color="operatorId ? 'neutral' : 'warning'"
            :icon="operatorId ? 'i-lucide-user' : 'i-lucide-hard-hat'"
            :label="operatorName ?? 'Select Operator'"
            trailing-icon="i-lucide-chevron-down"
            :loading="identityLoading"
          />
        </UDropdownMenu>
        <UButton
          v-if="operatorId"
          size="xs"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Clear operator"
          @click="handleClearOperator"
        />
      </div>
    </div>

    <!-- Filter bar -->
    <WorkQueueFilterBar
      :group-by="groupBy"
      :filters="filters"
      :available-locations="availableLocations"
      :available-steps="availableSteps"
      :available-users="activeUsers"
      :presets="presets"
      :active-preset-id="activePresetId"
      :search-query="debouncedSearch"
      @update:group-by="setGroupBy"
      @update:filters="handleUpdateFilters"
      @update:search-query="(val: string) => debouncedSearch = val"
      @clear="handleClearFilters"
      @save-preset="savePreset"
      @load-preset="loadPreset"
      @delete-preset="deletePreset"
    />

    <!-- Error state -->
    <div
      v-if="queueError"
      class="flex items-center gap-2 text-xs text-(--ui-error)"
    >
      <span>{{ queueError }}</span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        label="Retry"
        @click="handleRetry"
      />
    </div>

    <!-- Loading -->
    <div
      v-if="queueLoading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading work queue...
    </div>

    <template v-else-if="!queueError">
      <!-- Summary bar -->
      <div class="flex items-center justify-between text-xs text-(--ui-text-muted)">
        <span>
          <span class="font-semibold text-(--ui-text-highlighted)">{{ totalParts }}</span>
          part{{ totalParts !== 1 ? 's' : '' }} across
          {{ filteredGroups.length }} {{ groupTypeLabel }}{{ filteredGroups.length !== 1 ? 's' : '' }}
        </span>
        <span v-if="searchQuery.trim().length > 0">
          Showing <span class="font-semibold text-(--ui-text-highlighted)">{{ filteredParts }}</span> of {{ totalParts }}
        </span>
      </div>

      <!-- Empty state: no work at all -->
      <div
        v-if="sortedGroups.length === 0 && totalParts === 0 && !hasActiveFilters"
        class="text-center py-12 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-inbox"
          class="size-8 mx-auto mb-2 opacity-40"
        />
        <p>No active work in the queue.</p>
      </div>

      <!-- Empty state: filters produced no results -->
      <div
        v-else-if="sortedGroups.length === 0 && hasActiveFilters"
        class="text-center py-8 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-search-x"
          class="size-8 mx-auto mb-2 opacity-40"
        />
        <p>No results matching filters</p>
        <UButton
          size="xs"
          variant="soft"
          icon="i-lucide-x"
          label="Clear filters"
          class="mt-2"
          @click="handleClearFilters"
        />
      </div>

      <!-- No search results (search active but no filter dropdowns) -->
      <div
        v-else-if="sortedGroups.length === 0 && searchQuery.trim().length > 0"
        class="text-center py-8 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-search-x"
          class="size-8 mx-auto mb-2 opacity-40"
        />
        <p>No results matching "{{ searchQuery.trim() }}"</p>
      </div>

      <!-- Work queue groups -->
      <div
        v-for="group in sortedGroups"
        :key="group.groupKey ?? '_unassigned'"
        class="border border-(--ui-border) rounded-md overflow-hidden"
        :class="{ 'ring-2 ring-(--ui-primary)': isSelectedGroup(group) }"
      >
        <!-- Group header -->
        <div class="flex items-center justify-between px-3 py-2 bg-(--ui-bg-elevated)/50">
          <div class="flex items-center gap-2">
            <UIcon
              :name="groupIcon(group)"
              class="size-4 text-(--ui-text-muted)"
            />
            <span class="text-sm font-semibold text-(--ui-text-highlighted)">
              {{ group.groupLabel }}
            </span>
            <UBadge
              v-if="isSelectedGroup(group)"
              color="primary"
              variant="subtle"
              size="xs"
            >
              selected
            </UBadge>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
            size="xs"
          >
            {{ group.totalParts }} part{{ group.totalParts !== 1 ? 's' : '' }}
          </UBadge>
        </div>

        <!-- Step entries within this group -->
        <div class="divide-y divide-(--ui-border)">
          <button
            v-for="job in group.jobs"
            :key="`${job.stepId}`"
            class="w-full text-left px-3 py-2 hover:bg-(--ui-bg-elevated)/30 transition-colors cursor-pointer"
            type="button"
            @click="handleStepClick(job)"
          >
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="flex items-center gap-2 text-xs">
                  <span class="font-medium text-(--ui-text-highlighted)">{{ job.stepName }}</span>
                  <span
                    v-if="job.stepLocation"
                    class="text-(--ui-text-muted)"
                  >{{ formatLocation(job.stepLocation) }}</span>
                </div>
                <div class="text-xs text-(--ui-text-muted)">
                  {{ formatStepInfo(job) }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UBadge
                  :color="job.isFinalStep ? 'success' : 'neutral'"
                  variant="subtle"
                  size="xs"
                >
                  {{ job.partCount }}
                </UBadge>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-(--ui-text-muted)"
                />
              </div>
            </div>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
