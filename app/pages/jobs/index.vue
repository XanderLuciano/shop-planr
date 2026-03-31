<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row, ExpandedState } from '@tanstack/vue-table'
import type { Job, FilterState } from '~/server/types/domain'
import type { JobProgress } from '~/server/types/computed'

const { isMobile } = useMobileBreakpoint()
const { jobs, loading, fetchJobs } = useJobs()
const { filters, updateFilter, clearFilters, applyFilters } = useViewFilters()

const jobProgressMap = ref<Record<string, JobProgress>>({})
const expanded = ref<ExpandedState>({})
const expandAllPathsSignal = ref(0)
const collapseAllPathsSignal = ref(0)
const jobsWithExpandedPaths = ref<Set<string>>(new Set())

const hasExpandedJobs = computed(() =>
  expanded.value === true || Object.keys(expanded.value).length > 0
)

function expandAllJobs() {
  expanded.value = true
}

function collapseAllJobs() {
  expanded.value = {}
  jobsWithExpandedPaths.value.clear()
}

async function expandAllPaths() {
  if (expanded.value !== true) {
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
    }
  })
)

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
  await fetchJobs()
  await loadAllProgress()
}

async function loadAllProgress() {
  const results = await Promise.allSettled(
    jobs.value.map(job =>
      $fetch<{ progress: JobProgress }>(`/api/jobs/${job.id}`)
        .then(detail => ({ id: job.id, progress: detail.progress }))
    )
  )
  const map: Record<string, JobProgress> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') {
      map[r.value.id] = r.value.progress
    }
  }
  jobProgressMap.value = map
}

function progressFor(jobId: string): JobProgress | null {
  return jobProgressMap.value[jobId] ?? null
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
        }
      })
    }
  },
  {
    accessorKey: 'name',
    header: 'Job Name'
  },
  {
    accessorKey: 'jiraPartNumber',
    header: 'Part #',
    cell: ({ row }: { row: Row<Job> }) => row.original.jiraPartNumber || '—'
  },
  {
    accessorKey: 'goalQuantity',
    header: 'Goal Qty'
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
        inProgress: p.inProgressParts
      })
    }
  },
  {
    accessorKey: 'jiraPriority',
    header: 'Priority',
    cell: ({ row }: { row: Row<Job> }) => row.original.jiraPriority || '—'
  }
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
      <UButton
        icon="i-lucide-plus"
        label="New Job"
        size="sm"
        @click="navigateTo('/jobs/new')"
      />
    </div>

    <ViewFilters
      :filters="filters"
      @change="onFiltersChange"
    >
      <JobViewToolbar
        v-if="!loading && filteredJobs.length && !isMobile"
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
      v-else-if="!filteredJobs.length"
      class="text-sm text-(--ui-text-muted) py-8 text-center"
    >
      {{ jobs.length ? 'No jobs match the current filters.' : 'No jobs yet. Create your first job to get started.' }}
    </div>

    <UTable
      v-if="!loading && filteredJobs.length && !isMobile"
      v-model:expanded="expanded"
      :data="filteredJobs"
      :columns="columns"
      :ui="{
        th: 'text-xs py-1.5',
        td: 'text-xs py-1',
        tr: 'cursor-pointer hover:bg-(--ui-bg-elevated)/50'
      }"
      @select="(_e: any, row: any) => navigateTo(`/jobs/${encodeURIComponent(row.original.id)}`)"
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

    <div v-if="!loading && filteredJobs.length && isMobile" class="space-y-2">
      <JobMobileCard
        v-for="job in filteredJobs"
        :key="job.id"
        :job="job"
        :progress="progressFor(job.id)"
        @click="navigateTo(`/jobs/${encodeURIComponent(job.id)}`)"
      />
    </div>
  </div>
</template>
