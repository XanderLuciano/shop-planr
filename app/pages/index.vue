<script setup lang="ts">
import type { JobProgress } from '~/types/computed'

const $api = useAuthFetch()
const { jobs, loading, fetchJobs } = useJobs()

const jobProgressList = ref<JobProgress[]>([])
const progressLoading = ref(false)
const progressError = ref<string | null>(null)

async function loadDashboard() {
  await fetchJobs()
  await loadJobProgress()
}

async function loadJobProgress() {
  if (!jobs.value.length) {
    jobProgressList.value = []
    return
  }

  progressLoading.value = true
  progressError.value = null
  try {
    jobProgressList.value = await $api<JobProgress[]>('/api/jobs/progress')
  } catch (e) {
    progressError.value = extractApiError(e, 'Failed to load job progress')
  } finally {
    progressLoading.value = false
  }
}

const activeJobCount = computed(() => jobs.value.length)

const totalInProgress = computed(() =>
  jobProgressList.value.reduce((sum, p) => sum + p.inProgressParts, 0),
)

const summaryCards = computed(() => [
  {
    title: 'Active Jobs',
    value: activeJobCount.value,
    icon: 'i-lucide-briefcase',
    to: '/jobs',
  },
  {
    title: 'Parts In Progress',
    value: totalInProgress.value,
    icon: 'i-lucide-activity',
    to: '/jobs',
  },
  {
    title: 'Completed Today',
    value: '—',
    icon: 'i-lucide-check-circle',
    to: '/jobs',
  },
  {
    title: 'Bottleneck Alerts',
    value: 0,
    icon: 'i-lucide-alert-triangle',
    to: '/parts',
  },
])

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="p-4 space-y-4">
    <h1 class="text-lg font-bold text-(--ui-text-highlighted)">
      Dashboard
    </h1>

    <div
      v-if="loading"
      class="flex items-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-4"
      />
      Loading...
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <DashboardSummaryCard
        v-for="card in summaryCards"
        :key="card.title"
        :title="card.title"
        :value="card.value"
        :icon="card.icon"
        :to="card.to"
      />
    </div>

    <div
      v-if="progressError"
      class="flex items-center gap-2 text-xs text-(--ui-error)"
    >
      <span>{{ progressError }}</span>
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        label="Retry"
        @click="loadJobProgress"
      />
    </div>

    <DashboardJobChart :jobs="jobProgressList" />
  </div>
</template>
