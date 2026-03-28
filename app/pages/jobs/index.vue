<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Row, ExpandedState } from '@tanstack/vue-table'
import type { Job, FilterState } from '~/server/types/domain'
import type { JobProgress } from '~/server/types/computed'

const { jobs, loading, fetchJobs } = useJobs()
const { filters, updateFilter, clearFilters, applyFilters } = useViewFilters()

const jobProgressMap = ref<Record<string, JobProgress>>({})
const expanded = ref<ExpandedState>({})

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
    />

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
      v-else
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
        <JobExpandableRow :job-id="row.original.id" />
      </template>
    </UTable>
  </div>
</template>
