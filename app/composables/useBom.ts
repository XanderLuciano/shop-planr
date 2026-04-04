import { ref, readonly } from 'vue'
import type { BOM } from '~/types/domain'
import type { BomSummary } from '~/types/computed'
import type { CreateBomInput } from '~/types/api'

const boms = ref<BOM[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useBom() {
  async function fetchBoms() {
    loading.value = true
    error.value = null
    try {
      boms.value = await $fetch<BOM[]>('/api/bom')
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch BOMs'
      boms.value = []
    } finally {
      loading.value = false
    }
  }

  async function createBom(input: CreateBomInput): Promise<BOM> {
    const bom = await $fetch<BOM>('/api/bom', {
      method: 'POST',
      body: input,
    })
    await fetchBoms()
    return bom
  }

  async function updateBom(id: string, input: Partial<CreateBomInput>): Promise<BOM> {
    const bom = await $fetch<BOM>(`/api/bom/${id}`, {
      method: 'PUT',
      body: input,
    })
    await fetchBoms()
    return bom
  }

  async function getBomWithSummary(id: string): Promise<BOM & { summary: BomSummary }> {
    return await $fetch(`/api/bom/${id}`)
  }

  return {
    boms: readonly(boms),
    loading: readonly(loading),
    error: readonly(error),
    fetchBoms,
    createBom,
    updateBom,
    getBomWithSummary,
  }
}
