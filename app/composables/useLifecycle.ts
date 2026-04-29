import { ref, readonly } from 'vue'
import type { Part, PartStepStatus, PartStepOverride } from '~/types/domain'
import type { AdvancementResult, PartStepStatusView } from '~/types/computed'

export function useLifecycle() {
  const $api = useAuthFetch()
  const { emit: emitWebhook } = useWebhookEmit()
  const auth = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)

  function currentUser(): string {
    return auth.authenticatedUser.value?.displayName ?? auth.authenticatedUser.value?.username ?? 'unknown'
  }

  async function scrapPart(partId: string, input: {
    reason: string
    explanation?: string
  }): Promise<Part> {
    loading.value = true
    error.value = null
    try {
      const result = await $api<Part>(`/api/parts/${encodeURIComponent(partId)}/scrap`, {
        method: 'POST',
        body: input,
      })
      emitWebhook('part_scrapped', {
        user: currentUser(),
        partId,
        reason: input.reason,
        explanation: input.explanation,
        time: new Date().toISOString(),
      })
      return result
    } catch (e) {
      error.value = extractApiError(e, 'Failed to scrap part')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function forceComplete(partId: string, input: {
    reason?: string
  }): Promise<Part> {
    loading.value = true
    error.value = null
    try {
      const result = await $api<Part>(`/api/parts/${encodeURIComponent(partId)}/force-complete`, {
        method: 'POST',
        body: input,
      })
      emitWebhook('part_force_completed', {
        user: currentUser(),
        partId,
        reason: input.reason,
        time: new Date().toISOString(),
      })
      return result
    } catch (e) {
      error.value = extractApiError(e, 'Failed to force complete part')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function advanceToStep(partId: string, input: {
    targetStepId: string
    skip?: boolean
  }): Promise<AdvancementResult> {
    loading.value = true
    error.value = null
    try {
      const result = await $api<AdvancementResult>(`/api/parts/${encodeURIComponent(partId)}/advance-to`, {
        method: 'POST',
        body: input,
      })
      const eventType = result.serial.status === 'completed' ? 'part_completed' : 'part_advanced'
      emitWebhook(eventType, {
        user: currentUser(),
        partId,
        targetStepId: input.targetStepId,
        skip: input.skip,
        newStatus: result.serial.status,
        time: new Date().toISOString(),
      })
      return result
    } catch (e) {
      error.value = extractApiError(e, 'Failed to advance part')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function completeDeferredStep(partId: string, stepId: string): Promise<PartStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $api<PartStepStatus>(`/api/parts/${encodeURIComponent(partId)}/complete-deferred/${encodeURIComponent(stepId)}`, {
        method: 'POST',
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to complete deferred step')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function waiveStep(partId: string, stepId: string, input: {
    reason: string
  }): Promise<PartStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $api<PartStepStatus>(`/api/parts/${encodeURIComponent(partId)}/waive-step/${encodeURIComponent(stepId)}`, {
        method: 'POST',
        body: input,
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to waive step')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createStepOverride(partId: string, input: {
    partIds: string[]
    stepId: string
    reason: string
  }): Promise<PartStepOverride[]> {
    loading.value = true
    error.value = null
    try {
      return await $api<PartStepOverride[]>(`/api/parts/${encodeURIComponent(partId)}/overrides`, {
        method: 'POST',
        body: input,
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to create step override')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function reverseStepOverride(partId: string, stepId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/parts/${encodeURIComponent(partId)}/overrides/${encodeURIComponent(stepId)}`, {
        method: 'DELETE',
      })
    } catch (e) {
      error.value = extractApiError(e, 'Failed to reverse step override')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getStepStatuses(partId: string): Promise<PartStepStatusView[]> {
    loading.value = true
    error.value = null
    try {
      return await $api<PartStepStatusView[]>(`/api/parts/${encodeURIComponent(partId)}/step-statuses`)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to fetch step statuses')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function batchAdvanceToStep(input: {
    partIds: string[]
    targetStepId: string
    skip?: boolean
  }): Promise<{ advanced: number, failed: number, results: { partId: string, success: boolean, error?: string }[] }> {
    loading.value = true
    error.value = null
    try {
      const result = await $api<{ advanced: number, failed: number, results: { partId: string, success: boolean, error?: string }[] }>('/api/parts/advance-to', {
        method: 'POST',
        body: input,
      })
      if (result.advanced > 0) {
        emitWebhook('part_advanced', {
          user: currentUser(),
          partIds: input.partIds,
          targetStepId: input.targetStepId,
          skip: input.skip,
          advancedCount: result.advanced,
          failedCount: result.failed,
          time: new Date().toISOString(),
        })
      }
      return result
    } catch (e) {
      error.value = extractApiError(e, 'Failed to advance parts')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function canComplete(partId: string): Promise<{ canComplete: boolean, blockers: string[] }> {
    loading.value = true
    error.value = null
    try {
      return await $api<{ canComplete: boolean, blockers: string[] }>(`/api/parts/${encodeURIComponent(partId)}/can-complete`)
    } catch (e) {
      error.value = extractApiError(e, 'Failed to check completion status')
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    scrapPart,
    forceComplete,
    advanceToStep,
    completeDeferredStep,
    waiveStep,
    createStepOverride,
    reverseStepOverride,
    getStepStatuses,
    batchAdvanceToStep,
    canComplete,
  }
}
