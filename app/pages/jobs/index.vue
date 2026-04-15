<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row, ExpandedState } from '@tanstack/vue-table'
import type { Job, Tag } from '~/types/domain'
import type { JobProgress } from '~/types/computed'
import { groupJobsByTag } from '~/utils/jobTagGrouping'

const { jobs, loading, fetchJobs } = useJobs()
const $api = useAuthFetch()
const { isAdmin } = useAuth()
const { filters, updateFilter, applyFilters } = useViewFilters()
const { tags: availableTags, fetchTags } = useTags()
const {
  isEditingPriority,
  orderedJobs,
  saving,
  enterEditMode,
  cancelEdit,
  reorder,
  savePriorities,
} = useJobPriority()

const toast = useToast()

const jobProgressMap = ref<Record<string, JobProgress>>({})
const expanded = ref<ExpandedState>({})
const expandAllPathsSignal = ref(0)
const collapseAllPathsSignal = ref(0)
const jobsWithExpandedPaths = ref<Set<string>>(new Set())

// Drag state
const dragIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

const hasExpandedJobs = computed(() => {
  if (isGrouped.value) return expandedGroupedJobs.value.size > 0
  return expanded.value === true || Object.keys(expanded.value).length > 0
})

function expandAllJobs() {
  if (isGrouped.value) {
    expandAllGroupedJobs()
  } else {
    expanded.value = true
  }
}

function collapseAllJobs() {
  if (isGrouped.value) {
    collapseAllGroupedJobs()
  } else {
    expanded.value = {}
    jobsWithExpandedPaths.value.clear()
  }
}

async function expandAllPaths() {
  if (isGrouped.value) {
    expandAllGroupedJobs()
  } else if (expanded.value !== true) {
    expanded.value = true
  }
  await nextTick()
  expandAllPathsSignal.value++
}

function collapseAllPaths() {
  collapseAllPathsSignal.value++
}

function onPathsExpandedChange(payload: { jobId: string, hasExpandedPaths: boolean }) {
  if (payload.hasExpandedPaths) {
    jobsWithExpandedPaths.value.add(payload.jobId)
  } else {
    jobsWithExpandedPaths.value.delete(payload.jobId)
  }
}

const filteredJobs = computed(() =>
  applyFilters(jobs.value, {
    jobName: j => j.name,
    jiraTicketKey: j => j.jiraTicketKey,
    priority: j => j.jiraPriority,
    label: j => j.jiraLabels?.join(', '),
    status: (j) => {
      const p = progressFor(j.id)
      if (!p) return 'active'
      return p.completedParts >= p.goalQuantity && p.goalQuantity > 0 ? 'completed' : 'active'
    },
    tagIds: j => j.tags?.map(t => t.id) ?? [],
  }),
)

/** The rows to display in the table: orderedJobs in edit mode, filteredJobs otherwise */
const displayedJobs = computed(() =>
  isEditingPriority.value ? [...orderedJobs.value] : filteredJobs.value,
)

/** Grouped view: organize filtered jobs by tag when groupByTag is active */
const isGrouped = computed(() => !!filters.value.groupByTag && !isEditingPriority.value)

const jobGroups = computed(() => {
  if (!isGrouped.value) return []
  return groupJobsByTag(filteredJobs.value, availableTags.value)
})

const expandedGroupedJobs = ref<Set<string>>(new Set())

function isGroupedJobExpanded(jobId: string): boolean {
  return expandedGroupedJobs.value.has(jobId)
}

function toggleGroupedJobExpand(jobId: string) {
  const next = new Set(expandedGroupedJobs.value)
  if (next.has(jobId)) {
    next.delete(jobId)
  } else {
    next.add(jobId)
  }
  expandedGroupedJobs.value = next
}

function expandAllGroupedJobs() {
  const allIds = new Set<string>()
  for (const group of jobGroups.value) {
    for (const job of group.jobs) {
      allIds.add(job.id)
    }
  }
  expandedGroupedJobs.value = allIds
}

function collapseAllGroupedJobs() {
  expandedGroupedJobs.value = new Set()
  jobsWithExpandedPaths.value.clear()
}

const collapsedGroups = ref<Set<string>>(new Set())

function toggleGroupCollapse(groupKey: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(groupKey)) {
    next.delete(groupKey)
  } else {
    next.add(groupKey)
  }
  collapsedGroups.value = next
}

