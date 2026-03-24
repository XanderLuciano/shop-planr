import type { SerialNumber } from '~/server/types/domain'
import type { BatchCreateSerialsInput } from '~/server/types/api'

export function useSerials() {
  async function batchCreateSerials(input: BatchCreateSerialsInput & { userId: string }): Promise<SerialNumber[]> {
    return await $fetch<SerialNumber[]>('/api/serials', {
      method: 'POST',
      body: input
    })
  }

  async function advanceSerial(id: string, userId: string): Promise<SerialNumber> {
    return await $fetch<SerialNumber>(`/api/serials/${id}/advance`, {
      method: 'POST',
      body: { userId }
    })
  }

  async function getSerial(id: string) {
    return await $fetch<SerialNumber & { certs: unknown[] }>(`/api/serials/${id}`)
  }

  async function attachCert(serialId: string, certId: string, userId: string) {
    return await $fetch(`/api/serials/${serialId}/attach-cert`, {
      method: 'POST',
      body: { certId, userId }
    })
  }

  return {
    batchCreateSerials,
    advanceSerial,
    getSerial,
    attachCert
  }
}
