import { ref, readonly } from 'vue'
import type { Certificate } from '~/types/domain'
import type { CreateCertInput, BatchAttachCertInput } from '~/types/api'

const certs = ref<Certificate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useCerts() {
  async function fetchCerts() {
    loading.value = true
    error.value = null
    try {
      certs.value = await $fetch<Certificate[]>('/api/certs')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch certificates'
      certs.value = []
    } finally {
      loading.value = false
    }
  }

  async function createCert(input: CreateCertInput): Promise<Certificate> {
    const cert = await $fetch<Certificate>('/api/certs', {
      method: 'POST',
      body: input
    })
    await fetchCerts()
    return cert
  }

  async function getCert(id: string): Promise<Certificate> {
    return await $fetch<Certificate>(`/api/certs/${id}`)
  }

  async function batchAttachCert(input: BatchAttachCertInput): Promise<void> {
    await $fetch('/api/certs/batch-attach', {
      method: 'POST',
      body: input
    })
  }

  return {
    certs: readonly(certs),
    loading: readonly(loading),
    error: readonly(error),
    fetchCerts,
    createCert,
    getCert,
    batchAttachCert
  }
}
