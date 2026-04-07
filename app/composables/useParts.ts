import type { Part } from '~/types/domain'
import type { BatchCreatePartsInput } from '~/types/api'

export function useParts() {
  const $api = useAuthFetch()

  async function batchCreateParts(input: BatchCreatePartsInput & { userId: string }): Promise<Part[]> {
    return await $api<Part[]>('/api/parts', {
      method: 'POST',
      body: input,
    })
  }

  async function advancePart(id: string, userId: string): Promise<Part> {
    return await $api<Part>(`/api/parts/${id}/advance`, {
      method: 'POST',
      body: { userId },
    })
  }

  async function getPart(id: string) {
    return await $api<Part & { certs: unknown[] }>(`/api/parts/${id}`)
  }

  async function attachCert(partId: string, certId: string, userId: string) {
    return await $api(`/api/parts/${partId}/attach-cert`, {
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