function groupKey(group: { tag: Tag | null }): string {
  return group.tag?.id ?? '__untagged__'
}

function isGroupCollapsed(group: { tag: Tag | null }): boolean {
  return collapsedGroups.value.has(groupKey(group))
}

// Prune jobsWithExpandedPaths when filtered jobs change (removes stale entries for jobs no longer visible)
watch(filteredJobs, (visibleJobs) => {
  if (jobsWithExpandedPaths.value.size === 0) return
  const visibleIds = new Set(visibleJobs.map(j => j.id))
  for (const jobId of jobsWithExpandedPaths.value) {
    if (!visibleIds.has(jobId)) {
      jobsWithExpandedPaths.value.delete(jobId)
    }
  }
})

function onFiltersChange(f: typeof filters.value) {
  Object.keys(f).forEach((key) => {
    updateFilter(key as keyof typeof f, f[key as keyof typeof f])
  })
}

async function loadJobs() {
  await Promise.all([fetchJobs(), fetchTags()])
  await loadAllProgress()
}

async function loadAllProgress() {
  try {
    const progressList = await $api<JobProgress[]>('/api/jobs/progress')
    const map: Record<string, JobProgress> = {}
    for (const p of progressList) {
      map[p.jobId] = p
    }
    jobProgressMap.value = map
  } catch {
    toast.add({
      title: 'Could not load progress data',
      description: 'Job list is still available. Progress bars may be missing or stale.',
      color: 'warning',
    })
  }
}

function progressFor(jobId: string): JobProgress | null {
  return jobProgressMap.value[jobId] ?? null
}

// --- Priority edit actions ---

/** Active jobs = not completed (completedParts < goalQuantity or goalQuantity is 0) */
const activeJobs = computed(() =>
  jobs.value.filter((j) => {
    const p = progressFor(j.id)
    if (!p) return true
    return !(p.completedParts >= p.goalQuantity && p.goalQuantity > 0)
  }),
)

async function onEditPriority() {
  await loadAllProgress()
  enterEditMode([...activeJobs.value])
}

function onCancelEdit() {
  cancelEdit()
}

async function onSavePriorities() {
  try {
    await savePriorities()
  } catch {
    toast.add({
      title: 'Failed to save priorities',
      description: 'Please try again or cancel.',
      color: 'error',
    })
    return
  }

  try {
    await loadJobs()
  } catch {
    toast.add({
      title: 'Priorities saved, but failed to refresh jobs',
      description: 'Your changes were saved. Please refresh the page.',
      color: 'warning',
    })
  }
}

// --- Drag-and-drop handlers (desktop HTML5 drag) ---

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dropTargetIndex.value = index
}

function onDragLeave() {
  dropTargetIndex.value = null
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  const fromIndex = dragIndex.value
  if (fromIndex !== null && fromIndex !== toIndex) {
    reorder(fromIndex, toIndex)
  }
  dragIndex.value = null
  dropTargetIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dropTargetIndex.value = null
}

// --- Touch handlers (mobile drag-and-drop) ---

function getCardIndexFromPoint(y: number): number | null {
  const container = document.querySelector('[data-priority-mobile-list]')
  if (!container) return null
  const children = Array.from(container.children) as HTMLElement[]
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child) continue
    const rect = child.getBoundingClientRect()
    if (y >= rect.top && y <= rect.bottom) return i
  }
  return null
}

function onTouchStart(e: TouchEvent, index: number) {
  dragIndex.value = index
}

function onTouchMove(e: TouchEvent) {
  if (dragIndex.value === null) return
  e.preventDefault()
  const touch = e.touches[0]
  if (!touch) return
  const y = touch.clientY
  const targetIndex = getCardIndexFromPoint(y)
  dropTargetIndex.value = targetIndex
}

function onTouchEnd() {
  if (dragIndex.value !== null && dropTargetIndex.value !== null && dragIndex.value !== dropTargetIndex.value) {
    reorder(dragIndex.value, dropTargetIndex.value)
  }
  dragIndex.value = null
  dropTargetIndex.value = null
}

function onRowSelect(_e: Event, row: { original: Job }) {
  if (isEditingPriority.value) return
  navigateTo(`/jobs/${encodeURIComponent(row.original.id)}`)
}

