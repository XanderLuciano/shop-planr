import { ref, readonly } from 'vue'
import type { SerialNumber, SnStepStatus, SnStepOverride } from '~/server/types/domain'
import type { AdvancementResult, SnStepStatusView } from '~/server/types/computed'

export function useLifecycle() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function scrapSerial(serialId: string, input: {
    reason: string
    explanation?: string
    userId: string
  }): Promise<SerialNumber> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SerialNumber>(`/api/serials/${encodeURIComponent(serialId)}/scrap`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to scrap serial'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function forceComplete(serialId: string, input: {
    reason?: string
    userId: string
  }): Promise<SerialNumber> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SerialNumber>(`/api/serials/${encodeURIComponent(serialId)}/force-complete`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to force complete serial'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function advanceToStep(serialId: string, input: {
    targetStepIndex: number
    userId: string
  }): Promise<AdvancementResult> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<AdvancementResult>(`/api/serials/${encodeURIComponent(serialId)}/advance-to`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to advance serial'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function completeDeferredStep(serialId: string, stepId: string, input: {
    userId: string
  }): Promise<SnStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SnStepStatus>(`/api/serials/${encodeURIComponent(serialId)}/complete-deferred/${encodeURIComponent(stepId)}`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to complete deferred step'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function waiveStep(serialId: string, stepId: string, input: {
    reason: string
    approverId: string
  }): Promise<SnStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SnStepStatus>(`/api/serials/${encodeURIComponent(serialId)}/waive-step/${encodeURIComponent(stepId)}`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to waive step'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createStepOverride(serialId: string, input: {
    serialIds: string[]
    stepId: string
    reason: string
    userId: string
  }): Promise<SnStepOverride[]> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SnStepOverride[]>(`/api/serials/${encodeURIComponent(serialId)}/overrides`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to create step override'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function reverseStepOverride(serialId: string, stepId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/serials/${encodeURIComponent(serialId)}/overrides/${encodeURIComponent(stepId)}`, {
        method: 'DELETE',
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to reverse step override'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getStepStatuses(serialId: string): Promise<SnStepStatusView[]> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<SnStepStatusView[]>(`/api/serials/${encodeURIComponent(serialId)}/step-statuses`)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch step statuses'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function canComplete(serialId: string): Promise<{ canComplete: boolean, blockers: string[] }> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<{ canComplete: boolean, blockers: string[] }>(`/api/serials/${encodeURIComponent(serialId)}/can-complete`)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to check completion status'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    scrapSerial,
    forceComplete,
    advanceToStep,
    completeDeferredStep,
    waiveStep,
    createStepOverride,
    reverseStepOverride,
    getStepStatuses,
    canComplete,
  }
}
