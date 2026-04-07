<script setup lang="ts">
interface StepDist {
  stepId: string
  stepName: string
  stepOrder: number
  location?: string
  partCount: number
  completedCount: number
  isBottleneck: boolean
}

interface PathInfo {
  id: string
  jobId: string
  name: string
  goalQuantity: number
  steps: { id: string, name: string, order: number, location?: string }[]
  createdAt: string
  updatedAt: string
}

const props = withDefaults(defineProps<{
  jobId: string
  expandAllPathsSignal?: number
  collapseAllPathsSignal?: number
}>(), {
  expandAllPathsSignal: 0,
  collapseAllPathsSignal: 0,
})

const emit = defineEmits<{
  (e: 'paths-expanded-change', payload: { jobId: string, hasExpandedPaths: boolean }): void
}>()

const paths = ref<PathInfo[]>([])
const loading = ref(false)
const expandedPathIds = ref<Set<string>>(new Set())
const pathDistributions = ref<Record<string, StepDist[]>>({})
const pathCompletedCounts = ref<Record<string, number>>({})
const loadingPathIds = ref<Set<string>>(new Set())
const failedPathIds = ref<Set<string>>(new Set())
const fetchPathsPromise = ref<Promise<void> | null>(null)
const $api = useAuthFetch()
let bulkExpandPromise: Promise<void> | null = null

async function fetchPaths() {
  loading.value = true
  try {
    const detail = await $api<{ paths: PathInfo[] }>(`/api/jobs/${props.jobId}`)
    paths.value = detail.paths ?? []
  } catch {
    paths.value = []
  } finally {
    loading.value = false
  }
}

async function togglePath(pathId: string) {
  if (expandedPathIds.value.has(pathId)) {
    expandedPathIds.value.delete(pathId)
    expandedPathIds.value = new Set(expandedPathIds.value)
    emit('paths-expanded-change', { jobId: props.jobId, hasExpandedPaths: expandedPathIds.value.size > 0 })
    return
  }
  expandedPathIds.value.add(pathId)
  expandedPathIds.value = new Set(expandedPathIds.value)
  emit('paths-expanded-change', { jobId: props.jobId, hasExpandedPaths: true })

  if (!pathDistributions.value[pathId] || failedPathIds.value.has(pathId)) {
    failedPathIds.value.delete(pathId)
    loadingPathIds.value.add(pathId)
    loadingPathIds.value = new Set(loadingPathIds.value)
    try {
      const detail = await $api<{ distribution: StepDist[], completedCount?: number }>(`/api/paths/${pathId}`)
      pathDistributions.value[pathId] = detail.distribution ?? []
      pathCompletedCounts.value[pathId] = detail.completedCount ?? 0
    } catch {
      pathDistributions.value[pathId] = []
      failedPathIds.value.add(pathId)
    } finally {
      loadingPathIds.value.delete(pathId)
      loadingPathIds.value = new Set(loadingPathIds.value)
    }
  }
}

async function onExpandAllPaths() {
  // Serialize: wait for any in-flight bulk expand to finish first
  if (bulkExpandPromise) {
    await bulkExpandPromise
  }

  const run = async () => {
    // Wait for paths to load if fetch is still in-flight
    if (fetchPathsPromise.value) {
      await fetchPathsPromise.value
    }
    const allPathIds = paths.value.map(p => p.id)
    expandedPathIds.value = new Set(allPathIds)
    emit('paths-expanded-change', { jobId: props.jobId, hasExpandedPaths: allPathIds.length > 0 })

    const uncachedIds = allPathIds.filter(id => !pathDistributions.value[id])
    if (uncachedIds.length === 0) return

    const CONCURRENCY = 3
    for (let i = 0; i < uncachedIds.length; i += CONCURRENCY) {
      const batch = uncachedIds.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (pathId) => {
          loadingPathIds.value.add(pathId)
          loadingPathIds.value = new Set(loadingPathIds.value)
          const detail = await $api<{ distribution: StepDist[], completedCount?: number }>(`/api/paths/${pathId}`)
          pathDistributions.value[pathId] = detail.distribution ?? []
          pathCompletedCounts.value[pathId] = detail.completedCount ?? 0
        }),
      )
      for (let j = 0; j < batch.length; j++) {
        if (results[j]!.status === 'rejected' && !pathDistributions.value[batch[j]!]) {
          pathDistributions.value[batch[j]!] = []
          failedPathIds.value.add(batch[j]!)
        }
        loadingPathIds.value.delete(batch[j]!)
      }
      loadingPathIds.value = new Set(loadingPathIds.value)
    }
  }

  bulkExpandPromise = run()
  await bulkExpandPromise
  bulkExpandPromise = null
}

function onCollapseAllPaths() {
  expandedPathIds.value = new Set()
  emit('paths-expanded-change', { jobId: props.jobId, hasExpandedPaths: false })
}

watch(() => props.expandAllPathsSignal, (newVal, oldVal) => {
  if (newVal > (oldVal ?? 0)) {
    onExpandAllPaths()
  }
}, { immediate: true })