const columns: TableColumn<Job>[] = [
  {
    accessorKey: 'expand',
    header: '',
    size: 40,
    cell: ({ row }: { row: Row<Job> }) => {
      return h(resolveComponent('UButton'), {
        icon: row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right',
        variant: 'ghost',
        color: 'neutral',
        size: 'xs',
        class: '-ml-1.5',
        onClick: (e: Event) => {
          e.stopPropagation()
          row.toggleExpanded()
        },
      })
    },
  },
  {
    accessorKey: 'priority',
    header: '#',
    size: 50,
    cell: ({ row }: { row: Row<Job> }) => row.original.priority,
  },
  {
    accessorKey: 'name',
    header: 'Job Name',
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const job = row.original as Job & { tags?: readonly Tag[] }
      if (!job.tags?.length) return null
      return h('div', { class: 'flex flex-wrap gap-1' },
        job.tags.map(tag => h(resolveComponent('JobTagPill'), { tag, key: tag.id })),
      )
    },
  },
  {
    accessorKey: 'jiraPartNumber',
    header: 'Part #',
    cell: ({ row }: { row: Row<Job> }) => row.original.jiraPartNumber || '—',
  },
  {
    accessorKey: 'goalQuantity',
    header: 'Goal Qty',
  },
  {
    accessorKey: 'progress',
    header: 'Progress',
    size: 200,
    cell: ({ row }: { row: Row<Job> }) => {
      const p = progressFor(row.original.id)
      if (!p) return '—'
      return h(resolveComponent('ProgressBar'), {
        completed: p.completedParts,
        goal: p.goalQuantity,
        inProgress: p.inProgressParts,
      })
    },
  },
]

