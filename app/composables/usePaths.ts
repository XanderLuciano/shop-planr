import type { Path } from '~/types/domain'
import type { StepDistribution } from '~/types/computed'
import type { CreatePathInput, UpdatePathInput } from '~/types/api'

export function usePaths() {
  const $api = useAuthFetch()

  async function createPath(input: CreatePathInput): Promise<Path> {
    return await $api<Path>('/api/paths', {
      method: 'POST',
      body: input,
    })
  }

  async function getPath(id: string): Promise<Path & { distribution: StepDistribution[], completedCount: number }> {
    return await $api(`/api/paths/${id}`)
  }

  async function updatePath(id: string, input: UpdatePathInput): Promise<Path> {
    return await $api<Path>(`/api/paths/${id}`, {
      method: 'PUT',
      body: input,
    })
  }

  async function deletePath(id: string): Promise<void> {
    await $api(`/api/paths/${id}`, {
      method: 'DELETE',
    })
  }

  return {
    createPath,
    getPath,
    updatePath,
    deletePath,
  }
}
