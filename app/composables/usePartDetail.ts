import { ref, readonly } from 'vue'
import type { SerialNumber, Job, Path } from '~/server/types/domain'
import type { StepDistribution } from '~/server/types/computed'

export function usePartDetail(serialId: string) {
  const serial = ref<SerialNumber | null>(null)
  const job = ref<Job | null>(null)
  const path = ref<(Path & { distribution: StepDistribution[] }) | null>(null)
  const distribution = ref<StepDistribution[]>([])
  const siblingSerials = ref<SerialNumber[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDetail(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // Fetch serial first to get jobId and pathId
      const serialData = await $fetch<SerialNumber>(`/api/serials/${encodeURIComponent(serialId)}`)
      serial.value = serialData

      // Fetch job and path+distribution in parallel
      const [jobData, pathData] = await Promise.all([
        $fetch<Job>(`/api/jobs/${encodeURIComponent(serialData.jobId)}`),
        $fetch<Path & { distribution: StepDistribution[] }>(`/api/paths/${encodeURIComponent(serialData.pathId)}`),
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
    if (!serial.value) return
    try {
      // Fetch all enriched serials and filter by pathId client-side
      const all = await $fetch<any[]>('/api/serials')
      siblingSerials.value = all.filter(
        (s: any) => s.jobId === serial.value!.jobId && s.pathId === serial.value!.pathId,
      )
    } catch (e: any) {
      // Non-critical — don't overwrite main error
      console.error('Failed to fetch siblings:', e)
    }
  }

  async function refreshAfterAdvance(): Promise<void> {
    if (!serial.value) return
    try {
      const [serialData, pathData] = await Promise.all([
        $fetch<SerialNumber>(`/api/serials/${encodeURIComponent(serialId)}`),
        $fetch<Path & { distribution: StepDistribution[] }>(`/api/paths/${encodeURIComponent(serial.value.pathId)}`),
      ])
      serial.value = serialData
      path.value = pathData
      distribution.value = pathData.distribution
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to refresh after advance'
    }
  }

  return {
    serial: readonly(serial),
    job: readonly(job),
    path: readonly(path),
    distribution: readonly(distribution),
    siblingSerials: readonly(siblingSerials),
    loading: readonly(loading),
    error: readonly(error),
    fetchDetail,
    fetchSiblings,
    refreshAfterAdvance,
  }
}