onMounted(() => {
  loadJobs()
})
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
        Jobs
      </h1>
      <div class="flex items-center gap-2">
        <template v-if="isEditingPriority">
          <UButton
            label="Cancel"
            variant="outline"
            color="neutral"
            size="sm"
            :disabled="saving"
            @click="onCancelEdit"
          />
          <UButton
            label="Save"
            icon="i-lucide-check"
            size="sm"
            :loading="saving"
            @click="onSavePriorities"
          />
        </template>
        <template v-else>
          <UButton
            v-if="isAdmin"
            label="Edit Priority"
            icon="i-lucide-arrow-up-down"
            variant="outline"
            size="sm"
            :disabled="loading || !activeJobs.length || isGrouped"
            @click="onEditPriority"
          />
          <UButton
            v-if="isAdmin"
            icon="i-lucide-plus"
            label="New Job"
            size="sm"
            @click="navigateTo('/jobs/new')"
          />
        </template>
      </div>
    </div>

    <ViewFilters
      v-if="!isEditingPriority"
      :filters="filters"
      :available-tags="availableTags"
      @change="onFiltersChange"
    >
      <JobViewToolbar
        v-if="!loading && filteredJobs.length"
        class="hidden md:flex"
        :has-expanded-jobs="hasExpandedJobs"
        :has-expanded-paths="jobsWithExpandedPaths.size > 0"
        :job-count="filteredJobs.length"
        @expand-all-jobs="expandAllJobs"
        @collapse-all-jobs="collapseAllJobs"
        @expand-all-paths="expandAllPaths"
        @collapse-all-paths="collapseAllPaths"
      />
    </ViewFilters>

    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading jobs...
    </div>

    <div
      v-else-if="!displayedJobs.length && !isGrouped"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      {{ jobs.length ? 'No jobs match the current filters.' : 'No jobs yet. Create your first job to get started.' }}
    </div>

    <div
      v-else-if="isGrouped && !jobGroups.length"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      {{ jobs.length ? 'No jobs match the current filters.' : 'No jobs yet. Create your first job to get started.' }}
    </div>

    <!-- Desktop: Edit mode with drag-and-drop table -->
    <div
      v-if="!loading && displayedJobs.length && isEditingPriority"
      class="hidden md:block"
    >
      <table class="w-full text-xs">
        <thead>
          <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)">
            <th class="py-1.5 w-8" />
            <th class="py-1.5 w-12">
              #
            </th>
            <th class="py-1.5">
              Job Name
            </th>
            <th class="py-1.5">
              Part #
            </th>
            <th class="py-1.5">
              Goal Qty
            </th>
            <th class="py-1.5 w-[200px]">
              Progress
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(job, index) in orderedJobs"
            :key="job.id"
            draggable="true"
            class="border-b border-(--ui-border)/50 transition-colors"
            :class="{
              'opacity-50': dragIndex === index,
              'border-t-2 border-t-(--ui-primary)': dropTargetIndex === index && dragIndex !== null && dragIndex !== index,
            }"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver($event, index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <td class="py-1 cursor-grab active:cursor-grabbing">
              <UIcon
                name="i-lucide-grip-vertical"
                class="size-4 text-(--ui-text-muted)"
              />
            </td>
            <td class="py-1 text-(--ui-text-muted)">
              {{ index + 1 }}
            </td>
            <td class="py-1">
              {{ job.name }}
            </td>
            <td class="py-1">
              {{ job.jiraPartNumber || '—' }}
            </td>
            <td class="py-1">
              {{ job.goalQuantity }}
            </td>
            <td class="py-1">
              <ProgressBar
                v-if="progressFor(job.id)"
                :completed="progressFor(job.id)!.completedParts"
                :goal="progressFor(job.id)!.goalQuantity"
                :in-progress="progressFor(job.id)!.inProgressParts"
              />
              <span
                v-else
                class="text-(--ui-text-muted)"
              >—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Desktop: Normal mode UTable (flat view) -->
    <UTable
      v-if="!loading && displayedJobs.length && !isEditingPriority && !isGrouped"
      v-model:expanded="expanded"
      class="hidden md:block"
      :data="displayedJobs"
      :columns="columns"
      :ui="{
        th: 'text-xs py-1.5',
        td: 'text-xs py-1',
        tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50',
      }"
      @select="onRowSelect"
    >
      <template #expanded="{ row }">
        <JobExpandableRow
          :job-id="row.original.id"
          :expand-all-paths-signal="expandAllPathsSignal"
          :collapse-all-paths-signal="collapseAllPathsSignal"
          @paths-expanded-change="onPathsExpandedChange"
        />
      </template>
    </UTable>

    <!-- Desktop: Grouped view -->
    <div
      v-if="!loading && isGrouped && jobGroups.length"
      class="hidden md:block space-y-3"
    >
      <div
        v-for="group in jobGroups"
        :key="groupKey(group)"
        class="rounded-lg border overflow-hidden"
        :style="{ borderColor: group.tag?.color ?? 'var(--ui-border)' }"
      >
        <button
          class="flex items-center justify-between w-full px-3 py-2 bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-elevated) transition-colors text-left"
          @click="toggleGroupCollapse(groupKey(group))"
        >
          <div class="flex items-center gap-2">
            <UIcon
              :name="isGroupCollapsed(group) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="size-4 text-(--ui-text-muted)"
            />
            <JobTagPill
              v-if="group.tag"
              :tag="group.tag"
            />
            <span
              v-else
              class="text-xs font-medium text-(--ui-text-muted)"
            >Untagged</span>
          </div>
          <span class="text-xs text-(--ui-text-muted)">{{ group.jobs.length }} {{ group.jobs.length === 1 ? 'job' : 'jobs' }}</span>
        </button>
        <div v-if="!isGroupCollapsed(group)">
          <table
            class="w-full text-xs"
            style="table-layout: fixed"
          >
            <colgroup>
              <col style="width: 40px">
              <col style="width: 50px">
              <col>
              <col style="width: 120px">
              <col style="width: 80px">
              <col style="width: 70px">
              <col style="width: 200px">
            </colgroup>
            <tbody>
              <template
                v-for="job in group.jobs"
                :key="job.id"
              >
                <tr
                  class="border-t border-(--ui-border)/50 cursor-pointer hover:bg-(--ui-bg-elevated)/50"
                  @click="navigateTo(`/jobs/${encodeURIComponent(job.id)}`)"
                >
                  <td
                    class="py-1 pl-2 w-10"
                    @click.stop
                  >
                    <UButton
                      :icon="isGroupedJobExpanded(job.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      @click="toggleGroupedJobExpand(job.id)"
                    />
                  </td>
                  <td class="py-1 w-12 text-(--ui-text-muted)">
                    {{ job.priority }}
                  </td>
                  <td class="py-1">
                    {{ job.name }}
                  </td>
                  <td class="py-1">
                    <div
                      v-if="job.tags?.length"
                      class="flex flex-wrap gap-1"
                    >
                      <JobTagPill
                        v-for="tag in job.tags"
                        :key="tag.id"
                        :tag="tag"
                      />
                    </div>
                  </td>
                  <td class="py-1">
                    {{ job.jiraPartNumber || '—' }}
                  </td>
                  <td class="py-1">
                    {{ job.goalQuantity }}
                  </td>
                  <td class="py-1 pr-3 w-[200px]">
                    <ProgressBar
                      v-if="progressFor(job.id)"
                      :completed="progressFor(job.id)!.completedParts"
                      :goal="progressFor(job.id)!.goalQuantity"
                      :in-progress="progressFor(job.id)!.inProgressParts"
                    />
                    <span
                      v-else
                      class="text-(--ui-text-muted)"
                    >—</span>
                  </td>
                </tr>
                <tr v-if="isGroupedJobExpanded(job.id)">
                  <td
                    colspan="7"
                    class="p-0"
                  >
                    <JobExpandableRow
                      :job-id="job.id"
                      :expand-all-paths-signal="expandAllPathsSignal"
                      :collapse-all-paths-signal="collapseAllPathsSignal"
                      @paths-expanded-change="onPathsExpandedChange"
                    />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Mobile: Edit mode with drag-and-drop cards -->
    <div
      v-if="!loading && displayedJobs.length && isEditingPriority"
      class="md:hidden space-y-2"
      data-priority-mobile-list
    >
      <JobMobileCard
        v-for="(job, index) in orderedJobs"
        :key="job.id"
        :job="job"
        :progress="progressFor(job.id)"
        :editing="true"
        :index="index"
        :class="{
          'opacity-50': dragIndex === index,
          'border-t-2 border-t-(--ui-primary)': dropTargetIndex === index && dragIndex !== null && dragIndex !== index,
        }"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @drop="onDrop($event, index)"
        @dragend="onDragEnd"
        @dragleave="onDragLeave"
        @touchstart="onTouchStart($event, index)"
        @touchmove="onTouchMove($event)"
        @touchend="onTouchEnd"
      />
    </div>

    <!-- Mobile: Normal mode cards (flat view) -->
    <div
      v-if="!loading && filteredJobs.length && !isEditingPriority && !isGrouped"
      class="md:hidden space-y-2"
    >
      <JobMobileCard
        v-for="job in filteredJobs"
        :key="job.id"
        :job="job"
        :progress="progressFor(job.id)"
        @click="navigateTo(`/jobs/${encodeURIComponent(job.id)}`)"
      />
    </div>

    <!-- Mobile: Grouped view -->
    <div
      v-if="!loading && isGrouped && jobGroups.length"
      class="md:hidden space-y-3"
    >
      <div
        v-for="group in jobGroups"
        :key="groupKey(group)"
        class="rounded-lg border overflow-hidden"
        :style="{ borderColor: group.tag?.color ?? 'var(--ui-border)' }"
      >
        <button
          class="flex items-center justify-between w-full px-3 py-2 bg-(--ui-bg-elevated)/50 hover:bg-(--ui-bg-elevated) transition-colors text-left"
          @click="toggleGroupCollapse(groupKey(group))"
        >
          <div class="flex items-center gap-2">
            <UIcon
              :name="isGroupCollapsed(group) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="size-4 text-(--ui-text-muted)"
            />
            <JobTagPill
              v-if="group.tag"
              :tag="group.tag"
            />
            <span
              v-else
              class="text-xs font-medium text-(--ui-text-muted)"
            >Untagged</span>
          </div>
          <span class="text-xs text-(--ui-text-muted)">{{ group.jobs.length }} {{ group.jobs.length === 1 ? 'job' : 'jobs' }}</span>
        </button>
        <div
          v-if="!isGroupCollapsed(group)"
          class="space-y-2 p-2"
        >
          <div
            v-for="job in group.jobs"
            :key="job.id"
          >
            <div class="flex items-center gap-1">
              <UButton
                :icon="isGroupedJobExpanded(job.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="toggleGroupedJobExpand(job.id)"
              />
              <div class="flex-1 min-w-0">
                <JobMobileCard
                  :job="job"
                  :progress="progressFor(job.id)"
                  @click="navigateTo(`/jobs/${encodeURIComponent(job.id)}`)"
                />
              </div>
            </div>
            <JobExpandableRow
              v-if="isGroupedJobExpanded(job.id)"
              :job-id="job.id"
              :expand-all-paths-signal="expandAllPathsSignal"
              :collapse-all-paths-signal="collapseAllPathsSignal"
              @paths-expanded-change="onPathsExpandedChange"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
