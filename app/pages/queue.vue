<script setup lang="ts">
import type { WorkQueueJob, OperatorGroup } from '~/types/computed'
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
  loading: queueLoading,
  error: queueError,
  searchQuery,
  filteredGroups,
  totalParts,
  fetchGroupedWork,
} = useOperatorWorkQueue()

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = ref('')

watch(debouncedSearch, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

// Sorted groups: selected operator first, then others, unassigned last
const sortedGroups = computed<OperatorGroup[]>(() => {
  const groups = filteredGroups.value
  if (!operatorId.value) return groups

  const selected: OperatorGroup[] = []
  const others: OperatorGroup[] = []
  const unassigned: OperatorGroup[] = []

  for (const g of groups) {
    if (g.operatorId === operatorId.value) selected.push(g)
    else if (g.operatorId === null) unassigned.push(g)
    else others.push(g)
  }

  return [...selected, ...others, ...unassigned]
})

// Total filtered parts across all visible groups
const filteredParts = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.totalParts, 0),
)

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
  await fetchGroupedWork()
}

function formatLocation(loc?: string): string {
  return loc ? `📍 ${loc}` : ''
}

function formatStepInfo(job: WorkQueueJob): string {
  const parts = [job.jobName, job.pathName, `Step ${job.stepOrder + 1}/${job.totalSteps}`]
  return parts.join(' · ')
}

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

  await fetchGroupedWork()
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

    <!-- Search -->
    <UInput
      v-model="debouncedSearch"
      size="sm"
      placeholder="Search jobs, paths, steps, operators..."
      icon="i-lucide-search"
      class="max-w-sm"
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
          {{ filteredGroups.length }} operator{{ filteredGroups.length !== 1 ? 's' : '' }}
        </span>
        <span v-if="searchQuery.trim().length > 0">
          Showing <span class="font-semibold text-(--ui-text-highlighted)">{{ filteredParts }}</span> of {{ totalParts }}
        </span>
      </div>

      <!-- Empty state -->
      <div
        v-if="sortedGroups.length === 0 && totalParts === 0"
        class="text-center py-12 text-sm text-(--ui-text-muted)"
      >
        <UIcon
          name="i-lucide-inbox"
          class="size-8 mx-auto mb-2 opacity-40"
        />
        <p>No active work in the queue.</p>
      </div>

      <!-- No search results -->
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

      <!-- Operator groups -->
      <div
        v-for="group in sortedGroups"
        :key="group.operatorId ?? '_unassigned'"
        class="border border-(--ui-border) rounded-md overflow-hidden"
        :class="{ 'ring-2 ring-(--ui-primary)': group.operatorId === operatorId && operatorId }"
      >
        <!-- Operator header -->
        <div class="flex items-center justify-between px-3 py-2 bg-(--ui-bg-elevated)/50">
          <div class="flex items-center gap-2">
            <UIcon
              :name="group.operatorId ? 'i-lucide-user' : 'i-lucide-clipboard-list'"
              class="size-4 text-(--ui-text-muted)"
            />
            <span class="text-sm font-semibold text-(--ui-text-highlighted)">
              {{ group.operatorName }}
            </span>
            <UBadge
              v-if="group.operatorId === operatorId && operatorId"
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

        <!-- Step entries within this operator group -->
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
