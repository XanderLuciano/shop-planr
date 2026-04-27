import { ref, readonly } from 'vue'
import type { BOM } from '~/types/domain'
import type { BomSummary } from '~/types/computed'
import type { CreateBomInput } from '~/types/api'

const boms = ref<BOM[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useBom() {
  const $api = useAuthFetch()

  async function fetchBoms(includeArchived = false) {
    loading.value = true
    error.value = null
    try {
      const query = includeArchived ? '?includeArchived=true' : ''
      boms.value = await $api<BOM[]>(`/api/bom${query}`)
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }, message?: string }
      error.value = err?.data?.message ?? err?.message ?? 'Failed to fetch BOMs'
      boms.value = []
    } finally {
      loading.value = false
    }
  }

  async function createBom(input: CreateBomInput): Promise<BOM> {
    const bom = await $api<BOM>('/api/bom', {
      method: 'POST',
      body: input,
    })
    await fetchBoms()
    return bom
  }

  async function updateBom(id: string, input: Partial<CreateBomInput>): Promise<BOM> {
    const bom = await $api<BOM>(`/api/bom/${id}`, {
      method: 'PUT',
      body: input,
    })
    await fetchBoms()
    return bom
  }

  async function archiveBom(id: string, userId: string): Promise<BOM> {
    const bom = await $api<BOM>(`/api/bom/${id}/archive`, {
      method: 'POST',
      body: { userId },
    })
    return bom
  }

  async function unarchiveBom(id: string, userId: string): Promise<BOM> {
    const bom = await $api<BOM>(`/api/bom/${id}/unarchive`, {
      method: 'POST',
      body: { userId },
    })
    return bom
  }

  async function getBomWithSummary(id: string): Promise<BOM & { summary: BomSummary }> {
    return await $api(`/api/bom/${id}`)
  }

  return {
    boms: readonly(boms),
    loading: readonly(loading),
    error: readonly(error),
    fetchBoms,
    createBom,
    updateBom,
    archiveBom,
    unarchiveBom,
    getBomWithSummary,
  }
}
