import { ref, readonly } from 'vue'
import type { BomVersion } from '~/server/types/domain'
import type { EditBomInput } from '~/server/types/api'

export function useBomVersions() {
  const versions = ref<BomVersion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVersions(bomId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      versions.value = await $fetch<BomVersion[]>(`/api/bom/${encodeURIComponent(bomId)}/versions`)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch BOM versions'
    } finally {
      loading.value = false
    }
  }

  async function editBom(bomId: string, input: EditBomInput): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/bom/${encodeURIComponent(bomId)}/edit`, {
        method: 'POST',
        body: input,
      })
      await fetchVersions(bomId)
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to edit BOM'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    versions: readonly(versions),
    loading: readonly(loading),
    error: readonly(error),
    fetchVersions,
    editBom,
  }
}
