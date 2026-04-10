import type { Part } from '~/types/domain'
import type { BatchCreatePartsInput } from '~/types/api'

export function useParts() {
  const $api = useAuthFetch()

  async function batchCreateParts(input: BatchCreatePartsInput): Promise<Part[]> {
    return await $api<Part[]>('/api/parts', {
      method: 'POST',
      body: input,
    })
  }

  async function getPart(id: string) {
    return await $api<Part & { certs: unknown[] }>(`/api/parts/${id}`)
  }

  async function attachCert(partId: string, certId: string) {
    return await $api(`/api/parts/${partId}/attach-cert`, {
      method: 'POST',
      body: { certId },
    })
  }

  return {
    batchCreateParts,
    getPart,
    attachCert,
  }
}
