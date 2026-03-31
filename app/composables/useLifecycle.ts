import { ref, readonly } from 'vue'
import type { Part, PartStepStatus, PartStepOverride } from '~/types/domain'
import type { AdvancementResult, PartStepStatusView } from '~/types/computed'

export function useLifecycle() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function scrapPart(partId: string, input: {
    reason: string
    explanation?: string
    userId: string
  }): Promise<Part> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<Part>(`/api/parts/${encodeURIComponent(partId)}/scrap`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to scrap part'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function forceComplete(partId: string, input: {
    reason?: string
    userId: string
  }): Promise<Part> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<Part>(`/api/parts/${encodeURIComponent(partId)}/force-complete`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to force complete part'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function advanceToStep(partId: string, input: {
    targetStepIndex: number
    userId: string
  }): Promise<AdvancementResult> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<AdvancementResult>(`/api/parts/${encodeURIComponent(partId)}/advance-to`, {
        method: 'POST',
        body: input,
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to advance part'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function completeDeferredStep(partId: string, stepId: string, input: {
    userId: string
  }): Promise<PartStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<PartStepStatus>(`/api/parts/${encodeURIComponent(partId)}/complete-deferred/${encodeURIComponent(stepId)}`, {
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

  async function waiveStep(partId: string, stepId: string, input: {
    reason: string
    approverId: string
  }): Promise<PartStepStatus> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<PartStepStatus>(`/api/parts/${encodeURIComponent(partId)}/waive-step/${encodeURIComponent(stepId)}`, {
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

  async function createStepOverride(partId: string, input: {
    partIds: string[]
    stepId: string
    reason: string
    userId: string
  }): Promise<PartStepOverride[]> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<PartStepOverride[]>(`/api/parts/${encodeURIComponent(partId)}/overrides`, {
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

  async function reverseStepOverride(partId: string, stepId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/parts/${encodeURIComponent(partId)}/overrides/${encodeURIComponent(stepId)}`, {
        method: 'DELETE',
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to reverse step override'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function getStepStatuses(partId: string): Promise<PartStepStatusView[]> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<PartStepStatusView[]>(`/api/parts/${encodeURIComponent(partId)}/step-statuses`)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch step statuses'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function canComplete(partId: string): Promise<{ canComplete: boolean, blockers: string[] }> {
    loading.value = true
    error.value = null
    try {
      return await $fetch<{ canComplete: boolean, blockers: string[] }>(`/api/parts/${encodeURIComponent(partId)}/can-complete`)
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
    scrapPart,
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
