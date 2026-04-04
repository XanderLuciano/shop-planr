import type { Part } from '~/types/domain'
import type { BatchCreatePartsInput } from '~/types/api'

export function useParts() {
  async function batchCreateParts(input: BatchCreatePartsInput & { userId: string }): Promise<Part[]> {
    return await $fetch<Part[]>('/api/parts', {
      method: 'POST',
      body: input,
    })
  }

  async function advancePart(id: string, userId: string): Promise<Part> {
    return await $fetch<Part>(`/api/parts/${id}/advance`, {
      method: 'POST',
      body: { userId },
    })
  }

  async function getPart(id: string) {
    return await $fetch<Part & { certs: unknown[] }>(`/api/parts/${id}`)
  }

  async function attachCert(partId: string, certId: string, userId: string) {
    return await $fetch(`/api/parts/${partId}/attach-cert`, {
      method: 'POST',
      body: { certId, userId },
    })
  }

  return {
    batchCreateParts,
    advancePart,
    getPart,
    attachCert,
  }
}
