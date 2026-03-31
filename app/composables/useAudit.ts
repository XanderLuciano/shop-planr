import { ref, readonly } from 'vue'
import type { AuditEntry, AuditAction } from '~/types/domain'

const entries = ref<AuditEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export interface AuditFilters {
  action?: AuditAction
  userId?: string
  partId?: string
  jobId?: string
  startDate?: string
  endDate?: string
}

export function useAudit() {
  async function fetchEntries(options?: {
    limit?: number
    offset?: number
    filters?: AuditFilters
  }) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))
      if (options?.filters?.action) params.set('action', options.filters.action)
      if (options?.filters?.userId) params.set('userId', options.filters.userId)
      if (options?.filters?.partId) params.set('partId', options.filters.partId)
      if (options?.filters?.jobId) params.set('jobId', options.filters.jobId)
      if (options?.filters?.startDate) params.set('startDate', options.filters.startDate)
      if (options?.filters?.endDate) params.set('endDate', options.filters.endDate)
      const qs = params.toString()
      const result = await $fetch<AuditEntry[]>(`/api/audit${qs ? `?${qs}` : ''}`)
      if (options?.offset && options.offset > 0) {
        entries.value = [...entries.value, ...result]
      } else {
        entries.value = result
      }
      return result
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch audit entries'
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchPartAudit(partId: string): Promise<AuditEntry[]> {
    return await $fetch<AuditEntry[]>(`/api/audit/part/${partId}`)
  }

  return {
    entries: readonly(entries),
    loading: readonly(loading),
    error: readonly(error),
    fetchEntries,
    fetchPartAudit,
  }
}