watch(() => props.collapseAllPathsSignal, (newVal, oldVal) => {
  if (newVal > (oldVal ?? 0)) {
    onCollapseAllPaths()
  }
}, { immediate: true })

onMounted(() => {
  fetchPathsPromise.value = fetchPaths()
})

onUnmounted(() => {
  if (expandedPathIds.value.size > 0) {
    emit('paths-expanded-change', { jobId: props.jobId, hasExpandedPaths: false })
  }
})
</script>

<template>
  <div class="pl-8 pr-4 py-2 bg-(--ui-bg-elevated)/50">
    <div
      v-if="loading"
      class="flex items-center gap-2 text-xs text-(--ui-text-muted) py-2"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="animate-spin size-3"
      />
      Loading paths...
    </div>

    <div
      v-else-if="!paths.length"
      class="text-xs text-(--ui-text-muted) py-2"
    >
      No paths defined for this job.
    </div>

    <table
      v-else
      class="w-full text-xs"
      style="table-layout: fixed"
    >
      <colgroup>
        <col style="width: 35%">
        <col style="width: 15%">
        <col style="width: 10%">
        <col style="width: 30%">
        <col style="width: 10%">
      </colgroup>
      <thead>
        <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)">
          <th class="py-1 pr-3 font-medium">
            Path
          </th>
          <th class="py-1 pr-3 font-medium">
            Goal Qty
          </th>
          <th class="py-1 pr-3 font-medium">
            Steps
          </th>
          <th class="py-1 pr-3 font-medium">
            Progress
          </th>
          <th class="py-1" />
        </tr>
      </thead>
      <tbody>
        <template
          v-for="path in paths"
          :key="path.id"
        >
          <tr
            class="border-b border-(--ui-border)/50 hover:bg-(--ui-bg-accented)/50 cursor-pointer transition-colors"
            @click="togglePath(path.id)"
          >
            <td class="py-1.5 pr-3 font-medium text-(--ui-text-highlighted)">
              {{ path.name }}
            </td>
            <td class="py-1.5 pr-3">
              {{ path.goalQuantity }}
            </td>
            <td class="py-1.5 pr-3">
              {{ path.steps.length }}
            </td>
            <td class="py-1.5 pr-3">
              <div
                v-if="pathDistributions[path.id]"
                class="w-full"
              >
                <ProgressBar
                  :completed="pathCompletedCounts[path.id] ?? 0"
                  :goal="path.goalQuantity"
                  :in-progress="pathDistributions[path.id]!.reduce((s: number, d: StepDist) => s + d.partCount, 0)"
                />
              </div>
              <span
                v-else
                class="text-(--ui-text-muted)"
              >—</span>
            </td>
            <td class="py-1.5 text-right">
              <UIcon
                :name="expandedPathIds.has(path.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="size-3.5 text-(--ui-text-muted)"
              />
            </td>
          </tr>

          <!-- Expanded: Process Steps -->
          <tr v-if="expandedPathIds.has(path.id)">
            <td
              colspan="5"
              class="p-0"
            >
              <div class="pl-6 pr-2 py-2 bg-(--ui-bg-elevated)/30">
                <div
                  v-if="loadingPathIds.has(path.id)"
                  class="flex items-center gap-2 text-xs text-(--ui-text-muted) py-1"
                >
                  <UIcon
                    name="i-lucide-loader-2"
                    class="animate-spin size-3"
                  />
                  Loading steps...
                </div>

                <table
                  v-else-if="pathDistributions[path.id]?.length"
                  class="w-full text-xs"
                  style="table-layout: fixed"
                >
                  <colgroup>
                    <col style="width: 35%">
                    <col style="width: 15%">
                    <col style="width: 15%">
                    <col style="width: 35%">
                  </colgroup>
                  <thead>
                    <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)/50">
                      <th class="py-1 pr-3 font-medium">
                        Step
                      </th>
                      <th class="py-1 pr-3 font-medium">
                        At Step
                      </th>
                      <th class="py-1 pr-3 font-medium">
                        Completed
                      </th>
                      <th class="py-1 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="step in pathDistributions[path.id]"
                      :key="step!.stepId"
                      class="border-b border-(--ui-border)/30"
                    >
                      <td class="py-1 pr-3 text-(--ui-text-highlighted)">
                        {{ step!.stepName }}
                        <span
                          v-if="step!.location"
                          class="text-(--ui-text-muted) ml-1"
                        >({{ step!.location }})</span>
                      </td>
                      <td class="py-1 pr-3">
                        {{ step!.partCount }}
                      </td>
                      <td class="py-1 pr-3">
                        {{ step!.completedCount }}
                      </td>
                      <td class="py-1">
                        <BottleneckBadge :is-bottleneck="step!.isBottleneck" />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p
                  v-else
                  class="text-xs text-(--ui-text-muted) py-1"
                >
                  No steps defined.
                </p>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
