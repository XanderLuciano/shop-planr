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
  steps: { id: string; name: string; order: number; location?: string }[]
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  jobId: string
}>()

const paths = ref<PathInfo[]>([])
const loading = ref(false)
const expandedPathId = ref<string | null>(null)
const pathDistributions = ref<Record<string, StepDist[]>>({})
const pathCompletedCounts = ref<Record<string, number>>({})
const loadingPathId = ref<string | null>(null)

async function fetchPaths() {
  loading.value = true
  try {
    const detail = await $fetch<{ paths: PathInfo[] }>(`/api/jobs/${props.jobId}`)
    paths.value = detail.paths ?? []
  } catch {
    paths.value = []
  } finally {
    loading.value = false
  }
}

async function togglePath(pathId: string) {
  if (expandedPathId.value === pathId) {
    expandedPathId.value = null
    return
  }
  expandedPathId.value = pathId

  if (!pathDistributions.value[pathId]) {
    loadingPathId.value = pathId
    try {
      const detail = await $fetch<{ distribution: StepDist[]; completedCount?: number }>(
        `/api/paths/${pathId}`
      )
      pathDistributions.value[pathId] = detail.distribution ?? []
      pathCompletedCounts.value[pathId] = detail.completedCount ?? 0
    } catch {
      pathDistributions.value[pathId] = []
    } finally {
      loadingPathId.value = null
    }
  }
}

onMounted(() => {
  fetchPaths()
})
</script>

<template>
  <div class="pl-8 pr-4 py-2 bg-(--ui-bg-elevated)/50">
    <div v-if="loading" class="flex items-center gap-2 text-xs text-(--ui-text-muted) py-2">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-3" />
      Loading paths...
    </div>

    <div v-else-if="!paths.length" class="text-xs text-(--ui-text-muted) py-2">
      No paths defined for this job.
    </div>

    <table v-else class="w-full text-xs">
      <thead>
        <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)">
          <th class="py-1 pr-3 font-medium">Path</th>
          <th class="py-1 pr-3 font-medium">Goal Qty</th>
          <th class="py-1 pr-3 font-medium">Steps</th>
          <th class="py-1 pr-3 font-medium w-40">Progress</th>
          <th class="py-1 w-6" />
        </tr>
      </thead>
      <tbody>
        <template v-for="path in paths" :key="path.id">
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
              <div v-if="pathDistributions[path.id]" class="w-full">
                <ProgressBar
                  :completed="pathCompletedCounts[path.id] ?? 0"
                  :goal="path.goalQuantity"
                  :in-progress="
                    pathDistributions[path.id]!.reduce(
                      (s: number, d: StepDist) => s + d.partCount,
                      0
                    )
                  "
                />
              </div>
              <span v-else class="text-(--ui-text-muted)">—</span>
            </td>
            <td class="py-1.5 text-right">
              <UIcon
                :name="
                  expandedPathId === path.id ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'
                "
                class="size-3.5 text-(--ui-text-muted)"
              />
            </td>
          </tr>

          <!-- Expanded: Process Steps -->
          <tr v-if="expandedPathId === path.id">
            <td colspan="5" class="p-0">
              <div class="pl-6 pr-2 py-2 bg-(--ui-bg-elevated)/30">
                <div
                  v-if="loadingPathId === path.id"
                  class="flex items-center gap-2 text-xs text-(--ui-text-muted) py-1"
                >
                  <UIcon name="i-lucide-loader-2" class="animate-spin size-3" />
                  Loading steps...
                </div>

                <table v-else-if="pathDistributions[path.id]?.length" class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-(--ui-text-muted) border-b border-(--ui-border)/50">
                      <th class="py-1 pr-3 font-medium">Step</th>
                      <th class="py-1 pr-3 font-medium">At Step</th>
                      <th class="py-1 pr-3 font-medium">Completed</th>
                      <th class="py-1 font-medium">Status</th>
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
                        <span v-if="step!.location" class="text-(--ui-text-muted) ml-1"
                          >({{ step!.location }})</span
                        >
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

                <p v-else class="text-xs text-(--ui-text-muted) py-1">No steps defined.</p>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
