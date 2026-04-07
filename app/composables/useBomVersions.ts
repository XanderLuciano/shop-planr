import { ref, readonly } from 'vue'
import type { BomVersion } from '~/types/domain'
import type { EditBomInput } from '~/types/api'

export function useBomVersions() {
  const $api = useAuthFetch()

  const versions = ref<BomVersion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVersions(bomId: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      versions.value = await $api<BomVersion[]>(`/api/bom/${encodeURIComponent(bomId)}/versions`)
    } catch (e) {
      error.value = e?.data?.message ?? e?.message ?? 'Failed to fetch BOM versions'
    } finally {
      loading.value = false
    }
  }

  async function editBom(bomId: string, input: Omit<EditBomInput, 'userId'>): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await $api(`/api/bom/${encodeURIComponent(bomId)}/edit`, {
        method: 'POST',
        body: input,
      })
      await fetchVersions(bomId)
    } catch (e) {
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
