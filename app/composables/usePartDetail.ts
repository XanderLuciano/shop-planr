import { ref, readonly } from 'vue'
import type { Part, Job, Path } from '~/types/domain'
import type { StepDistribution, EnrichedPart } from '~/types/computed'

export function usePartDetail(partId: string) {
  const part = ref<Part | null>(null)
  const job = ref<Job | null>(null)
  const path = ref<(Path & { distribution: StepDistribution[] }) | null>(null)
  const distribution = ref<StepDistribution[]>([])
  const siblingParts = ref<EnrichedPart[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDetail(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // Fetch part first to get jobId and pathId
      const partData = await $fetch<Part>(`/api/parts/${encodeURIComponent(partId)}`)
      part.value = partData

      // Fetch job and path+distribution in parallel
      const [jobData, pathData] = await Promise.all([
        $fetch<Job>(`/api/jobs/${encodeURIComponent(partData.jobId)}`),
        $fetch<Path & { distribution: StepDistribution[] }>(`/api/paths/${encodeURIComponent(partData.pathId)}`),
      ])

      job.value = jobData
      path.value = pathData
      distribution.value = pathData.distribution
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to load part detail'
    } finally {
      loading.value = false
    }
  }

  async function fetchSiblings(): Promise<void> {
    if (!part.value) return
    try {
      // Fetch all enriched parts and filter by pathId client-side
      const all = await $fetch<EnrichedPart[]>('/api/parts')
      siblingParts.value = all.filter(
        s => s.jobId === part.value!.jobId && s.pathId === part.value!.pathId,
      )
    } catch (e: any) {
      // Non-critical — don't overwrite main error
      console.error('Failed to fetch siblings:', e)
    }
  }

  async function refreshAfterAdvance(): Promise<void> {
    if (!part.value) return
    try {
      const [partData, pathData] = await Promise.all([
        $fetch<Part>(`/api/parts/${encodeURIComponent(partId)}`),
        $fetch<Path & { distribution: StepDistribution[] }>(`/api/paths/${encodeURIComponent(part.value.pathId)}`),
      ])
      part.value = partData
      path.value = pathData
      distribution.value = pathData.distribution
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to refresh after advance'
    }
  }

  return {
    part: readonly(part),
    job: readonly(job),
    path: readonly(path),
    distribution: readonly(distribution),
    siblingParts: readonly(siblingParts),
    loading: readonly(loading),
    error: readonly(error),
    fetchDetail,
    fetchSiblings,
    refreshAfterAdvance,
  }
}
